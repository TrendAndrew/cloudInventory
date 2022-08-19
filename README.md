# cloudInventory

A command line utility that uses your Trend Micro Cloud One Conformity account to generate a csv of all assets in your accounts.

# Quick Start

1. Download the binary you want to use from [Releases](https://github.com/TrendAndrew/cloudInventory/releases)
1. run the tool (example for mac):
```bash
$ ./cloudinventory-macos [-s]
```

# Usage

Run the tool *interactively* first to set the Trend Micro Conformity region and API Key (Get these from the Conformity portal)

```bash
$ ./cloudinventory-macos
```

you will be prompted for your region and apiKey for Conformity (these will be persisted in your local prefs file for use later)

## Setup

If you want to switch to a different Conformity account, use the "init" command

```bash
cloudInventory$ init us-1 ABCD8728753875387
```

Once initialised, it will fetch all the accounts and the latest reports for each.

## Fetching the latest configurations

If you want to see the current configuration, use the "config" command which will display the known accounts and the current report that is set to be used to generate the audit.

```bash
cloudInventory$ config
```

## Selecting the report to use for each account

The tool works by retrieving the latest generated version of the report you select for each account. So it's important you use a report that applies to all resources you are trying to audit, in order for it to contain those resource types.

To set the report for a given account, use the "set" command.

```bash
cloudInventory$ set <account> <report>
```

PRO TIP: If you hit the &lt;tab&gt; key twice, the available options will be shown, and if you type the first character, then hit the &lt;tab&gt; key, it will autocomplete for you. So if you type "set &lt;tab&gt;&lt;tab&gt;" it will show you all the accounts it is aware of. Type the first letter of the account you want to set and then type &lt;tab&gt; and it will fill it in. Then if you type "&lt;tab&gt;&lt;tab&gt;" again, it will list all the reports it is aware of and you can again type a letter or so and "&lt;tab&gt;" to auto-complete the command parameters.

## Running in the background

Use the "-s" command line flag to run non-interactively. This will use the last configuration to pull the latest files and output the csv to the command line.

You can then use that output to feed to other commands.

**TODO**

Or you could email the csv or save it
