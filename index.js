const vorpal = require('vorpal')();
const axios = require('axios').default;
const Mustache = require('mustache');
const Configstore = require('configstore');
const async = require('async');
const moment = require('moment');
const csv = require('csv');
const commandLineArgs = require('command-line-args')

const optionDefinitions = [
    { name: 'silent', alias: 's', type: Boolean }
]
const options = function () {
    try {
        return commandLineArgs(optionDefinitions)
    } catch (err) {
        console.log('usage:\r\n\tnode index.js [-s|--silent]\r\n');
        return
    }
}()
if (!options) { return }

let conformity = "https://conformity.{{region}}.cloudone.trendmicro.com/api"
// todo: pre-load from settings?

const config = new Configstore('cloudInventory', {
    region: 'us-1',
    apiKey: null,
    accounts: {},
    reports: {},
    mappings: {}
});

var region = config.get('region');
var apiKey = config.get('apiKey');
var accounts = config.get('accounts');
var reports = config.get('reports');
var mappings = config.get('mappings');

function fetchReports(accountId, callback) {
    const url = Mustache.render(conformity + "/reports", { region: region });
    axios({
        method: 'get',
        url: url,
        json: true,
        headers: {
            Authorization: `ApiKey ${apiKey}`,
            'Api-Version': 'v1',
            'Content-Type': 'application/vnd.api+json'
        },
        params: {
            accountId: accountId
        }
    })
        .then(function (response) {
            if (!response.status || (response.status !== 200) || !response.data || !response.data.data) {
                return callback(response.status ? response.status : "failed");
            }
            callback(null, response.data.data);
        })
        .catch(callback);
};

function fetchData(commandInstance, callback) {

    // todo: implement optional proxy functionality
    const proxy = {
        proxy: {
            protocol: 'https',
            host: '127.0.0.1',
            port: 9000,
            auth: {
                username: 'mikeymike',
                password: 'rapunz3l'
            }
        }
    };

    async.auto({
        "accounts": function (callback) {
            commandInstance.log('\nfetching accounts...');
            const url = Mustache.render(conformity + "/accounts", { region: region });
            axios({
                method: 'get',
                url: url,
                json: true,
                headers: {
                    Authorization: `ApiKey ${apiKey}`,
                    'Api-Version': 'v1',
                    'Content-Type': 'application/vnd.api+json'
                }
            })
                .then(function (response) {
                    if (!response.status || (response.status !== 200) || !response.data || !response.data.data) {
                        return callback(response.status ? response.status : "failed");
                    }
                    accounts = response.data.data.reduce(function (memo, account) {
                        return Object.assign({}, memo, {
                            [account.id]: account
                        })
                    }, {});
                    config.set('accounts', accounts);
                    commandInstance.log(`Found ${Object.keys(accounts).length} accounts:`);
                    Object.values(accounts)
                        .sort(function (a, b) { a.attributes.name.localeCompare(b.attributes.name) })
                        .forEach(function (account) {
                            commandInstance.log(`   ${account.attributes.name} (${account.attributes.environment})`);
                        });
                    callback(null, accounts);
                })
                .catch(callback);
        },

        'reports': ['accounts', function (data, callback) {
            commandInstance.log('\nfetching reports...');

            async.reduce(Object.values(accounts).sort(function (a, b) {
                a.attributes.name.localeCompare(b.attributes.name)
            }), {}, function (memo, account, callback) {
                fetchReports(account.id, function (err, data) {
                    if (err) { return callback(err); }

                    reportInfo = data.reduce(function (memo, report) {
                        const attr = report.attributes;
                        const id = attr['report-config-id'];
                        const last = memo[id] || attr;
                        return Object.assign({}, memo, {
                            [id]: (attr['created-date'] > last['created-date'] ? attr : last)
                        });
                    }, {});

                    commandInstance.log(`   ${account.attributes.name} (${account.attributes.environment}):`);
                    Object.values(reportInfo).forEach(function (report) {
                        const date = moment(report['created-date']);
                        commandInstance.log(`       ${report.title}${report.daily ? ' (daily)' : ''} latest is ${date.fromNow()}`);
                    });
                    callback(null, Object.assign({}, memo, {
                        [account.id]: reportInfo
                    }));
                });
            }, function (error, data) {
                if (error) { return callback(error); }
                reports = data;
                config.set('reports', reports);
                // todo: clean up broken mappings? or publish warnings? 
                callback();
            });
        }]
    }, callback);
}

