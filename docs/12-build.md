根据你描述的技术栈（Electron + Astro + Vue + TypeScript），开发后的打包主要可以分为两步：**先将前端项目构建为静态文件，再用打包工具将其封装成可执行程序**。

我整理了两种社区常见的方案，你可以根据自己的项目情况来选择。

### 🚀 方案对比

| 方案 | 核心工具 | 优点 | 适用场景 |
| :--- | :--- | :--- | :--- |
| **方案一：专用 Astro 集成** | `astro-electron` 或 `astro-electron-ts` | 集成度高，专为 Astro 优化，配置相对自动化。 | **新建 Astro 项目**，或希望以 Astro 为核心构建桌面应用的项目。 |
| **方案二：通用 Vite 插件** | `vite-plugin-electron` | 灵活性高，适用于任何基于 Vite 的项目，生态成熟，社区更大。 | **已有基于 Vite 的 Vue 项目**，或需要更精细控制的复杂项目。 |

这两种方案只是项目集成的思路不同，最终打包时，都推荐使用 **`electron-builder`** 这款主流且功能强大的工具。

### 🛠️ 方案一：使用专用 Astro 集成 (以 `astro-electron-ts` 为例)

这种方式能让你的 Astro 项目直接具备 Electron 能力。

#### 1. 安装依赖
在项目根目录下，使用你喜欢的包管理器安装以下依赖：
```bash
npm install astro-electron-ts electron -D
# 或
yarn add astro-electron-ts electron -D
# 或
pnpm add astro-electron-ts electron -D
```

#### 2. 集成配置
在 `astro.config.ts` 文件中，引入并注册该集成：
```typescript
import { defineConfig } from 'astro/config';
import electron from 'astro-electron-ts';

export default defineConfig({
  integrations: [electron()],
});
```
同时，确保在 `package.json` 中指定 Electron 的入口文件：
```json
{
  "main": "dist-electron/main.js"
}
```

#### 3. 创建 Electron 主进程文件
在 `electron/main.ts` 文件中，编写创建窗口和加载应用的逻辑。这是一个**最小化示例**，你可以按需扩展：
```typescript
// electron/main.ts
import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  // 生产环境加载 Astro 构建的静态页面
  win.loadFile(path.join(__dirname, '../dist/index.html'));
  
  // 开发环境可以加载开发服务器地址，这里略
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});
```
**重要提示**：为了确保应用离线可用，请务必将项目中的路由模式设置为 **`hash` 模式**。

#### 4. 打包应用
在 `package.json` 中添加打包脚本，并执行：
```json
"scripts": {
  "build:app": "npm run build && electron-builder"
}
```
*   `npm run build`：先通过 Astro 构建你的前端资源，生成 `dist` 目录。
*   `electron-builder`：将该目录与 Electron 核心文件打包成可执行程序。

> **注意**：`astro-electron-ts` 集成 **不负责最终的打包步骤**，你需要像下面介绍的那样配置 `electron-builder`。

### ⚙️ 方案二：使用通用 Vite 插件 (以 `vite-plugin-electron` 为例)

这种方式更灵活，你在 Vue + Vite 项目中的既有经验可以无缝迁移。

#### 1. 安装依赖
```bash
npm install electron electron-builder vite-plugin-electron -D
```

#### 2. 集成配置
在 `vite.config.ts` 中配置插件，明确指定 Electron 主进程和预加载脚本的入口文件：
```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        // 主进程入口
        entry: 'electron-main/index.ts',
      },
      {
        // 预加载脚本入口
        entry: 'electron-preload/preload.ts',
        onstart(args) {
          args.reload();
        },
      },
    ]),
  ],
});
```

#### 3. 创建 Electron 主进程与预加载文件
与方案一类似，需要创建 `electron-main/index.ts` 和 `electron-preload/preload.ts` 文件，并编写相应的逻辑。同样，**记得将路由模式设为 `hash` 模式**。

#### 4. 打包应用
在 `package.json` 中配置打包脚本：
```json
"scripts": {
  "dev": "vite",
  "build": "vue-tsc --noEmit && vite build",
  "build:app": "npm run build && electron-builder"
}
```

### 📦 最终打包：配置 `electron-builder`

无论采用哪种方案，最终的打包步骤都需要 `electron-builder`。它通过读取你 `package.json` 中的配置来决定如何生成安装包。

```json
// package.json
{
  "name": "your-app-name",
  "version": "1.0.0",
  "main": "dist-electron/main.js", // 确保指向 Electron 主进程文件
  "scripts": {
    "build": "...",
    "build:app": "npm run build && electron-builder"
  },
  "build": {
    "appId": "com.yourcompany.yourapp",
    "productName": "你的应用名称",
    "directories": {
      "output": "release"
    },
    // Windows 平台配置
    "win": {
      "icon": "build/icon.ico",
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ]
    },
    // macOS 平台配置
    "mac": {
      "icon": "build/icon.icns",
      "target": ["dmg", "zip"]
    },
    // Linux 平台配置
    "linux": {
      "icon": "build/icons",
      "target": ["AppImage", "deb", "rpm"]
    }
  }
}
```
**Windows 上更详细的 nsis 配置示例**：
```json
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true
}
```
配置完成后，执行 `npm run build:app`，构建产物将出现在 `release` 目录中。你可以根据目标平台，使用 `electron-builder --win`、`electron-builder --mac` 或 `electron-builder --linux` 命令进行针对性打包。

### 💡 常见问题与避坑指南
*   **Electron 下载失败**：配置国内镜像源可加速下载。
*   **打包后应用白屏**：检查路由模式是否为 `hash` 模式，并确保 `vite.config.ts` 中的 `base` 配置正确。
*   **TypeScript 编译问题**：确保相关目录（如 `electron-main/`）已被 `tsconfig.json` 的 `include` 字段包含。
*   **文件访问权限错误**：打包前确保关闭所有已打开的应用进程和文件夹，避免文件被占用。

如果还想了解关于代码签名、自动更新等高级功能的配置，可以再随时问我。