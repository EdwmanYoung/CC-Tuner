Claude Code 模型切换工具 - 详细设计文档 (Electron 版)
1. 项目概述
1.1 背景
Claude Code 的模型连接信息（API 地址、认证令牌、默认模型等）存储在 ~/.claude/settings.json 文件中。目前切换不同模型提供商或不同模型，只能通过手动编辑该 JSON 文件完成，操作繁琐且易出错。

1.2 目标
开发一个桌面应用，提供可视化的方式管理多套模型配置方案，并实现一键切换，降低使用门槛，减少配置错误。

1.3 适用范围
使用官方 Anthropic API

使用兼容 Anthropic 协议的三方服务（如 OpenRouter、DeepSeek 等）

使用本地或自部署模型服务（如 Ollama、vLLM）

2. 功能需求
（与前版本文档相同，包括配置方案管理、一键切换、方案列表、验证、安全、备份恢复等，此处不再重复列出。）

3. 系统架构与技术栈
3.1 整体架构
采用 Electron 多进程架构，主进程负责系统级操作（文件读写、密钥访问），渲染进程提供交互界面。引入 Astro 作为构建工具来管理 Vue 组件的开发和打包，同时保持最终的 UI 风格为 Fluent Design。

text
┌──────────────────────────────────────────────┐
│                Electron 主进程 (Node.js)      │
│  ConfigManager  ProfileManager  Security     │
│  Validator      BackupManager   IPC 服务     │
└──────────────────┬───────────────────────────┘
                   │ IPC 通信
┌──────────────────▼───────────────────────────┐
│          Electron 渲染进程 (Web 页)           │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │    Astro 构建工具链 (开发/生产)      │    │
│  │  ┌────────────────────────────────┐  │    │
│  │  │  Vue 3 + TypeScript 组件       │  │    │
│  │  │  (Fluent UI Web Components)    │  │    │
│  │  └────────────────────────────────┘  │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
3.2 技术选型说明
层级	技术	角色
桌面壳	Electron 28+	跨平台桌面容器，提供原生系统能力
后端逻辑	TypeScript (主进程)	文件 I/O、配置管理、加密、API 验证
构建工具	Astro + Vite	管理渲染进程的静态资源构建与热更新
前端框架	Vue 3 (Composition API)	响应式 UI 组件开发
UI 组件库	@fluentui/web-components	提供 Fluent Design 风格的按钮、卡片、输入框等
样式方案	CSS Variables + FAST Design Tokens	统一 Fluent 主题变量（颜色、间距、阴影）
IPC 通信	Electron contextBridge + ipcRenderer/ipcMain	渲染进程安全调用主进程 API
3.3 为何选择 Astro + Vue？
Astro 能够将 Vue 组件输出为静态或客户端交互的内容，非常适合 Electron 渲染进程这种单一 HTML 入口的场景。

Astro 内置了对 Vue 的一流支持，开发时可获得完整的热模块替换（HMR）体验。

最终构建产物为纯静态资源（HTML/CSS/JS），无需在渲染进程引入 Node.js 依赖，符合安全最佳实践。

4. 核心数据模型
（与之前版本相同，包括 settings.json 结构、方案数据模型、应用状态模型等，此处略。）

5. 业务逻辑详细设计
本节描述的业务逻辑全部运行在 Electron 主进程 中，由渲染进程通过预定义的 IPC 通道触发。

5.1 ~ 5.7 业务逻辑
（逻辑流程与之前版本保持一致，包括配置方案管理、切换流程、安全处理、验证、备份恢复、与 Claude Code 交互、配置文件优先级等。唯一变化的是这些逻辑现在通过 ipcMain.handle() 暴露给渲染进程调用，而非直接在 UI 层执行。）

IPC 通道设计示例：

通道名称	方向	描述
profiles:list	渲染 → 主	获取所有配置方案列表
profiles:create	渲染 → 主	创建新方案
profiles:update	渲染 → 主	更新方案
profiles:delete	渲染 → 主	删除方案
config:switch	渲染 → 主	应用指定方案，切换模型
config:test	渲染 → 主	测试指定方案的连通性
backup:restore-latest	渲染 → 主	恢复最近一次备份
shell:open-claude	渲染 → 主	打开外部终端并启动 Claude Code
6. 界面交互流程（Fluent 风格实现）
6.1 设计系统配置
基于 Fluent Design System，使用以下底层支撑：

