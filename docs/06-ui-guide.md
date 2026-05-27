# 6. UI 开发指南

本文档描述 CC-Tuner 的前端架构、Apple 风格设计系统和交互规范。基于冻结设计文档 [`00-demo.html`](00-demo.html) 和 [`11-ui-redesign.md`](11-ui-redesign.md)。

## 6.1 技术栈

| 层 | 技术 |
|---|---|
| 构建 | Astro（单页入口 `src/pages/index.astro`） |
| 框架 | 无 — Vanilla JavaScript (Pub/Sub 状态管理) |
| UI 组件 | @fluentui/web-components (Web Components) |
| 样式 | CSS Variables — Apple 设计令牌系统 |
| 字体 | SF Pro Display / SF Pro Text（非 Apple 平台用 system-ui fallback） |
| 路由 | 无需路由（单页面应用） |

## 6.2 设计系统

### 6.2.1 Apple 设计令牌

**来源**: [`00-demo.html`](00-demo.html) — Apple 设计分析 YAML

#### 颜色

| Token | Hex | 用途 |
|---|---|---|
| `--color-canvas-parchment` | `#f5f5f7` | 页面默认背景（标题栏、侧边栏、状态栏） |
| `--color-canvas` | `#ffffff` | 内容区域背景、卡片 |
| `--color-action-blue` | `#0066cc` | 唯一交互色：按钮、链接、焦点环 |
| `--color-focus-blue` | `#0071e3` | 键盘焦点环 |
| `--color-ink` | `#1d1d1f` | 主文本色 |
| `--color-ink-muted` | `#86868b` | 次要文本 |
| `--color-hairline` | `rgba(0,0,0,0.08)` | 边框/分割线 |

#### 圆角

| Token | Value | 用途 |
|---|---|---|
| `--radius-sm` | `8px` | 输入框、小按钮 |
| `--radius-md` | `12px` | 对话框、面板 |
| `--radius-lg` | `18px` | 卡片 |
| `--radius-pill` | `980px` | Pill 按钮（signature Apple CTAs） |

#### 字体

```css
--font-display: "SF Pro Display", system-ui, -apple-system, sans-serif;
--font-text: "SF Pro Text", system-ui, -apple-system, sans-serif;
```

- 标题用 `SF Pro Display` weight 600
- 正文用 `SF Pro Text` weight 400
- `letter-spacing: -0.08px` 获得 Apple 标志性的"紧凑标题"效果

## 6.3 页面布局

### 6.3.1 整体结构

```
┌─────────────────────────────────────────────────────┐
│  Title Bar (38px)                                   │
│  "CC-Tuner"              [─] [□] [×]                │
├──────────────┬──────────────────────────────────────┤
│              │  Command Bar                         │
│              │  [搜索] [+ 新建方案] [启动 Claude Code]│
│              ├──────────────────────────────────────┤
│  Side Nav    │                                      │
│  (240px)     │  Content Area                        │
│              │                                      │
│  Providers   │  ┌──────┐  ┌──────┐  ┌──────┐       │
│  - Anthropic │  │Card  │  │Card  │  │Card  │       │
│  - OpenRouter│  └──────┘  └──────┘  └──────┘       │
│  - DeepSeek  │  ┌──────┐  ┌──────┐                  │
│              │  │Card  │  │Card  │                  │
│              │  └──────┘  └──────┘                  │
│              │                                      │
│  [◐ 主题]    │                                      │
├──────────────┴──────────────────────────────────────┤
│  Status Bar (32px)                                  │
│  当前激活: Claude Official | 最后备份: 2026-05-27    │
└─────────────────────────────────────────────────────┘
```

### 6.3.2 HTML 结构 (`src/pages/index.astro`)

