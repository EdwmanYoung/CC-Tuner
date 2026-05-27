# CC-Tuner 开发文档索引

> Claude Code 模型切换桌面工具 — Electron + Astro + Vanilla JS

## 文档导航

| # | 文档 | 说明 | 关键引用 |
|---|---|---|---|
| 1 | [项目概述](01-overview.md) | 背景、目标、功能需求、术语表 | → [架构](02-architecture.md) |
| 2 | [系统架构](02-architecture.md) | 多进程架构、技术选型、目录结构、数据流 | → [服务层](04-services.md), [IPC](05-ipc-spec.md) |
| 3 | [数据模型](03-data-models.md) | settings.json、Profile、AppState、Provider 枚举 | ← [服务层](04-services.md), [IPC](05-ipc-spec.md) |
| 4 | [服务层设计](04-services.md) | 7 个核心服务的类设计、方法签名、伪代码 | → [数据模型](03-data-models.md), [IPC](05-ipc-spec.md), [安全](07-security.md) |
| 5 | [IPC 规范](05-ipc-spec.md) | 通道定义、preload.ts 接口、contextBridge 安全 | → [数据模型](03-data-models.md), [服务层](04-services.md), [异常](10-exception-handling.md) |
| 6 | [UI 开发指南](06-ui-guide.md) | Apple 风格设计系统、布局、JS 模块架构、交互规范 | → [IPC](05-ipc-spec.md), [异常](10-exception-handling.md) |
| 7 | [安全设计](07-security.md) | 加密方案、Keychain 集成、IPC 安全、文件权限 | → [服务层](04-services.md) |
| 8 | [测试策略](08-testing.md) | 单元测试、E2E 测试、IPC mock、测试工具链 | → [服务层](04-services.md), [UI](06-ui-guide.md) |
| 9 | [构建与发布](09-build-deploy.md) | 开发工作流、构建配置、electron-builder、跨平台打包 | → [架构](02-architecture.md) |
| 10 | [异常处理](10-exception-handling.md) | 错误码、异常流程、UI 反馈规范、降级策略 | → [IPC](05-ipc-spec.md), [UI](06-ui-guide.md) |
| 11 | [UI 重新设计](11-ui-redesign.md) | 侧边栏 + 5 页架构（冻结设计文档） | **FROZEN** |

## 冻结设计参考

| 文档 | 说明 |
|---|---|
| [`00-demo.html`](00-demo.html) | Apple 风格 HTML 原型（Fluent UI Web Components + 设计令牌） |
| [`11-ui-redesign.md`](11-ui-redesign.md) | 完整 UI 设计文档（侧边栏导航、5 页面架构、Apple 设计令牌） |

## 快速开始

```bash
# 克隆仓库后
npm install

# 启动开发模式（Astro dev + Electron）
npm run dev

# 构建生产包
npm run build
```

详细开发流程见 [09-build-deploy.md](09-build-deploy.md)。
