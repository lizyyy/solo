/**
 * 存档/读档管理模块
 * 使用 localStorage 存储游戏进度
 */

const SAVE_KEY = 'rescue_dispatch_save';

/**
 * 保存游戏状态
 * @param {Object} gameState - 游戏状态
 * @param {Object} replayHistory - 回放历史
 * @returns {boolean} 是否保存成功
 */
export function saveGame(gameState, replayHistory = []) {
  try {
    const saveData = {
      timestamp: Date.now(),
      gameState,
      replayHistory
    };
    
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch (error) {
    console.error('保存游戏失败:', error);
    return false;
  }
}

/**
 * 加载游戏存档
 * @returns {Object|null} 存档数据，如果没有存档则返回null
 */
export function loadGame() {
  try {
    const saveData = localStorage.getItem(SAVE_KEY);
    
    if (!saveData) {
      return null;
    }
    
    return JSON.parse(saveData);
  } catch (error) {
    console.error('加载游戏失败:', error);
    return null;
  }
}

/**
 * 检查是否有存档
 * @returns {boolean} 是否有存档
 */
export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * 删除存档
 * @returns {boolean} 是否删除成功
 */
export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (error) {
    console.error('删除存档失败:', error);
    return false;
  }
}

/**
 * 获取存档信息
 * @returns {Object|null} 存档信息，如果没有存档则返回null
 */
export function getSaveInfo() {
  const saveData = loadGame();
  
  if (!saveData) {
    return null;
  }
  
  const date = new Date(saveData.timestamp);
  
  return {
    timestamp: saveData.timestamp,
    dateString: date.toLocaleString('zh-CN'),
    turn: saveData.gameState?.turn,
    reputation: saveData.gameState?.reputation,
    replaySteps: saveData.replayHistory?.length || 0
  };
}

/**
 * 导出存档为文件
 * @param {Object} gameState - 游戏状态
 * @param {Object} replayHistory - 回放历史
 * @returns {string} 下载URL
 */
export function exportSave(gameState, replayHistory = []) {
  const saveData = {
    timestamp: Date.now(),
    gameState,
    replayHistory
  };
  
  const dataStr = JSON.stringify(saveData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  return URL.createObjectURL(dataBlob);
}

/**
 * 从文件导入存档
 * @param {File} file - 文件对象
 * @returns {Promise<Object|null>} 存档数据
 */
export function importSave(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const saveData = JSON.parse(event.target.result);
        resolve(saveData);
      } catch (error) {
        reject(new Error('无效的存档文件'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsText(file);
  });
}
