# envsync

> Effortless environment file synchronization

[![npm version](https://img.shields.io/npm/v/envsync?style=flat&colorA=222&colorB=448aff)](https://npmjs.com//envsync)
[![License](https://img.shields.io/github/license/visorian/envsync?style=flat&colorA=222&colorB=448aff)](./LICENSE)

> *Did you receive the .env file I shared in Discord?*

**envsync** helps you keep your `.env` files in sync across local and remote backends (local, Azure Storage, Azure Key Vault, Azure App Configuration). It provides a simple CLI to initialize, sync, update, check status, and clear environment files for your project.

---

## Features

- 🔍 **Auto-detects** `.env` files in your project (root and subfolders)
- 🗂️ **Supports multiple backends powered by unstorage**: Currently supported Azure Storage, Azure Key Vault, Azure App Configuration
- **Supports merging**: Supports merging with existing settings in .env files. Duplicate keys will be overwritten by the remote state
- 📝 **Interactive CLI** for setup and management - Run `envsync --help` for available options

### Planned

- [x] Support for remote configuration/configurationless
- [ ] Support more storage providers
- [ ] Support remote encryption at rest

---

## Quickstart

1. Initialize new envsync config with `envsync init`
2. Execute `envsync update` to push the configured `.env` files to the remote location
3. Execute `envsync sync` anywhere you want to pull the current version from the remote location

### For syncing only

1. Add the optional dependencies of the backend you want to use to your devDependencies. For example for azure-storage, use
```
pnpm add -D @azure/identity @azure/storage-blob
```
2. Execute `envsync sync` or in a configless setup (config file is also storage in the remote location)
`envsync sync --remote-config --backend-type azure-storage --azure-storage-accountName YOUR_ACCOUNT_NAME --azure-storage-containerName YOUR_CONTAINER_NAME`

⚠️ **Limitations**

- The preferred way of authenticating to remote storage (for example Azure Key Vault) should be an interactive login session with `az login` or `Connect-AzAccount`. Adding more env variables to authenticate to a service is not what we want to achieve.
- Please cofigure permissions for reading and writing with your storage provider. For example in Azure you should only provide write permissions to people you want to update the .env files by assigning the respective RBAC (Role-Based Access Control) roles.
- We are not syncing comments due to how the merging and parsing works. If you need to have commented out lines synchronized, the only workaround it to not have a space between the `#` and the key

Is synced

```
#COMMENT_WITHOUT_SPACE=123
```

Is not synced

```
# COMMENT_WITH_SPACE=123
```

- Remember that secrets stored in `.env` files are unecrypted and should only be for local services or extremely temporary. They cannot be recalled once they are on someones computer.

## Install

```bash
pnpm add -D envsync
or
pnpm add -g envsync
```

---

## Usage

```sh
pnpm exec envsync <command> [options]
```

## Configless (remote configuration)

You can use envsync in a "configless" mode, where there is no `envsync.json` save in your repo, but the config is also saved in the remote location.
To initialize a repo with a remote configuration, run

```
envsync init --remote-config --backend-type BACKEND_TYPE --azure-storage-accountName ACCOUNT_NAME --azure-storage-containerName CONTAINER_NAME
```

This will start the initialization wizard and automatically configures the backend with the provided parameters. There will be no `envsync.json` config file be written to disk, but directly to your configured remote storage.
All other commands work like in a local configuration:

### Update (write local .env files to remote storage)

```
envsync update --remote-config --backend-type BACKEND_TYPE --azure-storage-accountName ACCOUNT_NAME --azure-storage-containerName CONTAINER_NAME
```

### Sync

```
envsync sync --remote-config --backend-type BACKEND_TYPE --azure-storage-accountName ACCOUNT_NAME --azure-storage-containerName CONTAINER_NAME
```

### Status

```
envsync status --remote-config --backend-type BACKEND_TYPE --azure-storage-accountName ACCOUNT_NAME --azure-storage-containerName CONTAINER_NAME
```

## Commands

All commands support a common set of options for backend selection, config file, directory, and backend-specific arguments. Run `envsync <command> --help` for all options.

### `init`

Interactively initialize a new environment sync configuration.

```sh
pnpm exec envsync init [options]
```

- Detects `.env` files in your project
- Lets you select files and backend
- Stores config in `envsync.json` or remote

### `sync`

Synchronize local `.env` files with the remote backend.

```sh
pnpm exec envsync sync [options]
```

- Downloads remote files if they differ from local

### `update`

Update remote backend with your current local `.env` files.

```sh
pnpm exec envsync update [options]
```

- Prompts before overwriting remote files

### `status`

Show the status of your local `.env` files compared to the remote backend.

```sh
pnpm exec envsync status [options]
```

- Tells you if files are up-to-date or out-of-date

### `clear`

Delete all synced `.env` files from the remote backend.

```sh
pnpm exec envsync clear [options]
```

- Prompts for confirmation before deleting

### `rescan`

Rescan for `.env` files and update configuration.

```sh
pnpm exec envsync rescan [options]
```

- Updates the config with newly found `.env` files

### `config`

Show the current configuration.

```sh
pnpm exec envsync config
```

---

**Common options for all commands:**

- `--directory, -d` Specify the directory to sync environment files
- `--backend-type, -b` Specify the backend type (e.g., azure-storage, azure-key-vault, azure-app-config, local)
- `--config-file, -c` Path to the envsync configuration file
- `--overwrite, -o` Overwrite existing environment files in the remote location when running update
- `--merge, -m` Merge with existing local environment files
- `--remote-config, -r` Use configuration stored in remote location
- `--includeSuffixes, -i` Include .env files with suffixes like .env.sample, .env.template
- Azure backend-specific options (see above)

---

## Configuration

The configuration is stored in `envsync.json` after running `init`.
You can edit this file manually or re-run `init` to update it.

Example:

```json
{
  "mergeEnvFiles": false,
  "recursive": true,
  "exclude": ["node_modules", ".git", "dist"],
  "backend": {
    "type": "azure-storage",
    "name": "azure-storage",
    "config": {
      "accountName": "myaccount",
      "containerName": "envfiles"
    }
  },
  "files": [
    {
      "name": ".env",
      "path": "/.env",
      "extension": ""
    },
    {
      "name": ".env.local",
      "path": "/.env.local",
      "extension": ".local"
    }
  ]
}
```

---

## Backends

- **azure-storage**: Uses Azure Blob Storage.
- **azure-key-vault**: Uses Azure Key Vault.
- **azure-app-config**: Uses Azure App Configuration.

You will be prompted for backend-specific options during `init`.

---

## License

MIT License © 2025
Jan-Henrik Damaschke (Github:@itpropro)
