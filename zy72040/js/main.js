let controller = null;
let uiRenderer = null;

async function loadLevelsData() {
  try {
    const response = await fetch('data/levels.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (e) {
    console.error('加载关卡数据失败:', e);
    alert('加载关卡数据失败，请确保通过HTTP服务器访问本页面。');
    return null;
  }
}

function initializeSampleData(historyManager) {
  const existingRecords = historyManager.getRecords();
  if (existingRecords.length > 0) {
    console.log('已有历史记录，跳过样例数据初始化');
    return;
  }

  const now = Date.now();

  const smoothRecord = {
    levelId: 'level_001',
    levelName: '汛期第一轮洪峰',
    playerName: '王五（顺利）',
    finalScore: 95,
    grade: 'A',
    status: 'normal',
    duration: 95000,
    durationFormatted: '1分35秒',
    finishReason: 'completed',
    penaltyPoints: 5,
    hasNegativeResource: false,
    hasBoundaryViolation: false,
    duplicateEventIds: [],
    decisionHistory: [
      {
        eventId: 'evt_001',
        eventTitle: '气象预警',
        decisionId: 'dec_001_a',
        decisionLabel: '加大下泄至100m³/s',
        explanation: '提前预泄，预留防洪库容',
        effects: { discharge: 50, score: 0 },
        stateAfter: { waterLevel: 150, storage: 3072, discharge: 100, score: 100 },
        warnings: [],
        timestamp: now - 120000
      },
      {
        eventId: 'evt_002',
        eventTitle: '洪峰入境',
        decisionId: 'dec_002_b',
        decisionLabel: '加大下泄至350m³/s',
        explanation: '削峰错峰，控制水位在安全范围',
        effects: { discharge: 250, score: 0 },
        stateAfter: { waterLevel: 155, storage: 3612, discharge: 350, score: 100 },
        warnings: [],
        timestamp: now - 100000
      },
      {
        eventId: 'evt_003',
        eventTitle: '洪峰过境',
        decisionId: 'dec_003_a',
        decisionLabel: '逐步减小下泄至200m³/s',
        explanation: '平稳回落，避免下游水位骤降',
        effects: { discharge: -150, score: -5 },
        stateAfter: { waterLevel: 152, storage: 3252, discharge: 200, score: 95 },
        warnings: [],
        timestamp: now - 80000
      }
    ],
    finalState: { waterLevel: 152, storage: 3252, discharge: 200, score: 95 },
    resourceConfig: {
      waterLevel: { min: 0, max: 200, unit: 'm', initial: 150, warning: 185, flood: 195 },
      storage: { min: 0, max: 5000, unit: '万m³', initial: 3000, warning: 4200, flood: 4800 },
      discharge: { min: 0, max: 500, unit: 'm³/s', initial: 50 },
      score: { min: 0, max: 100, initial: 100 }
    },
    validation: { valid: true, errors: [], warnings: [] }
  };

  const needsReviewRecord = {
    levelId: 'level_004',
    levelName: '边界值压力测试',
    playerName: '赵六（待确认）',
    finalScore: 50,
    grade: 'F',
    status: 'needs_manual_review',
    duration: 120000,
    durationFormatted: '2分0秒',
    finishReason: 'completed',
    penaltyPoints: 50,
    hasNegativeResource: true,
    hasBoundaryViolation: true,
    duplicateEventIds: [],
    decisionHistory: [
      {
        eventId: 'evt_bound_001',
        eventTitle: '超量降雨',
        decisionId: 'dec_bound_001_a',
        decisionLabel: '开闸到最大',
        explanation: '下泄流量超过最大值500，已触发边界保护',
        effects: { discharge: 600, score: -20 },
        stateAfter: { waterLevel: 150, storage: 38996.4, discharge: 500, score: 80 },
        warnings: [
          'storage 超出边界: 尝试设为 38996.4万m³，已限制为 5000万m³',
          'discharge 超出边界: 尝试设为 650m³/s，已限制为 500m³/s',
          '⚠️ storage 超过防洪高水位: 5000万m³'
        ],
        timestamp: now - 3600000
      },
      {
        eventId: 'evt_bound_002',
        eventTitle: '资源负值测试',
        decisionId: 'dec_bound_002_a',
        decisionLabel: '确认负值',
        explanation: '库容不能为负，系统将标记异常待人工确认',
        effects: { storage: -1000, score: 0 },
        stateAfter: { waterLevel: 150, storage: 0, discharge: 500, score: 80 },
        warnings: [
          'storage 出现负值: -35996.4万m³',
          '❌ storage 为负值: 0万m³，需要人工确认'
        ],
        timestamp: now - 3500000
      }
    ],
    finalState: { waterLevel: 150, storage: 0, discharge: 500, score: 50 },
    resourceConfig: {
      waterLevel: { min: 0, max: 200, unit: 'm', initial: 150, warning: 185, flood: 195 },
      storage: { min: 0, max: 5000, unit: '万m³', initial: 3000, warning: 4200, flood: 4800 },
      discharge: { min: 0, max: 500, unit: 'm³/s', initial: 50 },
      score: { min: 0, max: 100, initial: 100 }
    },
    validation: { valid: true, errors: [], warnings: [] }
  };

  const oldCaliberRecord = {
    levelId: 'level_001',
    levelName: '汛期第一轮洪峰',
    playerName: '李四（2024级）',
    finalScore: 72,
    grade: 'C',
    status: 'normal',
    duration: 180000,
    durationFormatted: '3分0秒',
    finishReason: 'completed',
    penaltyPoints: 28,
    hasNegativeResource: false,
    hasBoundaryViolation: false,
    duplicateEventIds: [],
    decisionHistory: [
      {
        eventId: 'evt_001',
        eventTitle: '气象预警',
        decisionId: 'dec_001_b',
        decisionLabel: '维持50m³/s，观察雨情',
        explanation: '未及时预泄，库容占用过多',
        effects: { storage: 200, score: -5 },
        stateAfter: { waterLevel: 152, storage: 3200, discharge: 50, score: 95 },
        warnings: [],
        timestamp: now - 86400000 * 30
      },
      {
        eventId: 'evt_002',
        eventTitle: '洪峰入境',
        decisionId: 'dec_002_a',
        decisionLabel: '加大下泄至250m³/s',
        explanation: '下泄不足，水位继续上涨',
        effects: { discharge: 150, score: -5 },
        stateAfter: { waterLevel: 165, storage: 3800, discharge: 250, score: 90 },
        warnings: [],
        timestamp: now - 86400000 * 30 + 60000
      },
      {
        eventId: 'evt_003',
        eventTitle: '洪峰过境',
        decisionId: 'dec_003_b',
        decisionLabel: '立即关闭至50m³/s',
        explanation: '拦蓄过多，水位居高不下',
        effects: { storage: 300, score: -8 },
        stateAfter: { waterLevel: 170, storage: 4100, discharge: 50, score: 82 },
        warnings: [],
        timestamp: now - 86400000 * 30 + 120000
      }
    ],
    finalState: { waterLevel: 170, storage: 4100, discharge: 50, score: 72 },
    resourceConfig: {
      waterLevel: { min: 0, max: 200, unit: 'm', initial: 150, warning: 185, flood: 195 },
      storage: { min: 0, max: 5000, unit: '万m³', initial: 3000, warning: 4200, flood: 4800 },
      discharge: { min: 0, max: 500, unit: 'm³/s', initial: 50 },
      score: { min: 0, max: 100, initial: 100 }
    },
    validation: { valid: true, errors: [], warnings: [] },
    source: '老师错题本 - 2024年春季培训',
    isOldCaliber: true,
    createdAt: now - 86400000 * 30,
    updatedAt: now
  };

  const smooth = historyManager.saveGameRecord(smoothRecord);
  smooth.status = 'normal';
  smooth.createdAt = now - 3600000;

  const needsReview = historyManager.saveGameRecord(needsReviewRecord);
  needsReview.status = 'needs_manual_review';
  needsReview.createdAt = now - 7200000;

  const oldRecord = historyManager.importOldRecord(oldCaliberRecord, oldCaliberRecord.source);
  oldRecord.createdAt = now - 86400000 * 30;

  historyManager.saveRecords();

  console.log('已初始化样例数据：');
  console.log('  1. 顺利记录:', smooth.id);
  console.log('  2. 待人工确认记录:', needsReview.id);
  console.log('  3. 旧口径记录:', oldRecord.id);
}

async function initApp() {
  const levelsData = await loadLevelsData();
  if (!levelsData) {
    document.getElementById('app').innerHTML = `
      <div class="alert alert-danger">
        <strong>❌ 加载失败</strong>
        <p>无法加载关卡数据。请确保通过HTTP服务器访问本页面。</p>
        <p>推荐启动方式：</p>
        <pre><code>python3 -m http.server 8000
# 或
npx http-server -p 8000</code></pre>
        <p>然后在浏览器访问 http://localhost:8000</p>
      </div>
    `;
    return;
  }

  controller = new GameController(levelsData);
  uiRenderer = new UIRenderer(controller);

  initializeSampleData(controller.getHistoryManager());

  uiRenderer.init();
}

document.addEventListener('DOMContentLoaded', initApp);
