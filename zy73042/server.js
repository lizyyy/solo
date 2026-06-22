const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const SOURCE_TYPES = {
  AUTO_INSPECTION: '自动巡检判读',
  MANUAL_VERIFY: '维修照片手工核',
  GRAY_NOTE: '灰度补录备注',
  ENGINEER_EDIT: '设备工程师改判'
};

const STATUS_TYPES = {
  PENDING: '待排程',
  SCHEDULED: '已排程',
  PARTS_ARRIVED: '备件已到货',
  IN_MAINTENANCE: '维修中',
  COMPLETED: '已完成',
  OVERDUE: '到货滞后'
};

function nowISO() {
  return new Date().toISOString();
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return buildDemoData();
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return buildDemoData();
  }
}

function saveData(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function buildDemoData() {
  const db = {
    inspections: [],
    schedules: [],
    changeHistory: [],
    duplicateWarnings: []
  };

  const insp1 = {
    id: uid('insp'),
    deviceCode: 'PUMP-01-A3',
    deviceName: '3号给水泵',
    stationName: '北郊泵站',
    inspectionTime: '2026-06-01T09:12:00.000Z',
    inspector: '张工',
    autoVerdict: '需停机换轴承',
    autoParts: [{ name: 'SKF深沟球轴承6312', qty: 2, eta: '2026-06-05' }],
    notes: [],
    createdAt: '2026-06-01T09:15:00.000Z'
  };
  db.inspections.push(insp1);

  const sched1 = {
    id: uid('sched'),
    inspectionId: insp1.id,
    deviceCode: insp1.deviceCode,
    deviceName: insp1.deviceName,
    stationName: insp1.stationName,
    currentVerdict: insp1.autoVerdict,
    currentParts: JSON.parse(JSON.stringify(insp1.autoParts)),
    shutdownWindow: { start: '2026-06-06 00:00', end: '2026-06-06 06:00' },
    status: STATUS_TYPES.SCHEDULED,
    source: SOURCE_TYPES.AUTO_INSPECTION,
    summary: '3号泵轴承异响，预计6月5日到货，6月6日零点停机更换',
    createdAt: '2026-06-01T09:20:00.000Z',
    updatedAt: '2026-06-01T09:20:00.000Z'
  };
  db.schedules.push(sched1);

  db.changeHistory.push({
    id: uid('chg'),
    scheduleId: sched1.id,
    timestamp: '2026-06-01T09:20:00.000Z',
    operator: '系统',
    source: SOURCE_TYPES.AUTO_INSPECTION,
    oldVerdict: null,
    newVerdict: sched1.currentVerdict,
    oldParts: [],
    newParts: sched1.currentParts,
    oldStatus: null,
    newStatus: sched1.status,
    reason: '巡检初判生成排程',
    note: null
  });

  const insp2 = {
    id: uid('insp'),
    deviceCode: 'PUMP-01-A3',
    deviceName: '3号给水泵(重复录入)',
    stationName: '北郊泵站',
    inspectionTime: '2026-06-02T14:00:00.000Z',
    inspector: '李工',
    autoVerdict: '需停机换机封',
    autoParts: [{ name: '机械密封组件M7N-80', qty: 1, eta: '2026-06-07' }],
    notes: [],
    createdAt: '2026-06-02T14:10:00.000Z'
  };
  db.inspections.push(insp2);

  const sched2 = {
    id: uid('sched'),
    inspectionId: insp2.id,
    deviceCode: insp2.deviceCode,
    deviceName: insp2.deviceName,
    stationName: insp2.stationName,
    currentVerdict: insp2.autoVerdict,
    currentParts: JSON.parse(JSON.stringify(insp2.autoParts)),
    shutdownWindow: { start: '2026-06-08 00:00', end: '2026-06-08 05:00' },
    status: STATUS_TYPES.PENDING,
    source: SOURCE_TYPES.AUTO_INSPECTION,
    summary: '3号泵机封渗漏，等待合并处理建议',
    createdAt: '2026-06-02T14:15:00.000Z',
    updatedAt: '2026-06-02T14:15:00.000Z'
  };
  db.schedules.push(sched2);

  db.duplicateWarnings.push({
    id: uid('dup'),
    deviceCode: 'PUMP-01-A3',
    relatedScheduleIds: [sched1.id, sched2.id],
    suggestion: '同一设备存在两条排程，建议：① 合并停机窗口；② 轴承与机封一次出库同步更换；③ 只保留一次"已排程"状态，另一条标记"合并处理"后归档。',
    firstFoundAt: '2026-06-02T14:16:00.000Z',
    resolved: false
  });

  const insp3 = {
    id: uid('insp'),
    deviceCode: 'VALVE-07-B2',
    deviceName: '2号出水电动阀',
    stationName: '北郊泵站',
    inspectionTime: '2026-06-03T10:30:00.000Z',
    inspector: '王工',
    autoVerdict: '建议观察无需停机',
    autoParts: [],
    notes: [],
    createdAt: '2026-06-03T10:40:00.000Z'
  };
  db.inspections.push(insp3);

  const sched3 = {
    id: uid('sched'),
    inspectionId: insp3.id,
    deviceCode: insp3.deviceCode,
    deviceName: insp3.deviceName,
    stationName: insp3.stationName,
    currentVerdict: insp3.autoVerdict,
    currentParts: [],
    shutdownWindow: null,
    status: STATUS_TYPES.PENDING,
    source: SOURCE_TYPES.AUTO_INSPECTION,
    summary: '电动阀限位偏差，暂不影响运行，巡检周期观察',
    createdAt: '2026-06-03T10:45:00.000Z',
    updatedAt: '2026-06-03T10:45:00.000Z'
  };
  db.schedules.push(sched3);

  db.changeHistory.push({
    id: uid('chg'),
    scheduleId: sched3.id,
    timestamp: '2026-06-03T10:45:00.000Z',
    operator: '系统',
    source: SOURCE_TYPES.AUTO_INSPECTION,
    oldVerdict: null,
    newVerdict: sched3.currentVerdict,
    oldParts: [],
    newParts: [],
    oldStatus: null,
    newStatus: sched3.status,
    reason: '巡检初判生成排程',
    note: null
  });

  const grayNote = {
    id: uid('note'),
    timestamp: '2026-06-04T21:05:00.000Z',
    source: SOURCE_TYPES.GRAY_NOTE,
    author: '老何',
    content: '维修照片复核：电动阀执行器齿圈已有金属碎屑掉落（见20260604_IMG_8821.jpg），实际磨损比初判严重。',
    altersVerdict: true,
    affectedFields: ['currentVerdict', 'currentParts', 'shutdownWindow', 'status'],
    beforeSnapshot: {
      verdict: '建议观察无需停机',
      parts: [],
      shutdownWindow: null,
      status: '待排程'
    },
    changesExplained: [
      '判断级别提升：由"观察"升级为"需停机执行器拆检换齿圈"',
      '新增备件：弗兰德齿圈组件K-88 一套',
      '补充停机窗口：备件预计6月8日到货，建议6月10日零点窗口',
      '状态变更：待排程 → 已排程'
    ]
  };

  sched3.notes = [grayNote];
  sched3.currentVerdict = '需停机执行器拆检换齿圈';
  sched3.currentParts = [{ name: '弗兰德齿圈组件K-88', qty: 1, eta: '2026-06-08' }];
  sched3.shutdownWindow = { start: '2026-06-10 00:00', end: '2026-06-10 04:00' };
  sched3.status = STATUS_TYPES.SCHEDULED;
  sched3.source = SOURCE_TYPES.GRAY_NOTE;
  sched3.summary = '电动阀执行器齿圈磨损升级，6月8日备件到货，6月10日零点拆检';
  sched3.updatedAt = grayNote.timestamp;

  db.changeHistory.push({
    id: uid('chg'),
    scheduleId: sched3.id,
    timestamp: grayNote.timestamp,
    operator: grayNote.author,
    source: grayNote.source,
    oldVerdict: '建议观察无需停机',
    newVerdict: sched3.currentVerdict,
    oldParts: [],
    newParts: sched3.currentParts,
    oldStatus: '待排程',
    newStatus: sched3.status,
    reason: '灰度补录维修照片后结论升级',
    note: grayNote
  });

  const insp4 = {
    id: uid('insp'),
    deviceCode: 'PUMP-04-C1',
    deviceName: '1号循环泵',
    stationName: '南郊泵站',
    inspectionTime: '2026-06-05T08:20:00.000Z',
    inspector: '赵工',
    autoVerdict: '需换联轴器缓冲垫',
    autoParts: [{ name: '联轴器缓冲垫NM-97', qty: 1, eta: '2026-06-09' }],
    notes: [],
    createdAt: '2026-06-05T08:30:00.000Z'
  };
  db.inspections.push(insp4);

  const sched4 = {
    id: uid('sched'),
    inspectionId: insp4.id,
    deviceCode: insp4.deviceCode,
    deviceName: insp4.deviceName,
    stationName: insp4.stationName,
    currentVerdict: insp4.autoVerdict,
    currentParts: JSON.parse(JSON.stringify(insp4.autoParts)),
    shutdownWindow: { start: '2026-06-09 22:00', end: '2026-06-10 00:00' },
    status: STATUS_TYPES.OVERDUE,
    source: SOURCE_TYPES.MANUAL_VERIFY,
    summary: '缓冲垫供应商物流延迟，备件预计6月11日到货，早于停机窗口2天风险',
    createdAt: '2026-06-05T08:35:00.000Z',
    updatedAt: '2026-06-08T17:20:00.000Z'
  };
  db.schedules.push(sched4);

  db.changeHistory.push({
    id: uid('chg'),
    scheduleId: sched4.id,
    timestamp: '2026-06-05T08:35:00.000Z',
    operator: '系统',
    source: SOURCE_TYPES.AUTO_INSPECTION,
    oldVerdict: null,
    newVerdict: sched4.currentVerdict,
    oldParts: [],
    newParts: sched4.currentParts,
    oldStatus: null,
    newStatus: STATUS_TYPES.SCHEDULED,
    reason: '巡检初判生成排程',
    note: null
  });

  const delayNote = {
    id: uid('note'),
    timestamp: '2026-06-08T17:20:00.000Z',
    source: SOURCE_TYPES.MANUAL_VERIFY,
    author: '设备工程师老何',
    content: '维修照片核对：联轴器缓冲垫原装件德国清关延误，供应商确认6月11日才能到厂。',
    altersVerdict: false,
    affectedFields: ['status'],
    beforeSnapshot: {
      verdict: '需换联轴器缓冲垫',
      parts: [{ name: '联轴器缓冲垫NM-97', qty: 1, eta: '2026-06-09' }],
      shutdownWindow: { start: '2026-06-09 22:00', end: '2026-06-10 00:00' },
      status: '已排程'
    },
    changesExplained: [
      '状态变更：已排程 → 到货滞后',
      '建议：协调是否将停机窗口延后到6月11日晚，或先借调临检备件库存垫用'
    ]
  };

  sched4.notes = [delayNote];
  sched4.currentParts = [{ name: '联轴器缓冲垫NM-97', qty: 1, eta: '2026-06-11' }];
  sched4.status = STATUS_TYPES.OVERDUE;
  sched4.updatedAt = delayNote.timestamp;

  db.changeHistory.push({
    id: uid('chg'),
    scheduleId: sched4.id,
    timestamp: delayNote.timestamp,
    operator: delayNote.author,
    source: delayNote.source,
    oldVerdict: '需换联轴器缓冲垫',
    newVerdict: '需换联轴器缓冲垫',
    oldParts: [{ name: '联轴器缓冲垫NM-97', qty: 1, eta: '2026-06-09' }],
    newParts: sched4.currentParts,
    oldStatus: '已排程',
    newStatus: sched4.status,
    reason: '维修照片核对后确认备件延迟，到货窗口滞后',
    note: delayNote
  });

  saveData(db);
  return db;
}

let DB = loadData();

(function repairSummariesOnBoot() {
  let changed = 0;
  DB.schedules.forEach(sched => {
    const expected = generateSummary(sched);
    if (sched.summary !== expected) {
      console.log(`[摘要修复] ${sched.deviceCode}: "${sched.summary}" → "${expected}"`);
      sched.summary = expected;
      changed++;
    }
  });
  if (changed > 0) {
    console.log(`[摘要修复] 已更新 ${changed} 条排程的当前摘要`);
    saveData(DB);
  }
})();

function detectDuplicates() {
  const map = {};
  DB.schedules.forEach(s => {
    if (!map[s.deviceCode]) map[s.deviceCode] = [];
    map[s.deviceCode].push(s.id);
  });
  Object.entries(map).forEach(([code, ids]) => {
    if (ids.length >= 2) {
      const exist = DB.duplicateWarnings.find(
        w => w.deviceCode === code && !w.resolved
      );
      if (!exist) {
        DB.duplicateWarnings.push({
          id: uid('dup'),
          deviceCode: code,
          relatedScheduleIds: ids,
          suggestion: `设备编号 ${code} 存在 ${ids.length} 条排程，建议合并停机窗口和备件出库，避免同一设备重复停机。`,
          firstFoundAt: nowISO(),
          resolved: false
        });
      } else {
        exist.relatedScheduleIds = ids;
      }
    }
  });
}

function generateSummary(sched) {
  const parts = sched.currentParts || [];
  const win = sched.shutdownWindow;
  const status = sched.status;
  const verdict = sched.currentVerdict;
  const latestNote = sched.notes && sched.notes.length ? sched.notes[sched.notes.length - 1] : null;

  const partsText = [];
  parts.forEach(p => {
    partsText.push(`${p.name} ×${p.qty}`);
  });
  const partsJoin = partsText.length ? partsText.join('、') : null;

  const latestEta = parts.length
    ? parts.reduce((acc, p) => (p.eta > acc ? p.eta : acc), parts[0].eta)
    : null;

  const winText = win
    ? `${win.start.split(' ')[0]} ${win.start.split(' ')[1] || ''}~${win.end.split(' ')[1] || ''}`.trim()
    : null;

  const statusMap = {
    '待排程': '待排程',
    '已排程': '已排程',
    '备件已到货': '备件已到货',
    '维修中': '维修中',
    '已完成': '已完成',
    '到货滞后': '到货滞后'
  };
  const statusZh = statusMap[status] || status;

  let base = '';
  if (status === '到货滞后' && latestEta && winText) {
    base = `${verdict}，备件预计${latestEta}到货，较原停机窗口${winText}滞后`;
  } else if (status === '备件已到货' && winText) {
    base = `${verdict}，备件已到库，计划${winText}施工`;
  } else if (status === '备件已到货' && !winText) {
    base = `${verdict}，备件已到库，待协调停机窗口`;
  } else if (status === '已完成' && winText) {
    base = `${verdict}，已于${winText}完成施工`;
  } else if (status === '维修中' && winText) {
    base = `${verdict}，正在${winText}施工中`;
  } else if (latestEta && winText) {
    base = `${verdict}，预计${latestEta}到货，${winText}施工`;
  } else if (latestEta && !winText) {
    base = `${verdict}，预计${latestEta}到货，待排程`;
  } else if (!latestEta && winText) {
    base = `${verdict}，计划${winText}施工`;
  } else {
    base = verdict;
  }

  if (partsJoin && !base.includes(partsJoin.split('、')[0])) {
    base += `（${partsJoin}）`;
  }

  if (latestNote && latestNote.content && latestNote.content.length > 0 && !statusZh.includes('初判')) {
    const noteSrc = latestNote.source || sched.source;
    if (noteSrc && noteSrc !== '自动巡检判读') {
      base += ` · 来源：${noteSrc}`;
    }
  }

  return base;
}

app.get('/api/schedules', (req, res) => {
  detectDuplicates();
  const data = DB.schedules.map(s => {
    const history = DB.changeHistory.filter(h => h.scheduleId === s.id);
    return { ...s, changeCount: history.length };
  });
  res.json({
    schedules: data,
    duplicates: DB.duplicateWarnings.filter(w => !w.resolved),
    statusTypes: STATUS_TYPES,
    sourceTypes: SOURCE_TYPES
  });
});

app.get('/api/schedules/:id', (req, res) => {
  const sched = DB.schedules.find(s => s.id === req.params.id);
  if (!sched) return res.status(404).json({ error: '排程不存在' });
  const insp = DB.inspections.find(i => i.id === sched.inspectionId);
  const history = DB.changeHistory
    .filter(h => h.scheduleId === sched.id)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const relatedDuplicates = DB.duplicateWarnings.filter(
    w => w.relatedScheduleIds.includes(sched.id) && !w.resolved
  );
  res.json({
    schedule: sched,
    inspection: insp || null,
    history,
    relatedDuplicates
  });
});

app.post('/api/schedules/:id/rejudge', (req, res) => {
  const { operator, source, reason, note, verdict, parts, shutdownWindow, status } = req.body;
  const sched = DB.schedules.find(s => s.id === req.params.id);
  if (!sched) return res.status(404).json({ error: '排程不存在' });
  if (!operator || !source || !reason) {
    return res.status(400).json({ error: '缺少必填项：操作人/来源/改判原因' });
  }

  const oldVerdict = sched.currentVerdict;
  const oldParts = JSON.parse(JSON.stringify(sched.currentParts));
  const oldStatus = sched.status;
  const oldWindow = sched.shutdownWindow;

  const noteRecord = note ? {
    id: uid('note'),
    timestamp: nowISO(),
    source: source || SOURCE_TYPES.ENGINEER_EDIT,
    author: operator,
    content: note,
    altersVerdict: verdict !== oldVerdict || JSON.stringify(parts) !== JSON.stringify(oldParts) || status !== oldStatus,
    affectedFields: [
      verdict !== oldVerdict && 'currentVerdict',
      JSON.stringify(parts) !== JSON.stringify(oldParts) && 'currentParts',
      JSON.stringify(shutdownWindow) !== JSON.stringify(oldWindow) && 'shutdownWindow',
      status !== oldStatus && 'status'
    ].filter(Boolean),
    beforeSnapshot: {
      verdict: oldVerdict,
      parts: oldParts,
      shutdownWindow: oldWindow,
      status: oldStatus
    },
    changesExplained: []
  } : null;

  if (noteRecord) {
    if (verdict !== oldVerdict) {
      noteRecord.changesExplained.push(`判断："${oldVerdict}" → "${verdict}"`);
    }
    if (JSON.stringify(parts) !== JSON.stringify(oldParts)) {
      const addNames = parts.map(p => p.name).filter(n => !oldParts.find(o => o.name === n));
      const rmNames = oldParts.map(p => p.name).filter(n => !parts.find(o => o.name === n));
      if (addNames.length) noteRecord.changesExplained.push(`新增备件：${addNames.join('、')}`);
      if (rmNames.length) noteRecord.changesExplained.push(`移除备件：${rmNames.join('、')}`);
      parts.forEach(p => {
        const old = oldParts.find(o => o.name === p.name);
        if (old && old.eta !== p.eta) {
          noteRecord.changesExplained.push(`"${p.name}" ETA：${old.eta} → ${p.eta}`);
        }
      });
    }
    if (JSON.stringify(shutdownWindow) !== JSON.stringify(oldWindow)) {
      noteRecord.changesExplained.push(`停机窗口：${oldWindow ? `${oldWindow.start}~${oldWindow.end}` : '(无)'} → ${shutdownWindow ? `${shutdownWindow.start}~${shutdownWindow.end}` : '(无)'}`);
    }
    if (status !== oldStatus) {
      noteRecord.changesExplained.push(`状态：${oldStatus} → ${status}`);
    }
  }

  if (verdict !== undefined) sched.currentVerdict = verdict;
  if (parts !== undefined) sched.currentParts = parts;
  if (shutdownWindow !== undefined) sched.shutdownWindow = shutdownWindow;
  if (status !== undefined) sched.status = status;
  sched.source = source;
  sched.updatedAt = nowISO();
  const oldSummary = sched.summary;
  sched.summary = generateSummary(sched);

  if (noteRecord) {
    if (!sched.notes) sched.notes = [];
    sched.notes.push(noteRecord);
    if (sched.summary !== oldSummary && !noteRecord.affectedFields.includes('summary')) {
      noteRecord.affectedFields.push('summary');
    }
  }

  const historyRecord = {
    id: uid('chg'),
    scheduleId: sched.id,
    timestamp: nowISO(),
    operator,
    source,
    oldVerdict,
    newVerdict: sched.currentVerdict,
    oldParts,
    newParts: sched.currentParts,
    oldStatus,
    newStatus: sched.status,
    reason,
    note: noteRecord
  };
  DB.changeHistory.push(historyRecord);

  detectDuplicates();
  saveData(DB);

  res.json({
    success: true,
    trace: {
      historyId: historyRecord.id,
      scheduleId: sched.id,
      updatedAt: sched.updatedAt,
      fieldsChanged: noteRecord ? noteRecord.affectedFields : ['reason-only'],
      currentStatus: sched.status,
      currentVerdict: sched.currentVerdict,
      summary: sched.summary
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    schedulesCount: DB.schedules.length,
    historyCount: DB.changeHistory.length,
    duplicatesCount: DB.duplicateWarnings.filter(w => !w.resolved).length,
    dataFile: DATA_FILE,
    persisted: fs.existsSync(DATA_FILE)
  });
});

app.listen(PORT, () => {
  console.log(`泵站巡检备件排程服务已启动：http://localhost:${PORT}`);
  console.log(`数据持久化文件：${DATA_FILE}`);
  console.log(`演示数据已内置：含后补备注记录、设备编号重复样例`);
});
