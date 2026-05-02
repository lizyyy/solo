const API_BASE = 'http://localhost:3000/api';

chrome.runtime.onInstalled.addListener(() => {
  console.log('考场异常标记夹扩展已安装');
  
  chrome.contextMenus.create({
    id: 'openSidebar',
    title: '打开考场异常标记夹',
    contexts: ['all']
  });

  chrome.contextMenus.create({
    id: 'quickCapture',
    title: '快速截图并标记异常',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openSidebar') {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
  
  if (info.menuItemId === 'quickCapture') {
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('截图失败:', chrome.runtime.lastError);
        return;
      }
      
      chrome.storage.local.set({ pendingScreenshot: dataUrl }, () => {
        chrome.sidePanel.open({ windowId: tab.windowId });
      });
    });
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

async function checkConnection() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    return data.status === 'ok';
  } catch (e) {
    return false;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_CONNECTION') {
    checkConnection().then((connected) => {
      sendResponse({ connected });
    });
    return true;
  }
  
  if (request.type === 'CAPTURE_SCREENSHOT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, dataUrl });
        }
      };
    });
    return true;
  }
});
