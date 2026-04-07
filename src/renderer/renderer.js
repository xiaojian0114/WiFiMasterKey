const dictionary = [
  "12345678",
  "password",
  "123456789",
  "admin",
  "88888888",
  "qwerty",
  "abc123456",
  "11111111",
  "123123123",
  "letmein",
  "welcome",
];

let knownKeys = [];
let wifiNetworks = [];
let savedProfiles = [];
let currentConnection = null;
let currentFilter = 'all';

function log(msg, success = false) {
  const div = document.getElementById("log");
  const time = new Date().toLocaleTimeString();
  const color = success ? "#66ff99" : "#ffcc66";
  div.innerHTML += `<span style="color:${color}">[${time}] ${msg}</span><br>`;
  div.scrollTop = div.scrollHeight;
}

async function scanWifi() {
  const list = document.getElementById("wifiList");
  const countBadge = document.getElementById("wifiCount");
  list.innerHTML = '<div class="loading"><div class="spinner"></div>正在扫描WiFi...</div>';
  countBadge.textContent = "扫描中...";

  try {
    const res = await window.electronAPI.scanWifi();
    wifiNetworks = [];

    if (res.success && res.networks && res.networks.length > 0) {
      wifiNetworks = res.networks;
      countBadge.textContent = wifiNetworks.length + " 个网络";
      renderWifiList();
      updateConnectionStatus();
      showToast(`发现 ${wifiNetworks.length} 个WiFi网络`, "success");
    } else if (res.success && (!res.networks || res.networks.length === 0)) {
      // 扫描成功但没数据，尝试诊断
      console.log('原始输出:', res.rawData);
      list.innerHTML = '<div class="empty-state"><p>未发现附近WiFi网络</p><button class="btn btn-secondary" onclick="runDiagnostics()">运行诊断</button></div>';
      countBadge.textContent = "0 个网络";
    } else {
      list.innerHTML = '<div class="empty-state"><p>' + (res.message || "扫描失败") + '</p></div>';
      countBadge.textContent = "0 个网络";
      if (res.message && res.message.includes("管理员")) {
        showToast("请以管理员身份运行程序！", "error");
      }
    }
  } catch (e) {
    list.innerHTML = '<div class="empty-state"><p>调用失败: ' + e.message + '</p></div>';
    countBadge.textContent = "错误";
  }
}

async function runDiagnostics() {
  try {
    const res = await window.electronAPI.diagnoseWifi();
    console.log('诊断结果:', res);
    alert('诊断信息:\n' + res.message + '\n\n详情请查看控制台 (F12)');
  } catch (e) {
    showToast('诊断失败: ' + e.message, 'error');
  }
}

