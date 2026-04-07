const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

// ============ 全局变量 ============
let mainWindow = null;
let tray = null;
let isQuitting = false;
let isDarkMode = false;

// 用户数据目录
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');
const historyPath = path.join(userDataPath, 'wifi-history.json');
const favoritesPath = path.join(userDataPath, 'wifi-favorites.json');

// ============ 配置文件读写 ============
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {}
  return { darkMode: false, autoStart: false, minimizeToTray: true, notifications: true };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('保存配置失败:', e);
  }
}

function loadHistory() {
  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  } catch (e) {}
}

function loadFavorites() {
  try {
    if (fs.existsSync(favoritesPath)) {
      return JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveFavorites(favorites) {
  try {
    fs.writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2));
  } catch (e) {}
}

// ============ 窗口管理 ============
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: "WiFi万能钥匙",
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false,
    backgroundColor: '#1a1a2e'
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const config = loadConfig();
    if (config.darkMode) {
      isDarkMode = true;
      mainWindow.webContents.send('theme-changed', 'dark');
    }
  });

  mainWindow.on('close', (event) => {
    const config = loadConfig();
    if (!isQuitting && config.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
      showTrayNotification('已最小化到系统托盘', 'WiFi万能钥匙仍在后台运行');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // mainWindow.webContents.openDevTools(); // 调试时取消注释
}

// ============ 系统托盘 ============
function createTray() {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  let trayIcon;

  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // 创建默认图标
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon.isEmpty() ? createDefaultIcon() : trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '扫描WiFi',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('tray-scan');
        }
      }
    },
    {
      label: '当前连接状态',
      click: async () => {
        const status = await getCurrentConnection();
        showTrayNotification('当前连接', status.ssid ? `${status.ssid} (${status.signal})` : '未连接');
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('open-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('WiFi万能钥匙');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createDefaultIcon() {
  // 创建一个简单的默认图标
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 25;     // R
    canvas[i * 4 + 1] = 118; // G
    canvas[i * 4 + 2] = 210; // B
    canvas[i * 4 + 3] = 255; // A
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function showTrayNotification(title, body) {
  const config = loadConfig();
  if (config.notifications && Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

// ============ 应用生命周期 ============
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// ============ 工具函数 ============

// 解析WiFi信号强度为百分比
function parseSignalToPercent(signalStr) {
  if (!signalStr) return 0;
  const match = signalStr.match(/(\d+)%/);
  if (match) return parseInt(match[1]);

  const numMatch = signalStr.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1]);
    if (num <= 100) return num;
    if (num <= 100) return num; // RSSI: -100 to -30
    return Math.max(0, Math.min(100, (num + 100) * 100 / 70));
  }
  return 50;
}

// 获取信号等级 (1-5)
function getSignalLevel(percent) {
  if (percent >= 80) return 5;
  if (percent >= 60) return 4;
  if (percent >= 40) return 3;
  if (percent >= 20) return 2;
  return 1;
}

// 解析WiFi网络列表
function parseWifiNetworks(output) {
  const networks = [];
  const lines = output.split('\n');
  let current = {};

  lines.forEach(line => {
    line = line.trim();

    // SSID 检测 (兼容中英文)
    const ssidMatch = line.match(/^SSID\s*\d*\s*:\s*(.+)$/i);
    if (ssidMatch) {
      if (current.SSID) networks.push({...current});
      current = {
        SSID: ssidMatch[1].trim() || '隐藏网络',
        isHidden: !ssidMatch[1].trim(),
        id: crypto.randomUUID()
      };
    }

    // BSSID (MAC地址)
    if (line.includes('BSSID')) {
      const mac = line.split(':').slice(1).join(':').trim();
      if (!current.bssid) current.bssid = mac;
    }

    // 信号强度
    if (line.includes('信号') || line.includes('Signal')) {
      const signalStr = line.split(':').slice(1).join(':').trim();
      current.rawSignal = signalStr;
      current.signalPercent = parseSignalToPercent(signalStr);
      current.signalLevel = getSignalLevel(current.signalPercent);
    }

    // 加密类型
    if (line.includes('加密') || line.includes('Encryption')) {
      current.encryption = line.split(':').slice(1).join(':').trim() || '未知';
    }

    // 认证方式
    if (line.includes('身份验证') || line.includes('Authentication')) {
      current.auth = line.split(':').slice(1).join(':').trim() || '未知';
    }

    // 网络类型
    if (line.includes('网络类型') || line.includes('Network type')) {
      current.type = line.split(':').slice(1).join(':').trim() || '未知';
    }

    // 频段
    if (line.includes('无线电类型') || line.includes('Radio type')) {
      current.band = line.split(':').slice(1).join(':').trim() || '未知';
    }
  });

  if (current.SSID) networks.push(current);

  // 按信号强度排序
  networks.sort((a, b) => (b.signalPercent || 0) - (a.signalPercent || 0));

  return networks;
}

// 获取当前连接状态
function getCurrentConnection() {
  return new Promise((resolve) => {
    exec('netsh wlan show interfaces', { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        resolve({ connected: false, ssid: null, signal: null });
        return;
      }

      const lines = stdout.split('\n');
      let result = { connected: false, ssid: null, signal: null, state: '未知' };

      lines.forEach(line => {
        line = line.trim();
        if (line.includes('SSID') && !line.includes('BSSID')) {
          result.ssid = line.split(':').slice(1).join(':').trim() || null;
          result.connected = !!result.ssid;
        }
        if (line.includes('状态') || line.includes('State')) {
          result.state = line.split(':').slice(1).join(':').trim() || '未知';
        }
        if (line.includes('信号') || line.includes('Signal')) {
          result.signal = line.split(':').slice(1).join(':').trim() || null;
          result.signalPercent = parseSignalToPercent(result.signal);
        }
        if (line.includes('身份验证') || line.includes('Authentication')) {
          result.auth = line.split(':').slice(1).join(':').trim() || null;
        }
        if (line.includes('配置文件') || line.includes('Profile')) {
          result.profile = line.split(':').slice(1).join(':').trim() || null;
        }
      });

      resolve(result);
    });
  });
}

// 获取已保存的WiFi密码
function getSavedWifiPassword(ssid) {
  return new Promise((resolve) => {
    exec(`netsh wlan show profile name="${ssid}" key=clear`, { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        resolve({ success: false, password: null });
        return;
      }

      const lines = stdout.split('\n');
      let password = null;

      lines.forEach(line => {
        if (line.includes('关键内容') || line.includes('Key Content')) {
          password = line.split(':').slice(1).join(':').trim();
        }
      });

      resolve({ success: !!password, password });
    });
  });
}