```html
<body>
  <!-- 标题栏 -->
  <div class="title-bar">
    <span class="app-name">CC-Tuner</span>
    <div class="window-controls">
      <!-- minimize, maximize, close buttons -->
    </div>
  </div>

  <div class="main-container">
    <!-- 侧边导航 -->
    <div class="side-nav">
      <div class="side-nav-header">Providers</div>
      <fluent-tree-view>...</fluent-tree-view>
      <div class="side-nav-footer">
        <button class="theme-toggle">◐ 切换主题</button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="content-area">
      <!-- 命令栏 -->
      <div class="command-bar">
        <fluent-search placeholder="搜索配置方案..."></fluent-search>
        <fluent-button id="newProfileBtn">+ 新建方案</fluent-button>
        <fluent-button id="launchClaudeBtn">启动 Claude Code</fluent-button>
      </div>

      <!-- 卡片网格 -->
      <div class="cards-grid" id="cardsContainer"></div>

      <!-- 详情面板 -->
      <div class="detail-panel" id="detailPanel"></div>
    </div>
  </div>

  <!-- 状态栏 -->
  <div class="status-bar">
    <span>当前激活: <strong id="activeProfileName"></strong></span>
    <span>最后备份: <span id="lastBackup"></span></span>
  </div>

  <!-- Toast 容器 -->
  <div id="toastContainer"></div>

  <!-- 编辑对话框 -->
  <fluent-dialog id="editDialog">...</fluent-dialog>
</body>
```

## 6.4 JS 模块架构

### 6.4.1 模块职责

| 文件 | 职责 |
|---|---|
| `state.js` | Pub/Sub 状态管理（替代 Pinia）。维护 profiles, activeProfileId, currentPage 等状态 |
| `api.js` | IPC 通信封装（替代 composable）。封装 window.api.* 调用 |
| `providers.js` | Provider 常量：emoji 映射、默认 baseURL、模型列表 |
| `renderers.js` | DOM 渲染（替代 8 个 Vue 组件）。renderCards(), renderEditor(), renderDetail() 等 |
| `theme.js` | 主题切换（亮/暗），跟随系统 |
| `toaster.js` | Toast 通知管理 |
| `app.js` | 应用入口，初始化所有模块，绑定事件 |

### 6.4.2 状态模型 (`state.js`)

```javascript
// 15 行 pub/sub，替代 Pinia + 4 composables
const listeners = new Map();
const state = {
  profiles: [],
  activeProfileId: null,
  currentPage: 'profiles',    // profiles | history | settings
  editingProfile: null,
  configDir: null,
  theme: 'light',
  isSwitching: false
};
```

### 6.4.3 渲染器 (`renderers.js`)

替代所有 Vue 组件，纯 DOM 操作：

- `initSidebar(onNavigate)` — 侧边栏导航初始化
- `renderProfilesPage()` — 配置目录栏 + 方案卡片网格
- `renderEditorPage(profile?)` — 新建/编辑表单，含 eye 切换 API Key 可见性
- `renderDetailPage(profile)` — 详情面板卡片
- `renderHistoryPage(entries)` — 历史时间线
- `renderSettingsPage()` — 设置页面

## 6.5 组件详细规范

### 6.5.1 Title Bar

- 高度 38px
- 背景 `--color-canvas-parchment` + `backdrop-filter: saturate(180%) blur(20px)`
- `border-bottom: 1px solid var(--color-hairline)`
- `-webkit-app-region: drag`（可拖拽移动窗口）
- 窗口控制按钮 `-webkit-app-region: no-drag`

### 6.5.2 Side Navigation

- 宽度 240px
- 背景 `--color-canvas-parchment` + backdrop-filter blur
- `border-right: 1px solid var(--color-hairline)`
- 顶部: "Providers" 标题 (13px, weight 600, uppercase)
- `fluent-tree-view` 列出 Provider 分组和方案
- 底部: 主题切换按钮

### 6.5.3 Command Bar

- 背景 `--color-canvas`
- `padding: 20px 32px`
- 包含搜索框 + 新建方案按钮 + 启动 Claude Code 按钮
- 按钮使用 pill 圆角 (`--radius-pill`)

### 6.5.4 Profile Card

- 背景 `--color-canvas`
- `border: 1px solid var(--color-hairline)`
- `border-radius: var(--radius-lg)` (18px)
- `padding: 28px`
- Hover: `border-color: rgba(0,0,0,0.15)`
- Active: `transform: scale(0.99)` (Apple 按压效果)
- 头部: 名称 + 蓝色 "使用中" 徽章
- 信息区: Provider、Base URL、Model
- 底部操作: 切换 / 编辑 / 删除按钮

### 6.5.5 Editor Dialog

