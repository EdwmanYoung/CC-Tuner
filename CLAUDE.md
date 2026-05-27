# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CC-Tuner** (Claude Code 模型切换工具) is an Electron desktop application for managing multiple Claude Code model configurations. It provides a visual interface to manage, switch, and validate different model provider setups (Anthropic, OpenRouter, DeepSeek, Ollama, vLLM, etc.) that would otherwise require manual editing of `~/.claude/settings.json`.

## Architecture

- **Electron multi-process**: Main process handles file I/O, encryption, API validation; renderer process provides Fluent Design UI
- **Build toolchain**: Astro + Vite for static asset compilation with Vue 3 SFCs
- **Frontend**: Vue 3 (Composition API) with `@fluentui/web-components` for Fluent Design
- **IPC**: `contextBridge` + `ipcRenderer/ipcMain` for secure main/renderer communication

### Project Structure (planned)

```
model-switcher/
├── electron/                # Electron main process
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/                 # IPC channel handlers
│   └── services/            # ConfigManager, ProfileManager, Security, Validator, BackupManager
├── src/                     # Astro + Vue renderer
│   ├── pages/
│   │   └── index.astro      # Single-page entry
│   ├── components/          # Vue SFCs (ProfileCard, EditorDialog, etc.)
│   ├── layouts/
│   └── astro.config.mjs
├── package.json
├── tsconfig.json
├── electron-builder.yml     # Packaging config
└── CLAUDE.md
```

### Key IPC Channels

| Channel | Direction | Description |
|---|---|---|
| `profiles:list` | renderer → main | List all config profiles |
| `profiles:create` | renderer → main | Create new profile |
| `profiles:update` | renderer → main | Update profile |
| `profiles:delete` | renderer → main | Delete profile |
| `config:switch` | renderer → main | Apply profile, switch model |
| `config:test` | renderer → main | Test profile connectivity |
| `backup:restore-latest` | renderer → main | Restore latest backup |
| `shell:open-claude` | renderer → main | Open terminal with Claude Code |

## Development Documentation

Complete development documentation is in `docs/`. See [docs/README.md](docs/README.md) for the index.

| Doc | Description |
|---|---|
| [01-overview](docs/01-overview.md) | Project background, goals, glossary |
| [02-architecture](docs/02-architecture.md) | System architecture, tech stack, directory structure |
| [03-data-models](docs/03-data-models.md) | Profile, AppState, Provider enums, TypeScript interfaces |
| [04-services](docs/04-services.md) | 6 core services: class design, method signatures, pseudocode |
| [05-ipc-spec](docs/05-ipc-spec.md) | IPC channel definitions, preload.ts, contextBridge security |
| [06-ui-guide](docs/06-ui-guide.md) | Vue component tree, Fluent Design, theming, interactions |
| [07-security](docs/07-security.md) | Encryption, keychain, file permissions |
| [08-testing](docs/08-testing.md) | Unit/E2E testing strategy |
| [09-build-deploy](docs/09-build-deploy.md) | Dev workflow, build config, cross-platform packaging |
| [10-exception-handling](docs/10-exception-handling.md) | Error codes, exception flows, UI feedback |

Original design document: [CC-TUNER_detail_design.md](CC-TUNER_detail_design.md)

## Development

**Status**: Source code implemented. 54 unit tests passing.

### Development Workflow

```bash
npm install              # Install dependencies
npm run dev              # Vite dev server (localhost:5174) + Electron
npm test                 # Run unit tests (Vitest)
npm run build            # Vite build + TypeScript compile
npm run build:electron   # Compile main process only
npm run build:renderer   # Vite build frontend only
npm run typecheck        # TypeScript type check
```

### Build

```bash
npm run build            # Build renderer + main process
node node_modules/electron-builder/cli.js --win  # Package Windows exe
```

### Build Output

- `dist/` — Frontend static assets (Vite)
- `dist-electron/` — Compiled main process code
- `release/win-unpacked/` — Unpacked Electron app
- `release/CC-Tuner-0.1.0-win-x64.zip` — Portable distribution

## Important Notes

- Configuration target file: `~/.claude/settings.json`
- Security: API keys should be encrypted (not stored in plaintext)
- Backup/restore functionality required before modifying `settings.json`
- The app supports: official Anthropic API, Anthropic-compatible third-party services (OpenRouter, DeepSeek), local/self-hosted services (Ollama, vLLM)
