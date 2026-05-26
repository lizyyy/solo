import { createGame } from './game.js';
import { getLevel } from './levels.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const canvas = $('#game');
let game = null;
let selectedLevel = 0;
let timerId = null;
let timeLeft = 0;
let finalResult = null;
let replayIndex = 0;
let allMistakes = [];

const el = {
  levelPicker: $('#level-picker'),
  levelCards: $$('.level-card'),
  hudLevel: $('#hud-level'),
  hudTurn: $('#hud-turn'),
  hudTime: $('#hud-time'),
  hudScore: $('#hud-score'),
  hudMistakes: $('#hud-mistakes'),
  btnPause: $('#btn-pause'),
  btnRestart: $('#btn-restart'),
  btnReplay: $('#btn-replay'),
  btnSubmit: $('#btn-submit'),
  btnReport: $('#btn-report'),
  rulesList: $('#rules-list'),
  logList: $('#log-list'),
  panelReplay: $('#panel-replay'),
  replayPrev: $('#replay-prev'),
  replayNext: $('#replay-next'),
  replayIndex: $('#replay-index'),
  replayText: $('#replay-text'),
  overlay: $('#overlay'),
  overlayTitle: $('#overlay-title'),
  overlayText: $('#overlay-text'),
  overlayStats: $('#overlay-stats'),
  overlayRetry: $('#overlay-retry'),
  overlayNext: $('#overlay-next'),
  overlayClose: $('#overlay-close'),
};

function init() {
  el.levelCards.forEach(card => {
    card.addEventListener('click', () => {
      selectedLevel = parseInt(card.dataset.level, 10);
      startGame(selectedLevel);
    });
  });

  el.btnPause.addEventListener('click', () => {
    if (!game) return;
    const p = game.pause();
    el.btnPause.textContent = p ? '继续' : '暂停';
    if (p) stopTimer();
    else startTimer(timeLeft);
  });

  el.btnRestart.addEventListener('click', () => {
    if (game) game.restart();
    const level = getLevel(selectedLevel);
    timeLeft = level.turnTime;
    startTimer(timeLeft);
    clearLog();
  });

  el.btnSubmit.addEventListener('click', () => {
    if (game) game.submitTurn();
  });

  el.btnReplay.addEventListener('click', () => {
    el.panelReplay.hidden = false;
    replayIndex = 0;
    updateReplayUI();
  });

  el.replayPrev.addEventListener('click', () => {
    if (replayIndex > 0) { replayIndex--; updateReplayUI(); }
  });

  el.replayNext.addEventListener('click', () => {
    if (replayIndex < allMistakes.length - 1) { replayIndex++; updateReplayUI(); }
  });

  el.btnReport.addEventListener('click', exportReport);

  el.overlayRetry.addEventListener('click', () => {
    hideOverlay();
    el.panelReplay.hidden = true;
    startGame(selectedLevel);
  });

  el.overlayNext.addEventListener('click', () => {
    hideOverlay();
    el.panelReplay.hidden = true;
    if (selectedLevel < 2) {
      selectedLevel++;
      startGame(selectedLevel);
    } else {
      showLevelPicker();
    }
  });

  el.overlayClose.addEventListener('click', () => {
    hideOverlay();
    showLevelPicker();
  });

  showLevelPicker();
}

function showLevelPicker() {
  el.levelPicker.hidden = false;
  if (game) { game.stop(); game = null; }
  stopTimer();
}

function startGame(levelId) {
  el.levelPicker.hidden = true;
  el.panelReplay.hidden = true;

  const level = getLevel(levelId);
  selectedLevel = levelId;

  el.hudLevel.textContent = level.name;
  el.hudTurn.textContent = `1 / ${level.turns}`;
  el.hudScore.textContent = '0';
  el.hudMistakes.textContent = `0 / ${level.maxMistakes}`;
  el.btnPause.textContent = '暂停';
  el.btnReplay.disabled = true;

  el.rulesList.innerHTML = level.rules.map(r => `<div>· ${r}</div>`).join('');

  clearLog();
  addLog('info', `进入「${level.name}」`);

  stopTimer();
  timeLeft = level.turnTime;
  updateTimeDisplay();

  game = createGame(canvas, level, {
    onLog: addLog,
    onMistake: count => {
      el.hudMistakes.textContent = `${count} / ${level.maxMistakes}`;
    },
    onScore: score => {
      el.hudScore.textContent = String(score);
    },
    onTurnEnd: turnIdx => {
      el.hudTurn.textContent = `${turnIdx + 1} / ${level.turns}`;
      timeLeft = level.turnTime;
      startTimer(timeLeft);
    },
    onGameOver: result => {
      stopTimer();
      finalResult = result;
      el.btnReplay.disabled = result.turnHistory.every(t => t.mistakes.length === 0);
      allMistakes = result.turnHistory.flatMap((t, i) =>
        t.mistakes.map(m => ({ ...m, turnIndex: i }))
      );
      showGameOver(result);
    },
  });

  game.start();
  startTimer(timeLeft);
}