- `fluent-dialog::part(control)`: `min-width: 520px`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-product)`
- 表单字段:
  - 方案名称 (`fluent-text-field`)
  - 提供商 (`fluent-select`)
  - ANTHROPIC_AUTH_TOKEN (`fluent-text-field` type=password，eye 切换可见性)
  - ANTHROPIC_BASE_URL
  - ANTHROPIC_MODEL
  - 高级环境变量 (可折叠 `<details>`)
    - 动态表格: 变量名 + 值 + 删除按钮
    - "+ 添加变量" 按钮
- 底部按钮: 测试连接 / 保存 / 取消

### 6.5.6 Detail Panel

- 宽度 360px
- 背景 `--color-canvas-parchment` + backdrop-filter blur
- `border-left: 1px solid var(--color-hairline)`
- `padding: 32px 24px`
- JSON 预览: 背景 `--color-canvas`，`border-radius: var(--radius-md)`
- "使用此方案" 按钮: 全宽 pill 按钮

### 6.5.7 Status Bar

- 高度 32px
- 背景 `--color-canvas-parchment` + backdrop-filter blur
- `border-top: 1px solid var(--color-hairline)`
- 显示: 当前激活方案名 + 最后备份时间

### 6.5.8 Toast Notifications

- 位置: 右下角固定
- 左侧有色边框: success 绿色 / error 红色
- 背景 `--color-canvas`，阴影 `var(--shadow-product)`
- 自动 4s 消失

## 6.6 交互规范

### 6.6.1 卡片交互

| 操作 | 效果 |
|---|---|
| 点击卡片（非按钮区） | 展示详情面板 |
| 点击「切换」按钮 | 触发 config:switch，更新激活状态 |
| 点击「编辑」按钮 | 打开 EditorDialog |
| 点击「删除」按钮 | confirm 确认后删除 |
| 悬停卡片 | border-color 加深 |
| 按压卡片 | `transform: scale(0.99)` |

### 6.6.2 切换操作流程

```
用户点击「切换」
  │
  ├─ 卡片显示 loading 状态
  ├─ 调用 window.api.config.switch(id)
  ├─ 等待 IPC 返回
  │   ├─ 成功 → Toast「已切换至方案 xxx」
  │   │       → 更新 activeProfileName
  │   │       → 重新渲染卡片网格
  │   └─ 失败 → Toast「切换失败: xxx」
  └─ 恢复卡片状态
```

### 6.6.3 编辑器交互

1. 点击「新建方案」或「编辑」→ 打开 fluent-dialog
2. 选择提供商 → 自动填充默认 baseURL
3. 点击「测试连接」→ 显示测试结果（不关闭对话框）
4. 点击「保存」→ 验证必填字段 → 提交 IPC → 关闭对话框 + Toast
5. 点击「取消」或点击遮罩 → 关闭对话框

### 6.6.4 搜索过滤

- Toolbar 搜索框输入时实时过滤
- 匹配字段: name, provider, baseUrl, model
- 匹配方式: 不区分大小写子串匹配
- 无结果: 显示空状态提示

### 6.6.5 动画

| 场景 | 动画 | 时长 |
|---|---|---|
| 卡片悬停 | border-color transition | 150ms ease-out |
| 卡片按压 | `transform: scale(0.99)` | — |
| 对话框打开 | fade-in | 200ms ease-out |
| Toast 出现/消失 | slide-in + fade | 250ms / 200ms |
| 详情面板展开 | display toggle | — |

## 6.7 主题切换

通过 `data-theme` 属性控制亮/暗主题：

```css
:root { /* 亮色主题令牌 */ }
[data-theme="dark"] { /* 暗色主题覆盖 */ }
```

`theme.js` 模块:
- 初始化: 读取 `prefers-color-scheme` 系统偏好
- 监听系统主题变化
- 用户手动切换时持久化偏好

## 相关文档

- [IPC 规范](05-ipc-spec.md) — window.api 完整接口定义
- [异常处理](10-exception-handling.md) — UI 错误反馈规范
- [构建与发布](09-build-deploy.md) — Astro 配置和开发工作流
- [00-demo.html](00-demo.html) — Apple 风格 HTML 原型（冻结）
- [11-ui-redesign.md](11-ui-redesign.md) — UI 重新设计文档（冻结）