// ============ IPC 处理器 ============

// 1. 扫描附近WiFi
ipcMain.handle('scan-wifi', async () => {
  return new Promise((resolve) => {
    exec('netsh wlan show networks mode=bssid', { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          message: '扫描失败。请以管理员身份运行程序！',
          details: stderr || error.message,
          rawData: stdout || ''
        });
        return;
      }

      // 调试：输出原始数据
      console.log('=== WiFi扫描原始输出 ===');
      console.log(stdout);
      console.log('=========================');

      const networks = parseWifiNetworks(stdout);
      resolve({
        success: true,
        rawData: stdout,
        networks: networks,
        count: networks.length
      });
    });
  });
});

// 诊断WiFi状态
ipcMain.handle('diagnose-wifi', async () => {
  return new Promise((resolve) => {
    exec('netsh wlan show all', { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        resolve({
          success: false,
          message: '诊断失败: ' + error.message,
          rawData: ''
        });
        return;
      }

      // 检查关键信息
      const hasInterface = stdout.includes('接口') || stdout.includes('Interface');
      const hasProfiles = stdout.includes('配置文件') || stdout.includes('Profile');
      const hasNetworks = stdout.includes('网络') || stdout.includes('Network');

      resolve({
        success: true,
        hasInterface,
        hasProfiles,
        hasNetworks,
        rawData: stdout,
        message: `诊断完成 - 接口:${hasInterface}, 配置文件:${hasProfiles}, 网络:${hasNetworks}`
      });
    });
  });
});

