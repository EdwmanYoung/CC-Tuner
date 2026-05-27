# CC-Tuner

Claude Code 模型切换桌面工具。支持管理多个模型配置方案（Profile），在 Anthropic 官方 API、OpenRouter、DeepSeek、Ollama、vLLM 等提供商之间快速切换。

## 功能特性

- **配置文件夹选择**: 首次使用时选择 Claude Code 配置文件夹路径，CC-Tuner 仅管理该文件夹下的 `settings.json`
- **多方案管理**: 创建、编辑、删除模型配置方案
- **一键切换**: 切换方案时自动写入 `settings.json`
- **连通性验证**: 测试 API 连通性和延迟
- **安全存储**: API Key 使用操作系统级加密（DPAPI/Keychain/libsecret）存储
- **自动备份**: 切换前自动备份 settings.json，支持恢复
- **暗色主题**: 支持系统主题跟随和手动切换
- **跨平台**: Windows / macOS / Linux

## 快速开始

### 环境要求

| 工具 | 版本 |
|---|---|
| Node.js | ≥ 20 LTS |
| npm | ≥ 10 |

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动 Vite 开发服务器 (localhost:4322) 和 Electron 窗口。

### 构建

```bash
npm run build          # 编译前端 + 主进程
npm run package:win    # Windows 安装包
npm run package:mac    # macOS DMG
npm run package:linux  # Linux AppImage + deb
```

### 测试

```bash
npm test               # 运行单元测试
npm run test:watch     # 监听模式
npm run test:coverage  # 覆盖率报告
npm run typecheck      # TypeScript 类型检查
```

## 首次使用

1. 启动 CC-Tuner 后，会提示选择 **Claude Code 配置文件夹**
2. 选择或输入路径（例如 `C:\Users\YourName\.claude` 或 `~/.claude`）
3. CC-Tuner 将在此文件夹中管理 `settings.json` 文件

## 项目结构

```
cc-tuner/
├── electron/                  # Electron 主进程
│   ├── main.ts               # 主进程入口
│   ├── preload.ts            # contextBridge 预加载
│   ├── services/             # 核心服务层
│   │   ├── config-manager.ts   # 读写 settings.json
│   │   ├── profile-manager.ts  # Profile CRUD
│   │   ├── security.ts         # API Key 加密/解密
│   │   ├── validator.ts        # API 连通性测试
│   │   ├── backup-manager.ts   # settings.json 备份/恢复
│   │   └── settings-store.ts   # 配置文件夹路径存储
│   ├── ipc/                  # IPC 通道处理器
│   ── types/                # 主进程类型定义
├── src/                      # Vite + Vue 渲染进程
│   ├── main.ts               # Vue 入口
│   ├── index.html            # HTML 入口
│   ├── components/           # Vue 组件
│   ├── composables/          # Vue 组合式函数
│   ├── styles/               # 全局样式
│   └── types/                # 共享类型定义
├── tests/unit/               # 单元测试
├── docs/                     # 开发文档
├── test_claude/              # 测试用配置文件夹
├── package.json
├── vite.config.ts            # Vite 构建配置
└── vitest.config.ts
```

## 数据存储

| 文件 | 位置 | 内容 |
|---|---|---|
| `settings.json` | 用户指定的 Claude Code 配置文件夹 | Claude Code 配置（读写目标） |
| `profiles.json` | `AppData/Roaming/cc-tuner/profiles.json` | CC-Tuner 方案列表 |
| `cc-tuner-store.json` | `AppData/Roaming/cc-tuner/cc-tuner-store.json` | CC-Tuner 应用设置（配置文件夹路径） |
| `backups/` | `AppData/Roaming/cc-tuner/backups/` | settings.json 自动备份 |

## 开发文档

完整开发文档见 [docs/README.md](docs/README.md)：

| 文档 | 内容 |
|---|---|
| [01-overview](docs/01-overview.md) | 项目背景、功能需求、术语表 |
| [02-architecture](docs/02-architecture.md) | 系统架构、技术选型、目录结构 |
| [03-data-models](docs/03-data-models.md) | Profile、Provider、AppState 数据模型 |
| [04-services](docs/04-services.md) | 核心服务层设计 |
| [05-ipc-spec](docs/05-ipc-spec.md) | IPC 通道定义、preload 接口 |
| [06-ui-guide](docs/06-ui-guide.md) | Vue 组件树、Fluent Design |
| [07-security](docs/07-security.md) | 加密方案、安全策略 |
| [08-testing](docs/08-testing.md) | 测试策略、工具链 |
| [09-build-deploy](docs/09-build-deploy.md) | 构建流程、打包配置 |
| [10-exception-handling](docs/10-exception-handling.md) | 错误码、异常处理、UI 反馈 |

## 安全说明

- API Key 使用 Electron `safeStorage` 加密存储，底层调用系统级加密 API
- 解密的明文 API Key 仅在内存中使用，发送请求后立即丢弃
- 渲染进程通过 `contextBridge` 与主进程通信，不直接访问 Node.js API
- CC-Tuner 仅管理 `settings.json` 文件，不影响 Claude Code 的其他功能
