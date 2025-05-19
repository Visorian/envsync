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

- Support for remote configuration/configurationless
- Support more storage providers
- Support remote encryption at rest

---

## Quickstart

1. Initialize new envsync config with `envsync init`
2. Execute `envsync update` to push the configured `.env` files to the remote location
3. Execute `envsync sync` anywhere you want to pull the current version from the remote location

### For syncing only

1. Execute `envsync sync`

⚠️ **Important**

- The preferred way of authenticating to remote storage (for example Azure Key Vault) should be an interactive login session with `az login` or `Connect-AzAccount`. Adding more env variables to authenticate to a service is not what we want to achieve.
- Please cofigure permissions for reading and writing with your storage provider. For example in Azure you should only provide write permissions to people you want to update the .env files by assigning the respective RBAC (Role-Based Access Control) roles.
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
npx envsync <command> [options]
```

### Commands

#### `init`

Interactively initialize a new environment sync configuration.

```sh
npx envsync init
```

- Detects `.env` files in your project
- Lets you select files and backend
- Stores config in `envsync.json`

#### `sync`

Synchronize local `.env` files with the remote backend.

```sh
npx envsync sync
```

- Downloads remote files if they differ from local

#### `update`

Update remote backend with your current local `.env` files.

```sh
npx envsync update
```

- Prompts before overwriting remote files

#### `status`

Show the status of your local `.env` files compared to the remote backend.

```sh
npx envsync status
```

- Tells you if files are up-to-date or out-of-date

#### `clear`

Delete all synced `.env` files from the remote backend.

```sh
npx envsync clear
```

- Prompts for confirmation before deleting

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