// 2. 获取当前连接状态
ipcMain.handle('get-current-connection', async () => {
  const status = await getCurrentConnection();
  return status;
});

// 3. 获取本机已保存WiFi列表
ipcMain.handle('get-saved-profiles', async () => {
  return new Promise((resolve) => {
    exec('netsh wlan show profiles', { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        resolve({ success: false, message: error.message, profiles: [] });
        return;
      }

      const profiles = [];
      const lines = stdout.split('\n');
      lines.forEach(line => {
        const match = line.match(/:\s*(.+)$/);
        if (match && (line.includes('所有用户配置文件') || line.includes('All User Profile'))) {
          profiles.push(match[1].trim());
        }
      });

      resolve({ success: true, profiles, count: profiles.length });
    });
  });
});

// 4. 获取指定WiFi的密码
ipcMain.handle('get-wifi-password', async (event, ssid) => {
  const result = await getSavedWifiPassword(ssid);
  if (result.success) {
    showTrayNotification('密码获取成功', `${ssid}: ${result.password}`);
  }
  return result;
});

// 5. 批量获取已保存WiFi的密码
ipcMain.handle('get-all-saved-passwords', async () => {
  return new Promise((resolve) => {
    exec('netsh wlan show profiles', { encoding: 'utf8' }, async (error, stdout) => {
      if (error) {
        resolve({ success: false, message: error.message, passwords: [] });
        return;
      }

      const profiles = [];
      const lines = stdout.split('\n');
      lines.forEach(line => {
        const match = line.match(/:\s*(.+)$/);
        if (match && (line.includes('所有用户配置文件') || line.includes('All User Profile'))) {
          profiles.push(match[1].trim());
        }
      });

      const passwords = [];
      for (const profile of profiles) {
        const result = await getSavedWifiPassword(profile);
        if (result.success) {
          passwords.push({ ssid: profile, password: result.password });
        }
      }

      resolve({ success: true, passwords, count: passwords.length });
    });
  });
});

// 6. 连接WiFi
ipcMain.handle('connect-wifi', async (event, ssid, password = null) => {
  return new Promise((resolve) => {
    const addHistory = (status) => {
      const history = loadHistory();
      history.unshift({
        id: crypto.randomUUID(),
        ssid,
        status,
        timestamp: new Date().toISOString()
      });
      // 只保留最近100条
      saveHistory(history.slice(0, 100));
    };

    if (password) {
      // 先添加配置文件再连接
      exec(`netsh wlan add profile filename="${path.join(userDataPath, 'temp.xml')}"`, () => {
        // 尝试连接
        exec(`netsh wlan connect name="${ssid}"`, (error) => {
          if (error) {
            addHistory('failed');
            resolve({ success: false, message: `连接失败: ${error.message}` });
          } else {
            addHistory('success');
            showTrayNotification('连接成功', `已连接到 ${ssid}`);
            resolve({ success: true, message: `正在连接到 ${ssid}...` });
          }
        });
      });
    } else {
      exec(`netsh wlan connect name="${ssid}"`, (error) => {
        if (error) {
          addHistory('failed');
          resolve({ success: false, message: `连接失败: ${error.message}` });
        } else {
          addHistory('success');
          showTrayNotification('连接请求已发送', `正在连接到 ${ssid}`);
          resolve({ success: true, message: `正在连接到 ${ssid}...` });
        }
      });
    }
  });
});

