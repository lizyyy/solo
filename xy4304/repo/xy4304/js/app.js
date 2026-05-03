/**
 * 急诊科分诊训练系统 - 主应用入口
 * 负责整合所有模块并启动游戏
 */

// 导入所有模块
import { gameState } from './gameState.js';
import { uiController } from './uiController.js';
import { levelLoader } from './levelLoader.js';
import { scoreStorage } from './scoreStorage.js';
import { reportExporter } from './reportExporter.js';

// 全局应用对象
const triageApp = {
  // 当前选中的关卡
  _selectedLevelId: 'basic',
  
  // 初始化状态
  _initialized: false,

  /**
   * 初始化应用
   */
  init() {
    if (this._initialized) {
      console.log('应用已经初始化');
      return;
    }
    
    console.log('正在初始化急诊科分诊训练系统...');
    
    try {
      // 1. 初始化游戏状态
      gameState.init();
      
      // 2. 初始化UI控制器
      uiController.init();
      
      // 3. 初始化成绩存储
      scoreStorage.init();
      
      // 4. 注册游戏事件监听
      uiController.registerGameEvents();
      
      // 5. 绑定额外的事件处理
      this._bindAdditionalEvents();
      
      // 6. 加载默认关卡（预加载）
      this._preloadDefaultLevel();
      
      this._initialized = true;
      console.log('急诊科分诊训练系统初始化完成！');
      
      // 显示欢迎信息
      this._showWelcomeMessage();
      
    } catch (error) {
      console.error('应用初始化失败:', error);
      this._showInitializationError(error);
    }
  },

  /**
   * 绑定额外的事件处理
   */
  _bindAdditionalEvents() {
    // 报告导出按钮
    const exportBtn = document.getElementById('export-report');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this._handleExportReport());
    }
    
    // 游戏结束事件 - 保存成绩
    gameState.on('onGameEnd', (summary) => {
      this._handleGameEnd(summary);
    });
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      this._handleKeyboardShortcuts(e);
    });
    
    // 页面可见性变化（暂停游戏）
    document.addEventListener('visibilitychange', () => {
      this._handleVisibilityChange();
    });
  },

  /**
   * 预加载默认关卡
   */
  async _preloadDefaultLevel() {
    try {
      // 预加载基础关卡，提高首次加载速度
      await levelLoader.loadLevel('basic');
      console.log('默认关卡预加载完成');
    } catch (error) {
      console.warn('默认关卡预加载失败:', error);
      // 不阻止应用继续运行
    }
  },

  /**
   * 显示欢迎信息
   */
  _showWelcomeMessage() {
    console.log('%c欢迎使用急诊科分诊训练系统！', 'font-size: 16px; font-weight: bold; color: #3b82f6;');
    console.log('功能特性：');
    console.log('✅ 四色分诊系统（红/黄/绿/黑）');
    console.log('✅ 智能规则判定和实时反馈');
    console.log('✅ 可编辑关卡JSON');
    console.log('✅ 倒计时和连击系统');
    console.log('✅ 暂停复盘功能');
    console.log('✅ 历史成绩保存');
    console.log('✅ Markdown训练报告导出');
    console.log('');
    console.log('使用方法：');
    console.log('1. 点击"选择关卡"或"开始游戏"选择关卡');
    console.log('2. 将患者卡片拖拽到对应的分诊区域');
    console.log('3. 系统会实时反馈分诊是否正确');
    console.log('4. 游戏结束后可以导出训练报告');
  },

  /**
   * 显示初始化错误
   * @param {Error} error - 错误对象
   */
  _showInitializationError(error) {
    // 在界面上显示错误信息
    const feedback = document.getElementById('feedback');
    if (feedback) {
      feedback.innerHTML = `
        <div class="feedback-error">
          <strong>初始化失败</strong>
        </div>
        <div class="feedback-details">
          ${error.message || '请检查控制台获取详细错误信息'}
        </div>
      `;
      feedback.classList.add('show');
    }
  },

  /**
   * 处理游戏结束
   * @param {Object} summary - 游戏摘要
   */
  _handleGameEnd(summary) {
    console.log('游戏结束，保存成绩...');
    
    // 保存到成绩存储
    const saved = scoreStorage.saveScore(summary);
    
    if (saved) {
      console.log('成绩保存成功');
    } else {
      console.warn('成绩保存失败');
    }
    
    // 显示游戏统计
    console.log('游戏统计：');
    console.log(`- 总分：${summary.score}`);
    console.log(`- 准确率：${summary.accuracy}%`);
    console.log(`- 最高连击：${summary.maxCombo}`);
    console.log(`- 用时：${levelLoader.formatTime(summary.timeUsed)}`);
    console.log(`- 正确分诊：${summary.correctCount}人`);
    console.log(`- 错误分诊：${summary.incorrectCount}人`);
  },

  /**
   * 处理报告导出
   */
  _handleExportReport() {
    console.log('正在生成训练报告...');
    
    try {
      // 获取当前游戏摘要
      const summary = gameState.getGameSummary();
      
      // 如果没有进行游戏，尝试从历史记录获取最新的
      if (!summary || !summary.levelId) {
        const history = scoreStorage.getRecentRecords(1);
        if (history.length > 0) {
          const lastRecord = history[0];
          // 生成报告
          const report = reportExporter.generateMarkdownReport(lastRecord);
          reportExporter.exportToFile(report);
          console.log('报告导出成功（使用最近一次游戏记录）');
          return;
        } else {
          alert('没有游戏记录可导出报告，请先进行一次游戏。');
          return;
        }
      }
      
      // 生成并导出报告
      const report = reportExporter.generateMarkdownReport(summary);
      reportExporter.exportToFile(report);
      
      console.log('训练报告导出成功！');
      
      // 显示成功提示
      this._showToast('训练报告已导出！');
      
    } catch (error) {
      console.error('导出报告失败:', error);
      alert('导出报告失败：' + error.message);
    }
  },

  /**
   * 显示提示消息
   * @param {string} message - 提示消息
   * @param {number} duration - 显示时长（毫秒）
   */
  _showToast(message, duration = 2000) {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 3000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 显示动画
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    // 自动隐藏
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, duration);
  },

  /**
   * 处理键盘快捷键
   * @param {KeyboardEvent} e - 键盘事件
   */
  _handleKeyboardShortcuts(e) {
    const GameStatus = gameState.getGameStatuses();
    const status = gameState.getStatus();
    
    // Ctrl+S 或 Cmd+S 开始/暂停游戏
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      
      if (status === GameStatus.IDLE || status === GameStatus.COMPLETED) {
        // 显示关卡选择
        const levelSelectBtn = document.getElementById('level-select-btn');
        if (levelSelectBtn && !levelSelectBtn.disabled) {
          levelSelectBtn.click();
        }
      } else if (status === GameStatus.PLAYING) {
        // 暂停游戏
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
          pauseBtn.click();
        }
      } else if (status === GameStatus.PAUSED) {
        // 继续游戏
        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
          resumeBtn.click();
        }
      }
    }
    
    // ESC 键关闭弹窗或暂停游戏
    if (e.key === 'Escape') {
      // 检查是否有打开的弹窗
      const modals = document.querySelectorAll('.modal.show');
      if (modals.length > 0) {
        // 关闭最上层的弹窗
        const topModal = modals[modals.length - 1];
        topModal.classList.remove('show');
      } else if (status === GameStatus.PLAYING) {
        // 暂停游戏
        gameState.pauseGame();
        uiController._showPauseModal();
        uiController._updateUI();
      }
    }
    
    // R 键重新开始（游戏结束后）
    if (e.key === 'r' && status === GameStatus.COMPLETED) {
      const replayBtn = document.getElementById('replay-btn');
      if (replayBtn) {
        replayBtn.click();
      }
    }
    
    // E 键导出报告（游戏结束后）
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      this._handleExportReport();
    }
  },

  /**
   * 处理页面可见性变化
   */
  _handleVisibilityChange() {
    const GameStatus = gameState.getGameStatuses();
    const status = gameState.getStatus();
    
    // 页面隐藏时，如果游戏正在进行，自动暂停
    if (document.hidden && status === GameStatus.PLAYING) {
      console.log('页面隐藏，自动暂停游戏');
      gameState.pauseGame();
      uiController._showPauseModal();
      uiController._updateUI();
    }
  },

  /**
   * 获取应用状态
   * @returns {Object} 应用状态信息
   */
  getAppState() {
    return {
      initialized: this._initialized,
      gameStatus: gameState.getStatus(),
      selectedLevelId: this._selectedLevelId,
      score: gameState.getScore(),
      combo: gameState.getComboCount(),
      remainingTime: gameState.getRemainingTime(),
      cacheSize: levelLoader.getCacheSize()
    };
  },

  /**
   * 重置应用
   */
  reset() {
    console.log('重置应用...');
    
    // 重置游戏状态
    gameState.reset();
    
    // 重新初始化UI
    uiController.init();
    
    // 清除缓存
    levelLoader.clearCache();
    
    console.log('应用已重置');
  }
};

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  triageApp.init();
});

// 导出应用对象供调试使用
window.triageApp = triageApp;
window.gameState = gameState;
window.levelLoader = levelLoader;
window.scoreStorage = scoreStorage;
window.reportExporter = reportExporter;

export default triageApp;
