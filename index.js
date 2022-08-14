const vorpal = require('vorpal')();
const axios = require('axios').default;
const Mustache = require('mustache');
const Configstore = require('configstore');
const async = require('async');

let conformity = "https://conformity.{{region}}.cloudone.trendmicro.com/api"
// todo: pre-load from settings?

const config = new Configstore('cloudInventory', {
    region: 'us-1',
    apiKey: null,
    accounts: {}
});

var region = config.get('region');
var apiKey = config.get('apiKey');
var accounts = config.get('accounts');

function fetchData(commandInstance, callback) {
    const proxy = { proxy: {
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
        "accounts" : function(callback) {
            commandInstance.log('fetching accounts...');
            const url = Mustache.render(conformity + "/accounts", { region: region });
            axios({
                method: 'get',
                url: url,
                json: true,
                headers: {
                    Authorization: `ApiKey ${apiKey}`,
                    'Api-Version':  'v1',
                    'Content-Type': 'application/vnd.api+json'
                }
            })
            .then(function(response) {
              if (!response.status || (response.status !== 200) || !response.data || !response.data.data) {
                return callback(response.status ? response.status : "failed");
              }
              accounts = response.data.data.reduce(function(memo, account) {
                return Object.assign({}, memo, {
                  [account.id]: account
                })
              }, {});
              config.set('accounts', accounts);
              commandInstance.log(`Found ${Object.keys(accounts).length} accounts:`);
              Object.values(accounts)
                .sort(function(a, b) { a.attributes.name < b.attributes.name})
                .forEach(function(account) {
                  commandInstance.log(`   ${account.attributes.name} (${account.attributes.environment})`);
                });
              callback(null, accounts);
            })
            .catch(callback);
        },

        'reports' : ['accounts', function(data, callback) {
            commandInstance.log(data.accounts);
            config.set('accounts', data.accounts);
            commandInstance.log('fetching reports...')
            callback()
        }]
    }, callback);
}


vorpal
  .command('init <region> <apiKey>', 'initialise cloudInventory.')
  .action(function(args, callback) {
    region = args.region;
    apiKey = args.apiKey;
    config.set('region', region);
    config.set('apiKey', apiKey);
    callback();
  });

vorpal
  .command('fetch', 'fetch (update) all accounts and reports.')
  .action(function(args, callback) {
    fetchData(this, callback);
  });

  vorpal
  .command('accounts', 'list all accounts.')
  .action(function(args, callback) {
    const commandInstance = this;
    if (Object.keys(accounts).length < 1) {
      commandInstance.log("No accounts, try running 'fetch'.");
      return;
    }
    Object.values(accounts)
      .sort(function(a, b) { a.attributes.name < b.attributes.name})
      .forEach(function(account) {
        commandInstance.log(`   ${account.attributes.name} (${account.attributes.environment})`);
      });
      callback();
  });

vorpal
  .command('proxy <protocol> <host> <port> <username> <password>', 'configure proxy.')
  .action(function(args, callback) {
    proxyProtocol = args.protocol;
    proxyHost = args.host;
    proxyPort = args.port;
    proxyUsername = args.username;
    proxyPassword = args.password;
    apiKey = args.apiKey;
    config.set('proxyProtocol', proxyProtocol);
    config.set('proxyHost', proxyHost);
    config.set('proxyPort', proxyPort);
    config.set('proxyUsername', proxyUsername);
    config.set('proxyPassword', proxyPassword);
    fetchData(this, callback);
  });


// vorpal
//   .command('accounts', 'Retrieves updates your list of accounts.')
//   .action(function(args, callback) {
//     this.log('bar');
//     callback();
//   });
 
vorpal
  .delimiter('cloudInventory$')
  .show();