Fluent UI Web Components (@fluentui/web-components)：提供 <fluent-button>, <fluent-card>, <fluent-text-field>, <fluent-dialog> 等原生自定义元素。

FAST Design Tokens：通过 CSS 自定义属性全局控制颜色、字体、圆角等，确保暗黑/明亮主题无缝切换。

自定义 Vue 包装组件：将 Fluent 原生元素封装为 Vue 单文件组件（SFC），以适配 Vue 的响应式属性和事件。示例：

vue
<template>
  <fluent-card class="profile-card">
    <fluent-button appearance="accent" @click="$emit('switch')">切换</fluent-button>
  </fluent-card>
</template>
6.2 主窗口布局
窗口本身：无系统边框（frameless），使用自定义 Fluent 风格标题栏（<fluent-dialog> 的拖拽区域）。

左侧导航（可选）：使用 <fluent-tree-view> 对方案按提供商分组，减少主内容区杂乱。

中央内容区：

顶部命令栏：<fluent-toolbar> 内嵌 搜索框、新建方案按钮、启动 Claude Code 按钮。

方案卡片网格：CSS Grid 布局，每个方案渲染为一个 <fluent-card>，包含：

方案名称（<fluent-typography>）

提供商图标（通过 <img> 或 SVG）

API 地址的截断显示

默认模型名称

激活状态指示：使用 Fluent 的 Badge 或 Status 标签，如 “使用中”。

详情预览面板（右侧或弹出）：<fluent-dialog> 或右侧 SplitView，展示选中方案的完整 JSON 配置。

6.3 方案卡片交互
单击卡片：在右侧面板展示方案所有字段（只读预览）。

双击卡片：直接触发切换操作（主进程 config:switch）。

右键菜单：通过 Electron 的 contextmenu 事件显示原生菜单，提供编辑、复制、删除、测试连接选项。

6.4 编辑对话框
使用 <fluent-dialog> 实现模态编辑窗口：

表单字段绑定：

<fluent-text-field> 用于名称、URL、模型、超时。

<fluent-select> 用于提供商下拉。

<fluent-password-box> 或带切换的 <fluent-text-field> 用于 API 密钥，默认掩码，附带“显示”图标按钮。

底部操作：

<fluent-button appearance="accent"> 保存

<fluent-button> 测试连接

<fluent-button> 取消

6.5 主题与动画
利用 Fluent 的 theme-provider 组件全局切换暗黑/明亮模式，并与系统主题同步。

卡片悬停时使用 elevation 阴影变化，按钮点击使用 standard 涟漪效果。

7. 异常场景处理
同前版本，但在 UI 上通过 Fluent 的 Toast 通知 或 MessageBar 组件进行错误反馈，例如：

切换成功：<fluent-message-bar intent="success"> 已切换至方案 “xxx”。

解密失败：<fluent-message-bar intent="error"> 无法读取存储的 API 密钥，请重新输入。

8. 开发与构建
8.1 项目结构
text
model-switcher/
├── electron/                # Electron 主进程
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/
│   ├── services/            # ConfigManager, Security, etc.
│   └── ...
├── src/                     # Astro + Vue 渲染进程
│   ├── pages/
│   │   └── index.astro      # 单页入口
│   ├── components/          # Vue 组件
│   │   ├── MainWindow.vue
│   │   ├── ProfileCard.vue
│   │   ├── EditorDialog.vue
│   │   └── ...
│   ├── layouts/
│   └── astro.config.mjs
├── package.json
├── tsconfig.json
├── electron-builder.yml     # 打包配置
└── ...
8.2 开发流程
启动开发服务器：astro dev 启动 Vite 驱动的 HMR 服务，Electron 窗口加载 http://localhost:4321。

调用主进程：preload.ts 通过 contextBridge.exposeInMainWorld('api', { ... }) 暴露安全接口给 Vue 组件。

构建：astro build 生成静态文件到 dist/，然后 electron-builder 将 dist/ 与 electron/ 打包成可执行程序。

