# cloudInventory

A command line utility that uses your Trend Micro Cloud One Conformity account to generate a csv of all assets in your accounts.

# usage

Run the tool:

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