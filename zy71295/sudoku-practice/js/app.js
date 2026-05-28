var SudokuApp = (function() {
    var board;
    var history;
    var selectedCell = -1;
    var hintHistory = [];
    var currentHint = null;
    var startTime = null;
    var difficulty = 'unknown';
    var duplicateHandler = null;
    var pendingImportData = null;

    function init() {
        board = new SudokuEngine.Board();
        history = HistoryManager.create();
        startTime = Date.now();

        renderBoard();
        bindEvents();
        updateStatus();
        updateHistoryDisplay();

        loadSamplePuzzle();
    }

    function loadSamplePuzzle() {
        var sample = '..1.5....58.2.7....31...9..45....7..7...1..8....926..3...26....9.8.73....6.8..';
        board.loadFromString(sample);
        board.detectConflicts();
        renderBoard();
        updateStatus();

        HistoryManager.pushAction(history, {
            type: 'import',
            index: -1,
            oldValue: 0,
            newValue: 0,
            oldCandidates: [],
            newCandidates: [],
            wasGiven: false,
            isGiven: false,
            description: '加载示例盘面'
        });
        updateHistoryDisplay();
    }

    function renderBoard() {
        var boardEl = document.getElementById('sudokuBoard');
        boardEl.innerHTML = '';

        for (var r = 0; r < 9; r++) {
            var rowEl = document.createElement('div');
            rowEl.className = 'board-row';

            for (var c = 0; c < 9; c++) {
                var idx = r * 9 + c;
                var cell = board.cells[idx];
                var cellEl = document.createElement('div');
                cellEl.className = 'board-cell';
                cellEl.dataset.index = idx;

                if (cell.given) cellEl.classList.add('given');
                else if (cell.value > 0) cellEl.classList.add('user-filled');

                if (idx === selectedCell) cellEl.classList.add('selected');

                if (cell.conflicts && cell.conflicts.size > 0) {
                    cellEl.classList.add('conflict');
                }

                if (currentHint && currentHint.cell === idx) {
                    cellEl.classList.add('hint-cell');
                }

                if (cell.value > 0) {
                    cellEl.textContent = cell.value;
                } else if (cell.candidates && cell.candidates.size > 0) {
                    var candEl = document.createElement('div');
                    candEl.className = 'candidates';
                    for (var n = 1; n <= 9; n++) {
                        var numEl = document.createElement('span');
                        numEl.className = 'candidate-num';
                        if (cell.candidates.has(n)) {
                            numEl.textContent = n;
                        }
                        candEl.appendChild(numEl);
                    }
                    cellEl.appendChild(candEl);
                }

                cellEl.addEventListener('click', function(e) {
                    selectCell(parseInt(e.currentTarget.dataset.index));
                });

                rowEl.appendChild(cellEl);
            }

            boardEl.appendChild(rowEl);
        }
    }

    function selectCell(idx) {
        selectedCell = idx;
        renderBoard();
    }

    function bindEvents() {
        var numBtns = document.querySelectorAll('.num-btn');
        for (var i = 0; i < numBtns.length; i++) {
            numBtns[i].addEventListener('click', function(e) {
                var val = parseInt(e.currentTarget.dataset.value);
                setValue(val);
            });
        }

        document.getElementById('undoBtn').addEventListener('click', undo);
        document.getElementById('redoBtn').addEventListener('click', redo);
        document.getElementById('checkBtn').addEventListener('click', checkBoard);
        document.getElementById('resetBtn').addEventListener('click', resetBoard);

        document.getElementById('hint1Btn').addEventListener('click', function() { getHint(1); });
        document.getElementById('hint2Btn').addEventListener('click', function() { getHint(2); });
        document.getElementById('hint3Btn').addEventListener('click', function() { getHint(3); });

        document.getElementById('importBtn').addEventListener('click', importPuzzle);
        document.getElementById('exportBoardBtn').addEventListener('click', exportBoard);
        document.getElementById('exportReportBtn').addEventListener('click', exportReport);

        document.getElementById('generateReportBtn').addEventListener('click', generateReport);

        document.getElementById('skipBtn').addEventListener('click', function() { handleDuplicate('skip'); });
        document.getElementById('overwriteBtn').addEventListener('click', function() { handleDuplicate('overwrite'); });
        document.getElementById('appendBtn').addEventListener('click', function() { handleDuplicate('append'); });

        document.addEventListener('keydown', handleKeydown);
    }

    function handleKeydown(e) {
        if (selectedCell < 0) return;

        if (e.key >= '1' && e.key <= '9') {
            setValue(parseInt(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
            setValue(0);
        } else if (e.key === 'ArrowUp' && selectedCell >= 9) {
            selectCell(selectedCell - 9);
        } else if (e.key === 'ArrowDown' && selectedCell < 72) {
            selectCell(selectedCell + 9);
        } else if (e.key === 'ArrowLeft' && selectedCell % 9 > 0) {
            selectCell(selectedCell - 1);
        } else if (e.key === 'ArrowRight' && selectedCell % 9 < 8) {
            selectCell(selectedCell + 1);
        }
    }

    function setValue(val) {
        if (selectedCell < 0) return;
        var cell = board.cells[selectedCell];
        if (cell.given) return;

        var oldVal = cell.value;
        if (oldVal === val) return;

        var action = board.setValue(selectedCell, val, false);
        action.type = val > 0 ? 'set_value' : 'clear_value';

        board.detectConflicts();

        HistoryManager.pushAction(history, action);
        currentHint = null;

        renderBoard();
        updateStatus();
        updateHistoryDisplay();
        updateUndoRedoButtons();
    }

    function undo() {
        if (!HistoryManager.canUndo(history)) return;
        HistoryManager.undo(history, board);
        board.detectConflicts();
        currentHint = null;
        renderBoard();
        updateStatus();
        updateHistoryDisplay();
        updateUndoRedoButtons();
    }

    function redo() {
        if (!HistoryManager.canRedo(history)) return;
        HistoryManager.redo(history, board);
        board.detectConflicts();
        currentHint = null;
        renderBoard();
        updateStatus();
        updateHistoryDisplay();
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        document.getElementById('undoBtn').disabled = !HistoryManager.canUndo(history);
        document.getElementById('redoBtn').disabled = !HistoryManager.canRedo(history);
    }

    function checkBoard() {
        board.detectConflicts();

        if (!SudokuSolver.hasUniqueSolution(board)) {
            showHint('⚠️ 警告：当前盘面不存在唯一解！', 'l3');
        } else {
            showHint('✓ 盘面有效，存在唯一解', 'l1');
        }

        renderBoard();
        updateStatus();
    }

    function resetBoard() {
        for (var i = 0; i < 81; i++) {
            if (!board.cells[i].given) {
                board.cells[i].value = 0;
                board.cells[i].conflicts.clear();
            }
        }
        board.propagateAll();
        board.detectConflicts();

        hintHistory = [];
        currentHint = null;
        history = HistoryManager.create();
        startTime = Date.now();

        renderBoard();
        updateStatus();
        updateHistoryDisplay();
        updateUndoRedoButtons();
    }

    function getHint(level) {
        board.detectConflicts();
        if (board.hasConflicts()) {
            showHint('⚠️ 先解决盘面中的冲突再获取提示', 'l3');
            return;
        }

        var hint = HintSystem.getHint(board, level, hintHistory);
        currentHint = hint;
        hintHistory.push(hint);

        HistoryManager.pushHintAction(history, hint);

        var levelClass = level === 1 ? 'l1' : (level === 2 ? 'l2' : 'l3');
        showHint(hint.message, levelClass);

        renderBoard();
        updateStatus();
        updateHistoryDisplay();

        var check = HintSystem.checkOverHinting(board, hintHistory);
        var warningEl = document.getElementById('hintWarning');
        if (check.message) {
            warningEl.textContent = check.message;
            warningEl.style.display = 'block';
            warningEl.className = 'status-item ' + (check.overHinted ? 'error' : 'warning');
        } else {
            warningEl.style.display = 'none';
        }
    }

    function showHint(message, levelClass) {
        var display = document.getElementById('hintDisplay');
        display.innerHTML = '<span class="hint-level ' + (levelClass || 'l1') + '">提示</span>' +
                            '<span class="hint-text">' + message + '</span>';
    }

    function updateStatus() {
        document.getElementById('filledCount').textContent = board.filledCount();
        document.getElementById('hintCount').textContent = hintHistory.length;

        var conflictStatus = document.getElementById('conflictStatus');
        if (board.hasConflicts()) {
            conflictStatus.style.display = 'block';
        } else {
            conflictStatus.style.display = 'none';
        }
    }

    function updateHistoryDisplay() {
        var panel = document.getElementById('historyPanel');
        var log = HistoryManager.getLog(history);

        if (log.length === 0) {
            panel.innerHTML = '<div style="color: #718096; text-align: center; padding: 20px;">暂无操作记录</div>';
            return;
        }

        var html = '';
        var recent = log.slice(-20).reverse();
        for (var i = 0; i < recent.length; i++) {
            var entry = recent[i];
            var typeClass = entry.type === 'hint' ? 'hint' : (entry.type === 'undo' ? 'undo' : 'action');
            var time = new Date(entry.timestamp).toLocaleTimeString();
            var desc = entry.description || entry.message || entry.type;
            html += '<div class="history-item ' + typeClass + '">' +
                    '<div>' + desc + '</div>' +
                    '<div class="history-time">' + time + '</div>' +
                    '</div>';
        }
        panel.innerHTML = html;
    }

    function importPuzzle() {
        var text = document.getElementById('importText').value.trim();
        if (!text) {
            alert('请输入要导入的数据');
            return;
        }

        var result;
        var importData = {};

        if (text.startsWith('{')) {
            result = SudokuIO.parseJSON(text);
            if (result.ok) {
                importData = result.data;
                if (!importData.board) {
                    alert('JSON 中未找到数独盘面数据');
                    return;
                }
            }
        } else {
            result = SudokuIO.parseString(text);
            if (result.ok) {
                importData.board = result;
            }
        }

        if (!result || !result.ok) {
            alert('导入失败: ' + (result ? result.error : '未知错误'));
            return;
        }

        var gaps = SudokuIO.detectGaps(importData);
        showGaps(gaps);

        var check = SudokuIO.checkForDuplicate(importData.board);
        if (check.exists) {
            pendingImportData = importData;
            showDuplicateModal();
            return;
        }

        doImport(importData, 'new');
    }

    function showGaps(gaps) {
        var alertEl = document.getElementById('gapAlert');
        var listEl = document.getElementById('gapList');

        if (gaps.length === 0) {
            alertEl.style.display = 'none';
            return;
        }

        alertEl.style.display = 'block';
        listEl.innerHTML = '';
        for (var i = 0; i < gaps.length; i++) {
            var li = document.createElement('li');
            li.textContent = gaps[i];
            listEl.appendChild(li);
        }
    }

    function showDuplicateModal() {
        document.getElementById('duplicateModal').style.display = 'flex';
    }

    function hideDuplicateModal() {
        document.getElementById('duplicateModal').style.display = 'none';
    }

    function handleDuplicate(mode) {
        hideDuplicateModal();
        if (!pendingImportData) return;

        doImport(pendingImportData, mode);
        pendingImportData = null;
    }

    function doImport(importData, mode) {
        if (mode === 'skip') {
            showHint('已跳过重复导入', 'l1');
            return;
        }

        if (mode !== 'append') {
            board = importData.board;
            hintHistory = importData.hintHistory || [];
            difficulty = importData.difficulty || 'unknown';
            history = HistoryManager.create();
            startTime = Date.now();
        }

        board.detectConflicts();
        SudokuIO.recordImport(board.hash());

        HistoryManager.pushAction(history, {
            type: 'import',
            index: -1,
            oldValue: 0,
            newValue: 0,
            oldCandidates: [],
            newCandidates: [],
            wasGiven: false,
            isGiven: false,
            description: mode === 'append' ? '追加新盘面' : '导入盘面'
        });

        currentHint = null;
        selectedCell = -1;

        renderBoard();
        updateStatus();
        updateHistoryDisplay();
        updateUndoRedoButtons();

        document.getElementById('importText').value = '';
        showHint('导入成功', 'l1');
    }

    function exportBoard() {
        var result = SudokuIO.exportBoard(board, 'pretty');
        document.getElementById('importText').value = result;
        showHint('棋盘已导出到文本框', 'l1');
    }

    function exportReport() {
        var report = ReportGenerator.generateReport({
            board: board,
            history: history,
            hintHistory: hintHistory,
            startTime: startTime,
            endTime: Date.now(),
            difficulty: difficulty
        });
        var text = ReportGenerator.exportReport(report, 'text');
        document.getElementById('importText').value = text;
        showHint('报告已导出到文本框', 'l1');
    }

    function generateReport() {
        var report = ReportGenerator.generateReport({
            board: board,
            history: history,
            hintHistory: hintHistory,
            startTime: startTime,
            endTime: Date.now(),
            difficulty: difficulty
        });

        var display = document.getElementById('reportDisplay');
        display.style.display = 'block';

        var html = '';
        html += '<div class="report-section">';
        html += '<div class="report-section-title">解题概况</div>';
        html += '<div class="report-item"><span>完成状态</span><span class="value">' + report.summary.solutionStatus + '</span></div>';
        html += '<div class="report-item"><span>题目数字</span><span class="value">' + report.summary.givenCount + ' 个</span></div>';
        html += '<div class="report-item"><span>用户填写</span><span class="value">' + report.summary.userFilled + ' 个</span></div>';
        html += '<div class="report-item"><span>剩余空格</span><span class="value">' + report.summary.emptyCount + ' 个</span></div>';
        html += '<div class="report-item"><span>用时</span><span class="value">' + report.summary.duration.text + '</span></div>';
        html += '</div>';

        html += '<div class="report-section">';
        html += '<div class="report-section-title">提示统计</div>';
        html += '<div class="report-item"><span>提示总数</span><span class="value">' + report.hints.total + ' 次</span></div>';
        html += '<div class="report-item"><span>方向提示</span><span class="value">' + report.hints.level1 + ' 次</span></div>';
        html += '<div class="report-item"><span>技巧提示</span><span class="value">' + report.hints.level2 + ' 次</span></div>';
        html += '<div class="report-item"><span>答案提示</span><span class="value">' + report.hints.level3 + ' 次</span></div>';
        html += '</div>';

        if (report.hints.warning) {
            html += '<div class="report-item warning" style="color: #dd6b20;">' + report.hints.warning + '</div>';
        }

        display.innerHTML = html;
    }

    return {
        init: init
    };
})();

document.addEventListener('DOMContentLoaded', SudokuApp.init);
