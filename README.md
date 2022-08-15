# cloudInventory

A command line utility that uses your Trend Micro Cloud One Conformity account to generate a csv of all assets in your accounts.

# Quick Start

1. [Install Node](https://nodejs.org/en/download/)
1. [Install GIT](https://github.com/git-guides/install-git)
1. Clone this repo and cd into the directory
```bash
$ git clone git@github.com:TrendAndrew/cloudInventory.git
$ cd cloudInventory
```
1. run the tool
```bash
node index.js [-s]
```

# Usage

Run the tool *interactively* first to set the Trend Micro Conformity region and API Key (Get these from the Conformity portal)

```bash
node index.js
```

you will be prompted for your region and apiKey for Conformity (these will be persisted in your local prefs file for use later)

If you want to switch to a different Conformity account, use the "init" command

```bash
cloudInventory$ init us-1 ABCD8728753875387
```

Once initialised, it will pull down the latest reports for all your accounts and generate a summary of all assets.

Use "save" to save to a local file

To grab the latest data, use the "get" command

Use "help" to get help on commands.

## Running in the background

Use the "-s" command line flag to run non-interactively. This will use the last configuration to pull the latest files and output the csv to the command line.

You can then use that output to feed to other commands. For example, to get a count of all resources per account you could do womething like this:

**TODO**

Or you could email the csv or save it