// 7. 断开WiFi
ipcMain.handle('disconnect-wifi', async () => {
  return new Promise((resolve) => {
    exec('netsh wlan disconnect', { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        resolve({ success: false, message: error.message });
      } else {
        showTrayNotification('已断开连接', 'WiFi已断开');
        resolve({ success: true, message: '已断开WiFi连接' });
      }
    });
  });
});

// 8. 删除WiFi配置文件
ipcMain.handle('delete-profile', async (event, ssid) => {
  return new Promise((resolve) => {
    exec(`netsh wlan delete profile name="${ssid}"`, { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        resolve({ success: false, message: error.message });
      } else {
        resolve({ success: true, message: `已删除 ${ssid} 的配置文件` });
      }
    });
  });
});

// 9. 获取连接历史
ipcMain.handle('get-history', async () => {
  return loadHistory();
});

// 10. 清空历史记录
ipcMain.handle('clear-history', async () => {
  saveHistory([]);
  return { success: true };
});

// 11. 收藏/取消收藏WiFi
ipcMain.handle('toggle-favorite', async (event, ssid, isFavorite) => {
  let favorites = loadFavorites();
  if (isFavorite) {
    favorites = favorites.filter(f => f !== ssid);
  } else {
    favorites.push(ssid);
  }
  saveFavorites(favorites);
  return { success: true, favorites };
});

// 12. 获取收藏列表
ipcMain.handle('get-favorites', async () => {
  return loadFavorites();
});