function downloadCSV(commandInstance, url, callback) {
    if (!url) { return callback(); } //- silently fail for now

    axios.get(url,
        // {
        //   headers: {
        //     "User-Agent":
        //       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36"
        //   }
        // }
    ).then((response) => {
        if (!response || !response.data) { return callback(); }
        csv.parse(response.data, {
            columns: true
        }, callback);
    }).catch(callback);
}

function authAndDownloadCSV(commandInstance, reportInfo, callback) {
    const url = reportInfo.included.reduce(function (memo, entry) {
        if (entry.type === 'CSV') {
            return entry["report-download-endpoint"];
        }
        return memo;
    }, null);

    if (!url) { return callback(); } //- silently fail for now

    //    commandInstance.log(url, reportInfo);
    axios({
        method: 'get',
        url: url,
        json: true,
        headers: {
            Authorization: `ApiKey ${apiKey}`,
            'Api-Version': 'v1',
            'Content-Type': 'application/vnd.api+json'
        }
    }).then((response) => {
        const url = response && response.data && response.data.url;
        if (!url) { commandInstance.log("report not found"); return callback(); }
        downloadCSV(commandInstance, url, callback);
    }).catch(callback);
}

function generateReport(commandInstance, callback) {
    const accountIds = Object.keys(mappings);

    async.auto({
        // get the latest reports in parallel
        reports: function (callback) {
            commandInstance.log("\nChecking latest reports...");
            async.map(accountIds, function (accountId, callback) {
                const account = accounts[accountId];
                const reportId = mappings[accountId];
                fetchReports(accountId, function (err, data) {
                    if (err) { return callback(err); }

                    reportInfo = data.reduce(function (memo, report) {
                        const attr = report.attributes;
                        if (!reportId || (attr['report-config-id'] !== reportId)) { return memo; }
                        const id = attr['report-config-id'];
                        const last = memo[id] || attr;
                        return Object.assign({}, memo, (attr['created-date'] > last['created-date'] ? attr : last));
                    }, {});

                    // here we have the exact report we need to use for this account
                    // fetch the data
                    // commandInstance.log(reportInfo);
                    commandInstance.log(`Retrieving latest "${reportInfo.title}" for ${account && account.attributes && account.attributes.name}...`);
                    authAndDownloadCSV(commandInstance, reportInfo, function (err, csv) {
                        callback(err, {
                            account: account,
                            reportInfo: reportInfo,
                            csv: csv
                        });
                    });
                });
            }, callback);
        },

        csv: ['reports', function (data, callback) {
            // massage all the data to arrive at the final csv output
            // commandInstance.log('Summarising...');
            //commandInstance.log(data && data.reports);

            const summary = ((data && data.reports) || []).reduce(function(memo, item) {
                // commandInstance.log(item);
                return (item.csv || []).reduce(function(memo, row) {
                    // commandInstance.log(row);
                    if (row.Resource.length > 0) {
                        const key = item.account.id + '|' + row.Service + '|' + row.Region + '|' + row.Resource;
                        memo[key] = {
                            "account" : `${item.account.attributes.name} (${item.account.attributes.environment})`,
                            "service" : row.Service,
                            "region" : row.Region,
                            "resource" : row.Resource
                        };
                    }
                    return memo;
                }, memo);
            }, {});

            csv.stringify(Object.values(summary),  {
                header: true,
                quoted: true
            }, callback);
        }]
    }, function (err, data) {
        if (callback) { callback(err, data && data.csv); }
    });
}

if (options.silent) {
    return generateReport({
        log: (err) => { console.error(err) },
        error: (err) => { console.error(err) }
    }, function(err, csv) {
        if (err) {
            return console.error(err);
        }
        console.log(csv);
    });
}