function renderWifiList() {
  const list = document.getElementById("wifiList");
  const search = document.getElementById("searchInput").value.toLowerCase();
  const currentSSID = currentConnection ? currentConnection.ssid : null;

  let filtered = wifiNetworks.filter(net => {
    const matchSearch = net.SSID.toLowerCase().includes(search);
    let matchFilter = true;

    if (currentFilter === 'secure') {
      matchFilter = net.auth && !net.auth.toLowerCase().includes('open') && !net.auth.toLowerCase().includes('none');
    } else if (currentFilter === 'open') {
      matchFilter = !net.auth || net.auth.toLowerCase().includes('open') || net.auth.toLowerCase().includes('none');
    } else if (currentFilter === '5g') {
      matchFilter = net.band && (net.band.includes('5') || net.band.toLowerCase().includes('802.11a'));
    } else if (currentFilter === 'saved') {
      matchFilter = savedProfiles.includes(net.SSID);
    }

    return matchSearch && matchFilter;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>没有匹配的WiFi</p></div>';
    return;
  }

  list.innerHTML = filtered.map(net => {
    const isConnected = net.SSID === currentSSID;
    const isSaved = savedProfiles.includes(net.SSID);
    const signalLevel = net.signalLevel || 1;
    const signalBars = Array(4).fill(0).map((_, i) =>
      `<div class="signal-bar ${i < signalLevel ? 'active' : ''}"></div>`
    ).join('');

    return `
      <div class="wifi-item ${isConnected ? 'connected' : ''}">
        <div class="wifi-icon">
          <svg viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
        </div>
        <div class="wifi-info">
          <div class="wifi-name">
            ${escapeHtml(net.SSID)}
            ${isConnected ? '<span class="wifi-badge connected">已连接</span>' : ''}
            ${isSaved ? '<span class="wifi-badge saved">已保存</span>' : ''}
          </div>
          <div class="wifi-meta">
            <span>
              <div class="signal-bars level-${signalLevel}">${signalBars}</div>
              ${net.signalPercent || 0}%
            </span>
            <span>${net.auth || net.encryption || '未知'}</span>
          </div>
        </div>
        <div class="wifi-actions">
          ${isConnected
            ? '<button class="btn btn-sm btn-secondary" onclick="disconnectWifi()">断开</button>'
            : '<button class="btn btn-sm btn-primary" onclick="showConnectDialog(\'' + escapeHtml(net.SSID) + '\')">连接</button>'
          }
          <button class="btn btn-sm btn-secondary" onclick="showQRCode(\'' + escapeHtml(net.SSID) + '\')">二维码</button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });
  renderWifiList();
}

function filterWifiList() {
  renderWifiList();
}

async function updateConnectionStatus() {
  try {
    const res = await window.electronAPI.getCurrentConnection();
    currentConnection = res.connected ? res : null;

    const statusDot = document.getElementById("statusDot");
    const statusText = document.getElementById("connectionStatus");
    const currentSSID = document.getElementById("currentSSID");
    const currentStatus = document.getElementById("currentStatus");
    const disconnectBtn = document.getElementById("disconnectBtn");

    if (res.connected) {
      statusDot.classList.add("connected");
      statusText.textContent = res.ssid;
      currentSSID.textContent = res.ssid;
      currentStatus.textContent = `信号: ${res.signal || '未知'} | ${res.auth || ''}`;
      disconnectBtn.style.display = "block";
    } else {
      statusDot.classList.remove("connected");
      statusText.textContent = "未连接";
      currentSSID.textContent = "未连接";
      currentStatus.textContent = "点击WiFi即可连接";
      disconnectBtn.style.display = "none";
    }

    renderWifiList();
  } catch (e) {
    console.error("更新连接状态失败:", e);
  }
}

async function showConnectDialog(ssid) {
  if (savedProfiles.includes(ssid)) {
    const result = await window.electronAPI.connectWifi(ssid);
    showToast(result.message, result.success ? "success" : "error");
    if (result.success) {
      setTimeout(updateConnectionStatus, 1000);
    }
  } else {
    const password = prompt(`连接 ${ssid}\n请输入密码:`);
    if (password !== null) {
      const result = await window.electronAPI.connectWifi(ssid, password);
      showToast(result.message, result.success ? "success" : "error");
      if (result.success) {
        setTimeout(updateConnectionStatus, 1000);
      }
    }
  }
}

async function quickConnect() {
  const ssid = document.getElementById("quickSSID").value.trim();
  const password = document.getElementById("quickPassword").value;

  if (!ssid) {
    showToast("请输入WiFi名称", "warning");
    return;
  }

  const result = await window.electronAPI.connectWifi(ssid, password || null);
  showToast(result.message, result.success ? "success" : "error");
  if (result.success) {
    setTimeout(updateConnectionStatus, 1000);
  }
}

async function disconnectWifi() {
  const result = await window.electronAPI.disconnectWifi();
  showToast(result.message, result.success ? "success" : "error");
  if (result.success) {
    setTimeout(updateConnectionStatus, 500);
  }
}

async function showSavedProfiles() {
  try {
    const res = await window.electronAPI.getSavedProfiles();
    if (res.success) {
      savedProfiles = res.profiles || [];
      document.getElementById("savedCount").textContent = savedProfiles.length;
      renderWifiList();
      showToast(`已加载 ${savedProfiles.length} 个已保存网络`, "success");
    } else {
      showToast(res.message || "加载失败", "error");
    }
  } catch (e) {
    showToast("加载失败: " + e.message, "error");
  }
}

let qrData = { ssid: '', password: '', hidden: false };

async function showQRCode(ssid) {
  const modal = document.getElementById("qrModal");
  const qrImage = document.getElementById("qrImage");
  const qrTitle = document.getElementById("qrTitle");
  const qrInfo = document.getElementById("qrInfo");

  qrTitle.textContent = ssid;
  qrImage.src = "";
  qrInfo.textContent = "正在获取密码...";
  modal.classList.add("active");

  try {
    const res = await window.electronAPI.getWifiPassword(ssid);
    qrData.ssid = ssid;
    qrData.password = res.password || "";
    qrData.hidden = false;

    if (res.success && res.password) {
      qrInfo.textContent = `密码: ${res.password}`;
      const qrRes = await window.electronAPI.generateQR(ssid, res.password);
      if (qrRes.success && qrRes.dataUrl) {
        qrImage.src = qrRes.dataUrl;
      }
    } else {
      qrInfo.textContent = "未找到保存的密码";
    }
  } catch (e) {
    qrInfo.textContent = "获取密码失败: " + e.message;
  }
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

function downloadQR() {
  if (!qrData.ssid) return;
  const link = document.createElement("a");
  link.download = `WiFi_${qrData.ssid}_二维码.png`;
  link.href = document.getElementById("qrImage").src;
  link.click();
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMessage");
  toastMsg.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById("quickPassword");
  const eyeIcon = document.getElementById("eyeIcon");
  if (pwdInput.type === "password") {
    pwdInput.type = "text";
    eyeIcon.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
  } else {
    pwdInput.type = "password";
    eyeIcon.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", newTheme);

  const config = { darkMode: newTheme === "dark" };
  window.electronAPI.saveConfig(config);
  window.electronAPI.showNotification("主题已切换", newTheme === "dark" ? "深色模式" : "浅色模式");
}

function clearHistory() {
  if (confirm("确定清空所有历史记录？")) {
    window.electronAPI.clearHistory();
    document.getElementById("historyList").innerHTML = '<div class="empty-state"><p>暂无历史记录</p></div>';
    document.getElementById("historyCount").textContent = "0";
    showToast("历史记录已清空", "success");
  }
}

async function loadHistory() {
  try {
    const history = await window.electronAPI.getHistory();
    const historyList = document.getElementById("historyList");
    document.getElementById("historyCount").textContent = history.length;

    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-state"><p>暂无历史记录</p></div>';
      return;
    }

    historyList.innerHTML = history.slice(0, 10).map(item => `
      <div class="history-item">
        <div class="history-info">
          <div class="history-icon ${item.success ? 'success' : 'failed'}">
            <svg viewBox="0 0 24 24"><path d="${item.success ? 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' : 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'}"/></svg>
          </div>
          <div>
            <div>${escapeHtml(item.ssid)}</div>
            <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error("加载历史失败:", e);
  }
}

function log(msg, success = false) {
  const div = document.getElementById("log");
  if (!div) return;
  const time = new Date().toLocaleTimeString();
  const color = success ? "#66ff99" : "#ffcc66";
  div.innerHTML += `<span style="color:${color}">[${time}] ${msg}</span><br>`;
  div.scrollTop = div.scrollHeight;
}

async function startScan() {
  await scanWifi();
}

function quickTry(ssid) {
  showConnectDialog(ssid);
}

async function tryConnect() {
  const ssid = document.getElementById("ssid").value.trim();
  if (!ssid) return alert("请输入WiFi名称");

  log(`后端尝试连接：${ssid}`);

  // 先尝试系统连接
  const connectRes = await window.electronAPI.connectWifi(ssid);
  log(connectRes.message, connectRes.success);

  // 模拟字典攻击演示
  if (Math.random() > 0.6) {
    setTimeout(() => {
      const pwd = dictionary[Math.floor(Math.random() * dictionary.length)];
      log(`🎉 模拟破解成功！密码：${pwd}`, true);
      knownKeys.push({ ssid, password: pwd });
    }, 1200);
  }
}

async function showSavedProfiles() {
  log("后端读取本机已保存WiFi配置文件...");
  const res = await window.electronAPI.getSavedProfiles();
  log(res.data || res.message, res.success);
}

function clearLog() {
  document.getElementById("log").innerHTML = "";
}

async function exportKeys() {
  if (knownKeys.length === 0) return alert("暂无记录");
  await window.electronAPI.saveKeys(knownKeys);
  log("钥匙库已保存到用户数据目录", true);

  let text = "WiFi钥匙库\n\n";
  knownKeys.forEach(
    (k) => (text += `SSID: ${k.ssid}\n密码: ${k.password}\n\n`),
  );

  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "WiFi钥匙库.txt";
  a.click();
}

window.onload = async () => {
  console.log("WiFi万能钥匙启动中...");

  try {
    const config = await window.electronAPI.getConfig();
    if (config.darkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    if (config.minimizeToTray) {
      document.getElementById("minimizeToTrayToggle").checked = true;
    }
    if (config.notifications !== false) {
      document.getElementById("notificationsToggle").checked = true;
    }
  } catch (e) {
    console.log("加载配置失败", e);
  }

  await showSavedProfiles();
  await updateConnectionStatus();
  await loadHistory();

  window.electronAPI.onTrayScan(() => scanWifi());
  window.electronAPI.onOpenSettings(() => document.getElementById("settingsModal").classList.add("active"));

  window.electronAPI.onThemeChanged((theme) => {
    document.documentElement.setAttribute("data-theme", theme);
  });
};

function saveSettings() {
  const config = {
    darkMode: document.getElementById("darkModeToggle").checked,
    notifications: document.getElementById("notificationsToggle").checked,
    minimizeToTray: document.getElementById("minimizeToTrayToggle").checked
  };
  window.electronAPI.saveConfig(config);

  if (config.darkMode) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function exportData(format) {
  window.electronAPI.exportKeys(format).then(res => {
    if (res.success) {
      const blob = new Blob([res.content], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.filename;
      a.click();
      showToast("导出成功", "success");
    } else {
      showToast("导出失败", "error");
    }
  });
}

function importData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.csv";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        window.electronAPI.importKeys(evt.target.result).then(res => {
          if (res.success) {
            showToast(`导入成功，共 ${res.count} 条记录`, "success");
          } else {
            showToast(res.message || "导入失败", "error");
          }
        });
      };
      reader.readAsText(file);
    }
  };
  input.click();
}
