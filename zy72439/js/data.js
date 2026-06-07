const STATUS = {
  PENDING: '待处理',
  NORMAL: '正常',
  NEED_REVIEW: '待票务复核',
  SUPPLEMENTED: '留言补录',
  REVISED: '已人工修正',
  RE_RUN: '已重跑'
};

const SOURCE_TYPE = {
  AUTHORIZATION_IMPORT: '授权期限页导入',
  GROUP_CHAT: '群内临时通知',
  ENGINEER_NOTE: '调音师留言',
  MANUAL_REVISION: '人工修正'
};

let demoData = {
  songs: [],
  auditLogs: [],
  currentStep: 0,
  currentSongIndex: 0
};

function initDemoData() {
  demoData.songs = [
    {
      id: 'S001',
      name: '夜曲第一章',
      pageNumber: 15,
      correctPageNumber: 15,
      authorizedStart: '2025-01-01',
      authorizedEnd: '2026-12-31',
      status: STATUS.PENDING,
      sourceType: SOURCE_TYPE.AUTHORIZATION_IMPORT,
      engineerNote: '页码核对无误，按正常流程走',
      groupMessage: null,
      revenueSplit: {
        composer: 30,
        lyricist: 20,
        publisher: 50,
        baseAmount: 10000
      },
      history: [],
      isDemoType: 'smooth'
    },
    {
      id: 'S002',
      name: '晨雾协奏曲',
      pageNumber: 8,
      correctPageNumber: 12,
      authorizedStart: '2025-03-15',
      authorizedEnd: '2026-03-14',
      status: STATUS.PENDING,
      sourceType: SOURCE_TYPE.AUTHORIZATION_IMPORT,
      engineerNote: '旧稿页码，后续等版权部确认',
      groupMessage: '【临时替补】小周：晨雾协奏曲那版页码写错了，暂时按群里说的12页走哈，回头补手续',
      revenueSplit: {
        composer: 40,
        lyricist: 10,
        publisher: 50,
        baseAmount: 8000
      },
      history: [],
      isDemoType: 'group'
    },
    {
      id: 'S003',
      name: '旧时光回旋曲',
      pageNumber: 22,
      correctPageNumber: 22,
      authorizedStart: '2024-06-01',
      authorizedEnd: '2025-05-31',
      status: STATUS.PENDING,
      sourceType: SOURCE_TYPE.AUTHORIZATION_IMPORT,
      engineerNote: '【重要】2025年3月补记：此曲页码去年登记时口径不对，实际应按修订版第22页算，之前18页是旧版',
      groupMessage: null,
      revenueSplit: {
        composer: 35,
        lyricist: 15,
        publisher: 50,
        baseAmount: 12000
      },
      history: [],
      isDemoType: 'supplement'
    }
  ];
  
  demoData.auditLogs = [];
  demoData.currentStep = 0;
  demoData.currentSongIndex = 0;
}

function addHistory(song, action, operator, note) {
  const record = {
    timestamp: new Date().toLocaleString('zh-CN'),
    action,
    operator,
    note,
    statusBefore: song.status,
    statusAfter: song.status
  };
  song.history.unshift(record);
  
  demoData.auditLogs.unshift({
    songId: song.id,
    songName: song.name,
    ...record
  });
  
  return record;
}

function step1_ImportAuthorization(song) {
  song.status = STATUS.PENDING;
  song.sourceType = SOURCE_TYPE.AUTHORIZATION_IMPORT;
  return addHistory(
    song,
    '授权期限页导入',
    '版权运营-小鹿',
    `导入授权期限：${song.authorizedStart} 至 ${song.authorizedEnd}，登记页码：第${song.pageNumber}页`
  );
}

function step2_CheckEngineerNote(song) {
  let resultNote = '';
  
  if (song.isDemoType === 'smooth') {
    song.status = STATUS.NORMAL;
    resultNote = '调音师留言确认无误，页码正常';
  } else if (song.isDemoType === 'group') {
    song.status = STATUS.NEED_REVIEW;
    resultNote = '发现群内临时替补通知，页码与授权页不符，转票务同事复核';
  } else if (song.isDemoType === 'supplement') {
    song.status = STATUS.SUPPLEMENTED;
    resultNote = '从调音师留言中发现旧口径补记信息，页码需按留言修正';
  }
  
  return addHistory(
    song,
    '核对调音师留言',
    '版权运营-小鹿',
    resultNote + '。留言内容：' + song.engineerNote
  );
}

function step3_ReviewByTicketing(song) {
  song.status = STATUS.REVISED;
  song.pageNumber = song.correctPageNumber;
  return addHistory(
    song,
    '票务复核确认',
    '票务同事',
    `复核确认：原第${song.pageNumber}页为错版，修正为第${song.correctPageNumber}页。来源：群内临时替补通知`
  );
}

function step4_UpdateRevenueSplit(song) {
  return addHistory(
    song,
    '更新分账明细',
    '版权运营-小鹿',
    `分账明细已按最新页码${song.pageNumber}重新核算。基础金额：${song.revenueSplit.baseAmount}元，分配比例：作曲${song.revenueSplit.composer}% / 作词${song.revenueSplit.lyricist}% / 发行${song.revenueSplit.publisher}%`
  );
}

function step5_ReRun(song) {
  song.status = STATUS.RE_RUN;
  return addHistory(
    song,
    '系统重跑',
    '系统',
    `已按修正后的页码第${song.pageNumber}页重跑全流程，分账明细已同步更新`
  );
}

function calculateRevenue(song) {
  const base = song.revenueSplit.baseAmount;
  return {
    composer: Math.round(base * song.revenueSplit.composer / 100),
    lyricist: Math.round(base * song.revenueSplit.lyricist / 100),
    publisher: Math.round(base * song.revenueSplit.publisher / 100),
    total: base
  };
}
