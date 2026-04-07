# WiFiMasterKey - Electron 学习项目

> 本项目仅用于学习 Electron 桌面应用开发，请勿用于非法用途。

## 项目简介

这是一个基于 Electron 的 WiFi 管理工具学习项目，展示了如何使用 Node.js 原生模块与系统 API 进行交互。

**仅供学习参考**，WiFi 密码管理请使用系统自带功能或官方工具。

## 技术栈

- Electron - 桌面应用框架
- Node.js - 后端逻辑
- HTML/CSS/JavaScript - 前端界面

## 主要功能（学习目的）

- 扫描附近 WiFi 网络（调用系统 netsh 命令）
- 查看已保存的 WiFi 配置文件
- 界面交互设计学习

## 安全说明

⚠️ **重要提示**：

1. 本项目仅学习 Electron 桌面应用开发
2. WiFi 密码存储在系统中，请勿将密码上传到任何网络
3. 尊重他人网络隐私，不要尝试连接未授权的网络
4. 请勿将本项目用于任何商业或非法目的

## 安装与运行

```bash
# 安装依赖
npm install

# 运行开发模式（需要管理员权限）
npm run dev

# 打包应用
npm run build
```

## 权限说明

WiFi 扫描功能需要管理员权限运行程序。

### Windows PowerShell 方式

1. 右键点击 PowerShell → "以管理员身份运行"
2. 进入项目目录
3. 执行 `npm run dev`

## 免责声明

本项目作者不对任何滥用行为负责。使用本项目即表示您同意：

- 仅将本项目用于学习目的
- 不使用本项目进行任何违法活动
- 尊重网络隐私和安全

## 项目结构

```
WiFiMasterKey-Electron/
├── src/
│   ├── main/         # 主进程代码
│   ├── preload/      # 预加载脚本
│   └── renderer/     # 渲染进程（界面）
├── assets/          # 资源文件
└── package.json     # 项目配置
```

## License

MIT License - 仅供学习使用