function startTimer(seconds) {
  stopTimer();
  timeLeft = seconds;
  updateTimeDisplay();
  timerId = setInterval(() => {
    timeLeft--;
    updateTimeDisplay();
    if (timeLeft <= 0) {
      stopTimer();
      addLog('bad', '⏱ 时间到！自动提交本轮');
      if (game) game.submitTurn();
    }
  }, 1000);
}

function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function updateTimeDisplay() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  el.hudTime.textContent = `${m}:${String(s).padStart(2, '0')}`;
  el.hudTime.style.color = timeLeft <= 10 ? '#ff7b7b' : '';
}

function addLog(type, text) {
  const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const li = document.createElement('li');
  li.className = type;
  li.innerHTML = `<span class="t">${t}</span>${text}`;
  el.logList.insertBefore(li, el.logList.firstChild);
  while (el.logList.children.length > 60) el.logList.removeChild(el.logList.lastChild);
}

function clearLog() {
  el.logList.innerHTML = '';
}

function updateReplayUI() {
  el.replayIndex.textContent = `${replayIndex + 1} / ${allMistakes.length}`;
  const m = allMistakes[replayIndex];
  if (!m) {
    el.replayText.textContent = '暂无错误记录';
    return;
  }
  el.replayText.textContent =
    `第 ${m.turnIndex + 1} 回合 · ${m.bookTitle}\n` +
    `类型：${m.bookKind} · 放置：${formatPlacement(m.placed)}\n` +
    `原因：${m.reason}`;
}

function formatPlacement(p) {
  if (!p) return '（未放置）';
  if (p.type === 'dropzone') return p.label;
  if (p.type === 'shelf') return `货架 ${p.label}`;
  if (p.type === 'returnSlip') return `退货单 ${p.id}`;
  return String(p);
}

function showGameOver(result) {
  const level = getLevel(selectedLevel);
  const win = result.reason === 'complete' && result.mistakes < level.maxMistakes;

  el.overlayTitle.textContent = win ? '🎉 通关' : '💡 本局结束';
  el.overlayText.textContent = win
    ? '恭喜完成本关！导出报告可以复盘每本书的处理情况。'
    : result.reason === 'mistakes' ? `失误超过 ${level.maxMistakes} 次，挑战失败。` : '';

  const totalCorrect = result.turnHistory.reduce((s, t) => s + t.results.correct, 0);
  const totalWrong = result.mistakes;
  const accuracy = totalCorrect + totalWrong > 0
    ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;

  el.overlayStats.innerHTML = `
    <div><span>最终得分</span><span>${result.score}</span></div>
    <div><span>正确数</span><span>${totalCorrect}</span></div>
    <div><span>失误数</span><span>${totalWrong}</span></div>
    <div><span>正确率</span><span>${accuracy}%</span></div>
    <div><span>完成回合</span><span>${result.turnHistory.length} / ${level.turns}</span></div>
    <div><span>关卡</span><span>${level.name}</span></div>
  `;

  el.overlayNext.hidden = !win || selectedLevel >= 2;
  el.overlay.hidden = false;
}

function hideOverlay() {
  el.overlay.hidden = true;
}

function exportReport() {
  if (!finalResult) return;
  const level = getLevel(selectedLevel);
  const rows = [
    ['关卡', level.name, '', '', ''],
    ['最终得分', finalResult.score, '', '', ''],
    ['失误', finalResult.mistakes, '', '', ''],
    ['', '', '', '', ''],
    ['回合', '正确', '错误', '书名', '失误原因'],
  ];

  for (const t of finalResult.turnHistory) {
    if (t.mistakes.length === 0) {
      rows.push([`第 ${t.turnIndex + 1} 回合`, t.results.correct, t.results.wrong, '（无失误）', '']);
    } else {
      t.mistakes.forEach((m, i) => {
        rows.push([
          i === 0 ? `第 ${t.turnIndex + 1} 回合` : '',
          i === 0 ? String(t.results.correct) : '',
          i === 0 ? String(t.results.wrong) : '',
          m.bookTitle,
          m.reason,
        ]);
      });
    }
  }

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `书店退货整理报告_${level.id}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  addLog('info', '📄 已导出结算报告 CSV');
}

init();
