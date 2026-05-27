# 2. 系统架构

## 2.1 整体架构

采用 Electron 多进程架构，主进程负责系统级操作（文件读写、加密、API 验证），渲染进程提供交互界面。使用 Astro 作为构建工具生成纯静态 HTML/CSS/JS，无需任何前端框架。

```
┌──────────────────────────────────────────────────┐
│                Electron 主进程 (Node.js)          │
│                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ ConfigMgr   │  │ ProfileMgr  │  │ Security  │ │
│  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
│         │                │               │        │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼─────┐ │
│  │ Validator   │  │ BackupMgr   │  │ ShellSvc  │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┘ │
│         │                │                         │
│  ┌──────▼────────────────▼──────────────────────┐ │
│  │              IPC Handler (ipcMain)            │ │
│  └──────────────────┬───────────────────────────┘ │
└─────────────────────┼─────────────────────────────┘
                      │ contextBridge / IPC
┌─────────────────────▼─────────────────────────────┐
│              Electron 渲染进程 (Web 页面)          │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │   Astro 构建工具链 (Vite 驱动 HMR)         │   │
│  │  ┌──────────────────────────────────────┐  │   │
│  │  │  Vanilla JS (Pub/Sub 状态管理)       │  │   │
│  │  │  @fluentui/web-components UI 层       │  │   │
│  │  │  Apple 设计系统 (CSS Variables)       │  │   │
│  │  └──────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

### 进程职责

| 进程 | 职责 | 技术 |
|---|---|---|
| **主进程** | 文件 I/O、配置解析、加密/解密、API 验证、进程间通信 | TypeScript (Node.js) |
| **渲染进程** | UI 渲染、用户交互、状态管理、数据展示 | Astro + Vanilla JS |
| **preload 脚本** | 安全桥接，暴露有限的 IPC API 给渲染进程 | TypeScript |

## 2.2 技术选型

| 层级 | 技术 | 版本 | 角色 |
|---|---|---|---|
| 桌面壳 | Electron | 28+ | 跨平台桌面容器，提供原生系统能力 |
| 后端逻辑 | TypeScript | 5.x | 文件 I/O、配置管理、加密、API 验证 |
| 构建工具 | Astro + Vite | 4.x / 5.x | 渲染进程静态资源构建与 HMR |
| 前端框架 | 无框架 — Vanilla JS (Pub/Sub 模式) | — | 响应式状态管理 + DOM 渲染 |
| UI 组件库 | @fluentui/web-components | 3.x | Fluent Design 风格 Web Components |
| 样式方案 | CSS Variables (Apple 设计令牌) | — | 统一主题变量 |
| IPC 通信 | contextBridge + ipcMain/ipcRenderer | - | 渲染进程安全调用主进程 API |
| 打包工具 | electron-builder | 24+ | 跨平台打包与分发 |

### 2.2.1 为什么选 Astro + Vanilla JS？

| 因素 | Astro + Vanilla JS | Astro + Vue | 纯 Electron SPA |
|---|---|---|---|
| 构建产物 | 纯静态 HTML/CSS/JS | 需 Vue 运行时 | 需框架运行时 |
| 包体积 | 零框架开销 (~15KB JS) | +40KB Vue runtime | +30KB+ |
| HMR 体验 | Vite 原生 | 需 Vue 插件 | 需框架插件 |
| 安全最佳实践 | 渲染进程无 Node.js | 同左 | 常开 nodeIntegration |
| 开发复杂度 | Astro 单页 + 模块化 JS | 需管理 SFC 组件 | 需管理 SPA 路由 |

## 2.3 项目目录结构

```
cc-tuner/
│
├── package.json                    # 项目元信息、scripts、依赖
├── tsconfig.json                   # TypeScript 编译配置
├── electron-builder.yml            # 打包配置（产品名、图标、输出目录等）
│
├── electron/                       # Electron 主进程代码
│   ├── main.ts                     # 主进程入口：创建 BrowserWindow、加载页面
│   ├── preload.ts                  # preload 脚本：contextBridge 暴露安全 API
│   ├── ipc/                        # IPC 处理器
│   │   ├── index.ts                # 注册所有 IPC handler
│   │   ├── profiles.ts             # profiles:* 通道处理
│   │   ├── config.ts               # config:* 通道处理
│   │   ├── backup.ts               # backup:* 通道处理
│   │   ├── shell.ts                # shell:* 通道处理
│   │   └── history.ts              # history:* 通道处理
│   └── services/                   # 业务服务层
│       ├── index.ts                # 服务导出
│       ├── config-manager.ts       # ConfigManager: 读写 settings.json (env 格式)
│       ├── profile-manager.ts      # ProfileManager: Profile CRUD（本地存储）
│       ├── security.ts             # SecurityService: 加密/解密
│       ├── validator.ts            # ValidatorService: API 连通性验证
│       ├── backup-manager.ts       # BackupManager: 备份/恢复
│       ├── shell-service.ts        # ShellService: 启动外部终端
│       └── history-manager.ts      # HistoryManager: 操作历史日志
│
├── src/                            # Astro 渲染进程
│   ├── pages/
│   │   └── index.astro             # 单页 HTML 入口（Apple 风格布局）
│   ├── js/                         # 原生 JavaScript 模块
│   │   ├── state.js                # Pub/Sub 状态管理（替代 Pinia）
│   │   ├── api.js                  # IPC 通信封装
│   │   ├── providers.js            # Provider 常量与工具函数
│   │   ├── renderers.js            # DOM 渲染（替代 Vue 组件）
│   │   ├── theme.js                # 主题切换
│   │   ├── toaster.js              # Toast 通知
│   │   └── app.js                  # 应用入口与初始化
│   ├── styles/                     # 全局样式
│   │   ├── tokens.css              # Apple 设计令牌 → CSS Variables
│   │   └── globals.css             # 全局 reset、布局、组件样式
│   ├── types/                      # 共享 TypeScript 类型
│   │   └── index.ts                # Profile、Provider、AppState 等
│   └── astro.config.mjs            # Astro 配置
│
├── resources/                      # 应用资源
│   └── icon.png                    # 应用图标
│
├── tests/                          # 测试代码
│   ├── unit/                       # 单元测试
│   │   ├── services/               # 服务层单测
│   │   └── ipc/                    # IPC handler 单测
│   └── e2e/                        # Electron E2E 测试
│       └── main.spec.ts            # Playwright E2E 用例
│
└── docs/                           # 开发文档（本目录）
```

## 2.4 数据流

```
用户操作（渲染进程）
  │
  ├─ JS 模块触发渲染 (renderers.js)
  │    │
  │    ├─ 调用 window.api.profiles.list()
  │    │    │
  │    │    └─ contextBridge → ipcRenderer.invoke('profiles:list')
  │    │         │
  │    │         └─ ipcMain.handle('profiles:list') → ProfileManager.list()
  │    │              │
  │    │              └─ 读取本地 profiles.json → 返回 Profile[]
  │    │
  │    └─ state.js pub/sub 更新 → renderers.js 重新渲染 DOM
  │
  └─ (切换场景) 调用 window.api.config.switch(id)
       │
       └─ ipcRenderer.invoke('config:switch', { id })
            │
            └─ ipcMain.handle('config:switch')
                 │
                 ├─ 1. BackupManager.backup()     → 备份当前 settings.json
                 ├─ 2. ProfileManager.get(id)     → 获取目标 Profile
                 ├─ 3. SecurityService.decrypt()  → 解密 API Key
                 ├─ 4. ValidatorService.test()    → 验证连通性（可选）
                 ├─ 5. ConfigManager.writeProfile() → 写入 settings.json (env 格式)
                 ├─ 6. HistoryManager.append()    → 记录操作历史
                 └─ 7. 返回结果 → Toast 通知