// 13. 保存钥匙库
ipcMain.handle('save-keys', async (event, keys) => {
  try {
    const filePath = path.join(userDataPath, 'wifi-keys.json');
    fs.writeFileSync(filePath, JSON.stringify(keys, null, 2));
    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// 14. 加载钥匙库
ipcMain.handle('load-keys', async () => {
  try {
    const filePath = path.join(userDataPath, 'wifi-keys.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return { success: true, keys: JSON.parse(data) };
    }
    return { success: true, keys: [] };
  } catch (e) {
    return { success: false, keys: [] };
  }
});

// 15. 导入钥匙库
ipcMain.handle('import-keys', async (event, fileContent) => {
  try {
    const imported = JSON.parse(fileContent);
    if (!Array.isArray(imported)) {
      return { success: false, message: '文件格式错误' };
    }
    const current = loadHistory().map(h => h.ssid);
    const newKeys = imported.filter(k => !current.includes(k.ssid));
    saveHistory([...newKeys.map(ssid => ({ ssid, timestamp: new Date().toISOString() })), ...loadHistory()]);
    return { success: true, count: newKeys.length };
  } catch (e) {
    return { success: false, message: '解析文件失败: ' + e.message };
  }
});

// 16. 导出钥匙库
ipcMain.handle('export-keys', async (event, format = 'json') => {
  const history = loadHistory();
  const passwords = [];

  for (const item of history) {
    const result = await getSavedWifiPassword(item.ssid);
    if (result.success) {
      passwords.push({
        ssid: item.ssid,
        password: result.password,
        lastConnected: item.timestamp
      });
    }
  }

  if (format === 'csv') {
    let csv = 'SSID,密码,最后连接时间\n';
    passwords.forEach(p => {
      csv += `"${p.ssid}","${p.password}","${p.lastConnected}"\n`;
    });
    return { success: true, content: csv, filename: 'WiFi钥匙库.csv' };
  }

  return {
    success: true,
    content: JSON.stringify(passwords, null, 2),
    filename: 'WiFi钥匙库.json'
  };
});

// 17. 获取/保存配置
ipcMain.handle('get-config', async () => {
  return loadConfig();
});

ipcMain.handle('save-config', async (event, config) => {
  saveConfig(config);
  if (config.darkMode !== undefined) {
    isDarkMode = config.darkMode;
    if (mainWindow) {
      mainWindow.webContents.send('theme-changed', config.darkMode ? 'dark' : 'light');
    }
  }
  return { success: true };
});

// 18. 打开外部链接
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

// 19. 获取应用信息
ipcMain.handle('get-app-info', async () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    userDataPath: userDataPath
  };
});

// 20. 显示系统通知
ipcMain.handle('show-notification', async (event, title, body) => {
  showTrayNotification(title, body);
  return { success: true };
});

// 21. 检查更新（模拟）
ipcMain.handle('check-update', async () => {
  return {
    success: true,
    hasUpdate: false,
    currentVersion: app.getVersion(),
    latestVersion: app.getVersion()
  };
});

// 22. 生成WiFi二维码
ipcMain.handle('generate-qr', async (event, ssid, password, hidden = false) => {
  const QRCode = require('qrcode');
  try {
    // WiFi二维码格式: WIFI:T:WPA;S:<SSID>;P:<PASSWORD>;;
    const wifiString = `WIFI:T:WPA;S:${ssid};P:${password};H:${hidden ? 'true' : 'false'};;`;
    const dataUrl = await QRCode.toDataURL(wifiString, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    return { success: true, dataUrl };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// 23. 获取网络接口信息
ipcMain.handle('get-network-info', async () => {
  return new Promise((resolve) => {
    exec('ipconfig /all', { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        resolve({ success: false, message: error.message });
        return;
      }

      const info = {
        success: true,
        interfaces: []
      };

      const adapters = stdout.split(/\n\n/);
      adapters.forEach(adapter => {
        const lines = adapter.split('\n');
        let name = '';
        let ipv4 = '';
        let mac = '';

        lines.forEach(line => {
          if (line.includes('适配器') || line.includes('adapter')) {
            const match = line.match(/适配器\s+(.+?)\s*:|adapter\s+(.+?)\s*:/i);
            if (match) name = match[1] || match[2];
          }
          if (line.includes('IPv4') && !line.includes('地址') && line.includes(':')) {
            ipv4 = line.split(':').slice(1).join(':').trim();
          }
          if ((line.includes('物理地址') || line.includes('Physical')) && line.includes(':')) {
            mac = line.split(':').slice(1).join(':').trim();
          }
        });

        if (name && ipv4) {
          info.interfaces.push({ name, ipv4, mac });
        }
      });

      resolve(info);
    });
  });
});

// 24. Ping测试
ipcMain.handle('ping-test', async (event, host = '8.8.8.8') => {
  return new Promise((resolve) => {
    exec(`ping -n 4 ${host}`, { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        resolve({ success: false, message: error.message });
        return;
      }

      const lines = stdout.split('\n');
      let avgTime = null;

      lines.forEach(line => {
        const match = line.match(/平均[=:]\s*(\d+)ms|Average\s*=\s*(\d+)ms/i);
        if (match) {
          avgTime = parseInt(match[1] || match[2]);
        }
      });

      resolve({
        success: true,
        output: stdout,
        avgTime,
        connected: avgTime !== null && avgTime < 500
      });
    });
  });
});

// 25. 速度测试（简单延迟测试）
ipcMain.handle('speed-test', async () => {
  const start = Date.now();
  return new Promise((resolve) => {
    exec('curl -s -o /dev/null -w "%{time_total}" https://www.google.com', { encoding: 'utf8', timeout: 10000 }, (error, stdout) => {
      if (error) {
        // fallback到ping测试
        exec('ping -n 1 114.114.114.114', { encoding: 'utf8' }, (err, out) => {
          const time = Date.now() - start;
          resolve({
            success: true,
            latency: time,
            speed: time < 50 ? '快' : time < 150 ? '一般' : '慢'
          });
        });
        return;
      }

      const time = parseFloat(stdout) * 1000;
      resolve({
        success: true,
        latency: Math.round(time),
        speed: time < 100 ? '快' : time < 300 ? '一般' : '慢'
      });
    });
  });
});

console.log('WiFi万能钥匙 Electron版 已启动');