vorpal
    .command('init <region> <apiKey>', 'initialise cloudInventory.Region is one of [ us-1 | etc... ]')
    .action(function (args, callback) {
        region = args.region;
        apiKey = args.apiKey;
        config.set('region', region);
        config.set('apiKey', apiKey);
        callback();
    });

vorpal
    .command('fetch', 'fetch (update) all accounts and reports.')
    .action(function (args, callback) {
        fetchData(this, callback);
    });

vorpal
    .command('accounts', 'list all accounts.')
    .action(function (args, callback) {
        listAccounts(this, callback);
    });

// todo
// vorpal
//     .command('proxy <protocol> <host> <port> <username> <password>', 'configure proxy.')
//     .action(function (args, callback) {
//         proxyProtocol = args.protocol;
//         proxyHost = args.host;
//         proxyPort = args.port;
//         proxyUsername = args.username;
//         proxyPassword = args.password;
//         apiKey = args.apiKey;
//         config.set('proxyProtocol', proxyProtocol);
//         config.set('proxyHost', proxyHost);
//         config.set('proxyPort', proxyPort);
//         config.set('proxyUsername', proxyUsername);
//         config.set('proxyPassword', proxyPassword);
//         fetchData(this, callback);
//     });

function listAccounts(commandInstance, callback) {
    if (Object.keys(accounts).length < 1) {
        commandInstance.log("No accounts, try running 'fetch'.");
        return;
    }
    Object.values(accounts)
        .sort(function (a, b) { a.attributes.name < b.attributes.name })
        .forEach(function (account) {
            const reportId = mappings[account.id];
            const accountReports = account.id && reports[account.id];
            const report = accountReports && accountReports[reportId];
            const display = report ? `${report.title}${report.daily ? ' (daily)' : ''}` : `no report assigned, please use "set ${account.attributes.name}" command`;
            commandInstance.log(`   ${account.attributes.name} (${account.attributes.environment}) : ${display}`);
        });
    if (callback) { callback(); }
}

function showConfig(commandInstance, callback) {
    if (region) {
        commandInstance.log(`\nusing region: ${region}`);
        listAccounts(commandInstance, function (err) {
            if (err) {
                return (callback || (() => { }))(err);
            }
        });
    } else {
        commandInstance.log(`\nno region set, run "init" command first`);
    }
    commandInstance.log('');
    if (callback) { callback() };
}

vorpal
    .command('config', 'Displays current configuration.')
    .action(function (args, callback) {
        showConfig(this, callback);
    });

vorpal
    .command('set <account> <report>', 'assign which report to use for the given account.')
    .autocomplete(() => {
        const args = vorpal.ui.input().split(' ');
        if (args.length > 3) { return []; }
        if (args.length > 2) {
            const id = Object.values(accounts).reduce(function (memo, account) {
                if (account.attributes.name == args[1]) {
                    return account.id;
                }
                return memo;
            }, null);
            if (!id) { return null; }
            //console.log(id, reports);
            return Object.values(reports[id] || {}).map((report) => `"${report.title}"`).sort();
        }
        return Object.values(accounts).map((account) => account.attributes.name).sort();
    })
    .action(function (args, callback) {
        const commandInstance = this;
        //commandInstance.log(args);
        const account = Object.values(accounts).reduce(function (memo, account) {
            if (account.attributes.name == args.account) {
                return account;
            }
            return memo;
        }, null);
        if (!account) { return callback(new Error("Account not found")); }
        const report = Object.values(reports[account.id] || {}).reduce(function (memo, report) {
            if (report.title == args.report) {
                return report;
            }
            return memo;
        }, null);
        if (!report) { return callback(new Error("Report not found")); }

        mappings[account.id] = report['report-config-id'];
        config.set('mappings', mappings);
        const display = report ? `${report.title}${report.daily ? ' (daily)' : ''}` : `no report assigned, please use "set ${account.attributes.name}" command`;
        commandInstance.log(`   ${account.attributes.name} (${account.attributes.environment}) : ${display}`);
        callback();
    });

vorpal
    .command('generate [filename]', 'Generate the summary report in csv.')
    .action(function (args, callback) {
        generateReport(this, callback);
    });

// first display configuration
showConfig(vorpal);

vorpal
    .delimiter('cloudInventory$')
    .show();