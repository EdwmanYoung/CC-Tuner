# 9. 构建与发布

本文档描述 CC-Tuner 的开发工作流、构建配置、跨平台打包和发布策略。

## 9.1 开发工作流

### 9.1.1 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 20 LTS | 运行时 |
| npm | ≥ 10 | 包管理（或 pnpm/yarn） |
| Electron | 28+ | 桌面框架 |

### 9.1.2 package.json scripts

```json
{
  "scripts": {
    "dev": "concurrently \"astro dev\" \"wait-on http://localhost:5174 && electron .\"",
    "build:renderer": "astro build",
    "build:electron": "tsc -p electron/tsconfig.json",
    "build": "npm run build:renderer && npm run build:electron",
    "package": "npm run build && electron-builder",
    "package:win": "npm run build && electron-builder --win",
    "package:mac": "npm run build && electron-builder --mac",
    "package:linux": "npm run build && electron-builder --linux",
    "preview": "electron .",
    "test": "vitest run",
    "test:e2e": "playwright test tests/e2e/",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.vue"
  }
}
```

### 9.1.3 开发模式启动流程

```
npm run dev
  │
  ├─ 1. astro dev              → Vite 启动 http://localhost:5174 (HMR)
  ├─ 2. wait-on http://localhost:5174  → 等待 dev server 就绪
  └─ 3. electron .             → Electron 加载页面
        │
        ├─ main.ts: 创建 BrowserWindow
        ├─ mainWindow.loadURL("http://localhost:5174")
        ├─ registerIpcHandlers()
        └─ preload.ts: contextBridge 注入 window.api
```

### 9.1.4 生产模式启动流程

```
npm run preview
  │
  ├─ main.ts: 创建 BrowserWindow
  ├─ mainWindow.loadFile("dist/index.html")  ← 加载构建产物
  ├─ registerIpcHandlers()
  └─ preload.ts: contextBridge 注入 window.api
```

## 9.2 Astro 配置

**文件**: `src/astro.config.mjs`

```javascript
import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";

export default defineConfig({
  integrations: [vue()],
  outDir: "../dist",       // 输出到项目根目录 dist/
  build: {
    inlineStylesheets: "auto",
  },
  vite: {
    build: {
      target: "esnext",
    },
  },
});
```

**入口页面**: `src/pages/index.astro`

```astro
---
import MainWindow from "../components/MainWindow.vue";
import "../styles/globals.css";
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CC-Tuner</title>
    <script type="module">
      import MainWindow from "../components/MainWindow.vue";
      import { createApp } from "vue";
      import { createPinia } from "pinia";

      const app = createApp(MainWindow);
      app.use(createPinia());
      app.mount("#app");
    </script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

## 9.3 Electron 主进程 TypeScript 配置

**文件**: `electron/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "../dist-electron",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["./**/*.ts"]
}
```

## 9.4 electron-builder 配置

**文件**: `electron-builder.yml`

```yaml
appId: com.cc-tuner.app
productName: CC-Tuner

directories:
  output: release
  buildResources: resources

files:
  - dist/**
  - dist-electron/**
  - package.json

win:
  target:
    - target: nsis
      arch: [x64]
  icon: resources/icon.ico

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  icon: resources/icon.icns
  category: public.app-category.developer-tools

linux:
  target:
    - target: AppImage
      arch: [x64]
    - target: deb
      arch: [x64]
  icon: resources/icon.png
  category: Development

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: CC-Tuner
```

## 9.5 构建产物

执行 `npm run build` 后生成：

```
cc-tuner/
├── dist/                    # Astro 构建的渲染进程静态资源
│   ├── index.html
│   ├── assets/
│   │   ├── index-[hash].css
│   │   └── index-[hash].js
│   └── ...
├── dist-electron/           # TypeScript 编译的主进程代码
│   ├── main.js
│   ├── preload.js
│   ├── ipc/
│   └── services/
└── release/                 # electron-builder 打包产物（npm run package 后）
    ├── CC-Tuner-Setup-x.x.x.exe    # Windows NSIS 安装包
    ├── CC-Tuner-x.x.x.dmg          # macOS DMG
    └── CC-Tuner-x.x.x.AppImage     # Linux AppImage
```

## 9.6 跨平台构建

### Windows

```bash
npm run package:win
```

- 输出: `release/CC-Tuner-Setup-x.x.x.exe` (NSIS 安装包)
- 需要: Windows 环境或 Wine（macOS/Linux 上交叉编译）
- 签名: 使用代码签名证书（`.p12` 文件）

### macOS

```bash
npm run package:mac
```

- 输出: `release/CC-Tuner-x.x.x.dmg`
- 需要: macOS 环境（交叉编译不支持）
- 签名: Apple Developer 证书 + notarization

### Linux

```bash
npm run package:linux
```

- 输出: `release/CC-Tuner-x.x.x.AppImage` + `release/cc-tuner_x.x.x_amd64.deb`
- 通用 x64 Linux 环境即可

## 9.7 版本管理

版本号在 `package.json` 中维护：

```json
{
  "name": "cc-tuner",
  "version": "0.1.0",
  "description": "Claude Code 模型切换工具"
}
```

构建时 electron-builder 自动从 `package.json` 读取版本号。

## 9.8 自动更新（未来）

规划使用 `electron-updater` + GitHub Releases：

```yaml
# electron-builder.yml (追加)
publish:
  provider: github
  owner: <owner>
  repo: cc-tuner
  releaseType: release
```

主进程中配置：

```typescript
import { autoUpdater } from "electron-updater";

autoUpdater.checkForUpdatesAndNotify();
autoUpdater.on("update-available", (info) => {
  mainWindow.webContents.send("update:available", info);
});
```

## 9.9 package.json 完整示例

```json
{
  "name": "cc-tuner",
  "version": "0.1.0",
  "description": "Claude Code 模型切换桌面工具",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "concurrently \"astro dev\" \"wait-on http://localhost:5174 && electron .\"",
    "build:renderer": "astro build",
    "build:electron": "tsc -p electron/tsconfig.json",
    "build": "npm run build:renderer && npm run build:electron",
    "package": "npm run build && electron-builder",
    "package:win": "npm run build && electron-builder --win",
    "package:mac": "npm run build && electron-builder --mac",
    "package:linux": "npm run build && electron-builder --linux",
    "preview": "electron .",
    "test": "vitest run",
    "test:e2e": "playwright test tests/e2e/",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.vue"
  },
  "devDependencies": {
    "@astrojs/vue": "^4.0.0",
    "@fluentui/web-components": "^3.0.0",
    "@playwright/test": "^1.40.0",
    "@vue/test-utils": "^2.4.0",
    "astro": "^4.0.0",
    "concurrently": "^8.2.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "vue": "^3.4.0",
    "wait-on": "^7.2.0"
  },
  "dependencies": {
    "pinia": "^2.1.0"
  }
}
```

## 相关文档

- [系统架构](02-architecture.md) — 项目目录结构和技术选型
- [UI 开发指南](06-ui-guide.md) — Astro + Vue 配置细节
- [测试策略](08-testing.md) — CI 中的测试集成
