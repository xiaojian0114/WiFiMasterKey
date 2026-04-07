const { contextBridge, ipcRenderer } = require("electron");

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld("electronAPI", {

  // ============ WiFi扫描与连接 ============

  /**
   * 扫描附近WiFi网络
   * @returns {Promise<{success: boolean, networks: Array, count: number, message?: string}>}
   */
  scanWifi: () => ipcRenderer.invoke("scan-wifi"),

  /**
   * 获取当前连接状态
   * @returns {Promise<{connected: boolean, ssid: string|null, signal: string|null, state: string}>}
   */
  getCurrentConnection: () => ipcRenderer.invoke("get-current-connection"),

  /**
   * 连接指定WiFi
   * @param {string} ssid - WiFi名称
   * @param {string|null} password - 密码（可选）
   * @returns {Promise<{success: boolean, message: string}>}
   */
  connectWifi: (ssid, password = null) => ipcRenderer.invoke("connect-wifi", ssid, password),

  /**
   * 断开WiFi连接
   * @returns {Promise<{success: boolean, message: string}>}
   */
  disconnectWifi: () => ipcRenderer.invoke("disconnect-wifi"),

  // ============ WiFi密码管理 ============

  /**
   * 获取指定WiFi的保存密码
   * @param {string} ssid - WiFi名称
   * @returns {Promise<{success: boolean, password: string|null}>}
   */
  getWifiPassword: (ssid) => ipcRenderer.invoke("get-wifi-password", ssid),

  /**
   * 获取所有已保存WiFi的密码
   * @returns {Promise<{success: boolean, passwords: Array, count: number}>}
   */
  getAllSavedPasswords: () => ipcRenderer.invoke("get-all-saved-passwords"),

  /**
   * 获取本机已保存的WiFi配置文件列表
   * @returns {Promise<{success: boolean, profiles: Array, count: number}>}
   */
  getSavedProfiles: () => ipcRenderer.invoke("get-saved-profiles"),

  /**
   * 删除指定的WiFi配置文件
   * @param {string} ssid - WiFi名称
   * @returns {Promise<{success: boolean, message: string}>}
   */
  deleteProfile: (ssid) => ipcRenderer.invoke("delete-profile", ssid),

  // ============ 钥匙库管理 ============

  /**
   * 保存钥匙库到本地文件
   * @param {Array} keys - 钥匙数据
   * @returns {Promise<{success: boolean, path?: string, message?: string}>}
   */
  saveKeys: (keys) => ipcRenderer.invoke("save-keys", keys),

  /**
   * 从本地文件加载钥匙库
   * @returns {Promise<{success: boolean, keys: Array}>}
   */
  loadKeys: () => ipcRenderer.invoke("load-keys"),

  /**
   * 导入钥匙库
   * @param {string} fileContent - 文件内容
   * @returns {Promise<{success: boolean, count?: number, message?: string}>}
   */
  importKeys: (fileContent) => ipcRenderer.invoke("import-keys", fileContent),

  /**
   * 导出钥匙库
   * @param {string} format - 格式 'json' 或 'csv'
   * @returns {Promise<{success: boolean, content: string, filename: string}>}
   */
  exportKeys: (format = 'json') => ipcRenderer.invoke("export-keys", format),

  // ============ 连接历史 ============

  /**
   * 获取连接历史记录
   * @returns {Promise<Array>}
   */
  getHistory: () => ipcRenderer.invoke("get-history"),

  /**
   * 清空历史记录
   * @returns {Promise<{success: boolean}>}
   */
  clearHistory: () => ipcRenderer.invoke("clear-history"),

  // ============ 收藏管理 ============

  /**
   * 切换WiFi收藏状态
   * @param {string} ssid - WiFi名称
   * @param {boolean} isFavorite - 是否已收藏
   * @returns {Promise<{success: boolean, favorites: Array}>}
   */
  toggleFavorite: (ssid, isFavorite) => ipcRenderer.invoke("toggle-favorite", ssid, isFavorite),

  /**
   * 获取收藏列表
   * @returns {Promise<Array>}
   */
  getFavorites: () => ipcRenderer.invoke("get-favorites"),

  // ============ 二维码功能 ============

  /**
   * 生成WiFi连接二维码
   * @param {string} ssid - WiFi名称
   * @param {string} password - WiFi密码
   * @param {boolean} hidden - 是否隐藏网络
   * @returns {Promise<{success: boolean, dataUrl?: string, message?: string}>}
   */
  generateQR: (ssid, password, hidden = false) => ipcRenderer.invoke("generate-qr", ssid, password, hidden),

  // ============ 网络诊断 ============

  /**
   * 获取网络接口信息
   * @returns {Promise<{success: boolean, interfaces: Array, message?: string}>}
   */
  getNetworkInfo: () => ipcRenderer.invoke("get-network-info"),

  /**
   * Ping测试
   * @param {string} host - 目标主机
   * @returns {Promise<{success: boolean, output: string, avgTime: number|null, connected: boolean}>}
   */
  pingTest: (host = '8.8.8.8') => ipcRenderer.invoke("ping-test", host),

  /**
   * 诊断WiFi状态
   * @returns {Promise<{success: boolean, hasInterface: boolean, hasProfiles: boolean, hasNetworks: boolean, rawData: string}>}
   */
  diagnoseWifi: () => ipcRenderer.invoke("diagnose-wifi"),

  /**
   * 速度测试
   * @returns {Promise<{success: boolean, latency: number, speed: string}>}
   */
  speedTest: () => ipcRenderer.invoke("speed-test"),

  // ============ 应用配置 ============

  /**
   * 获取应用配置
   * @returns {Promise<Object>}
   */
  getConfig: () => ipcRenderer.invoke("get-config"),

  /**
   * 保存应用配置
   * @param {Object} config - 配置对象
   * @returns {Promise<{success: boolean}>}
   */
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),

  // ============ 系统功能 ============

  /**
   * 显示系统通知
   * @param {string} title - 标题
   * @param {string} body - 内容
   * @returns {Promise<{success: boolean}>}
   */
  showNotification: (title, body) => ipcRenderer.invoke("show-notification", title, body),

  /**
   * 打开外部链接
   * @param {string} url - 链接地址
   * @returns {Promise<{success: boolean}>}
   */
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  /**
   * 获取应用信息
   * @returns {Promise<{version: string, name: string, userDataPath: string}>}
   */
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),

  /**
   * 检查更新
   * @returns {Promise<{success: boolean, hasUpdate: boolean, currentVersion: string, latestVersion: string}>}
   */
  checkUpdate: () => ipcRenderer.invoke("check-update"),

  // ============ 事件监听 ============

  /**
   * 监听主题变化
   * @param {Function} callback - 回调函数 (theme: 'light' | 'dark')
   */
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
  },

  /**
   * 监听托盘扫描请求
   * @param {Function} callback - 回调函数
   */
  onTrayScan: (callback) => {
    ipcRenderer.on('tray-scan', () => callback());
  },

  /**
   * 监听打开设置请求
   * @param {Function} callback - 回调函数
   */
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
  },

  /**
   * 移除所有事件监听
   */
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// 通知渲染进程已准备好
console.log('Preload script loaded successfully');