```

## 2.5 settings.json 格式

CC-Tuner 仅修改 settings.json 的 `env` 字段，保留其他所有内容（如 `enabledPlugins`）不改动。env 格式示例：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-...",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_MODEL": "claude-sonnet-4-20250514",
    "ANTHROPIC_SMALL_FAST_MODEL": "claude-haiku-4-20250514",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-20250514",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-20250514",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-20250514",
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-haiku-4-20250514"
  },
  "enabledPlugins": {
    "rust-analyzer-lsp@claude-plugins-official": true
  }
}
```

`ConfigManager.writeProfile()` 方法负责：读取现有 settings.json → 合并新 env → 清理旧版平铺字段 → 写回。

## 2.6 本地数据存储

除 `~/.claude/settings.json` 外，CC-Tuner 自身维护两份本地文件：

- **profiles.json**: `~/.cc-tuner/profiles.json` — 所有 Profile 的完整信息（含加密后的 API Key），JSON 数组格式
- **history.json**: `~/.cc-tuner/cc-tuner-history.json` — 操作历史日志，记录每次创建/编辑/切换/删除操作

profiles.json 是「配置库」，settings.json 是「当前生效配置」。切换时从 profiles.json 读取目标 Profile → 通过 `writeProfile()` 写入 settings.json 的 env 字段。

## 相关文档

- [项目概述](01-overview.md) — 功能需求与术语
- [数据模型](03-data-models.md) — Profile、AppState 详细结构
- [服务层设计](04-services.md) — 各服务类详细实现
- [IPC 规范](05-ipc-spec.md) — IPC 通道完整定义
- [UI 开发指南](06-ui-guide.md) — Apple 风格 UI 设计
- [构建与发布](09-build-deploy.md) — 开发与构建工作流
