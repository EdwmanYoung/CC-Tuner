# 1. 项目概述

## 1.1 背景

Claude Code 的模型连接信息（API 地址、认证令牌、默认模型、超时等）存储在 `~/.claude/settings.json` 文件中。目前用户切换不同模型提供商（Anthropic、OpenRouter、DeepSeek）或不同模型时，只能手动编辑该 JSON 文件，操作繁琐且易出错：

- 需要记住 JSON 格式和各字段含义
- 频繁切换场景（如从官方 API 切到本地 Ollama）需要反复修改文件
- 修改错误可能导致 Claude Code 无法启动
- 没有配置验证和备份机制

## 1.2 目标

开发一个 Electron 桌面应用 **CC-Tuner**（Claude Code 模型切换工具），提供：

1. **可视化的多套模型配置管理** — 以卡片界面管理多套 Profile（配置方案）
2. **一键切换模型** — 双击或点击即可切换 `~/.claude/settings.json` 中的模型配置
3. **配置验证** — 切换前自动验证 API 连通性
4. **安全存储** — API Key 加密存储，不暴露明文
5. **备份恢复** — 自动备份历史配置，支持一键回滚

## 1.3 适用范围

CC-Tuner 支持以下模型服务类型：

| 类型 | 示例 | 配置特点 |
|---|---|---|
| 官方 Anthropic API | api.anthropic.com | 标准 API Key 认证 |
| 兼容 Anthropic 协议的三方服务 | OpenRouter、DeepSeek | 自定义 baseURL + API Key |
| 本地/自部署服务 | Ollama、vLLM | 本地 URL，可能无需 API Key |

## 1.4 目标用户

- 经常在不同模型提供商之间切换的开发者
- 同时使用官方 API 和本地模型的数据科学/研究团队
- 需要快速验证不同模型配置但不想手动编辑 JSON 的用户
- 对 JSON 配置不熟悉的技术用户

## 1.5 功能需求

### FR-1: 配置方案管理（Profile CRUD）

- 创建、编辑、复制、删除配置方案
- 每个方案包含：名称、提供商、baseURL、API Key、默认模型、超时设置
- 方案按提供商分组展示

### FR-2: 一键切换

- 通过 UI 操作将选中方案的配置写入 `~/.claude/settings.json`
- 切换前自动备份当前配置
- 切换后提供即时反馈

### FR-3: 连通性验证

- 测试指定方案的 API 连通性（发送最小请求验证认证和可达性）
- 验证结果在 UI 上以状态标识展示

### FR-4: 安全存储

- API Key 不在 UI 上默认明文显示（可切换显示）
- 持久化存储时使用系统加密 API（Windows DPAPI / macOS Keychain / Linux libsecret）

### FR-5: 备份与恢复

- 每次切换前自动备份当前 `settings.json`
- 保留最近 N 份备份，支持恢复到任意历史版本

### FR-6: 启动 Claude Code

- 提供快捷按钮，从应用内直接打开终端并启动 `claude` 命令

### FR-7: 主题适配

- 支持亮色/暗色主题，自动跟随系统主题
- Apple 风格 UI：SF Pro 字体、canvas-parchment 背景、action-blue 交互色、hairline 边框

## 1.6 非功能需求

- **性能**: 应用冷启动 < 3 秒
- **安全**: API Key 不以明文形式落盘
- **兼容性**: 支持 Windows 10+、macOS 12+、主流 Linux 发行版
- **可靠性**: 切换失败不损坏原始 `settings.json`

## 1.7 术语表

| 术语 | 定义 |
|---|---|
| Profile（配置方案） | 一套完整的模型连接配置，包含 baseURL、API Key、model 等字段 |
| Provider（提供商） | 模型服务的提供方，如 Anthropic、OpenRouter、DeepSeek、Ollama |
| settings.json | Claude Code 的配置文件，位于 `~/.claude/settings.json` |
| IPC | Electron 进程间通信（Inter-Process Communication） |
| contextBridge | Electron 提供的渲染进程 → 主进程安全通信桥接机制 |

## 相关文档

- [系统架构](02-architecture.md) — 整体架构与技术选型
- [数据模型](03-data-models.md) — Profile、AppState 等核心数据结构
