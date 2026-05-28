var SudokuIO = (function() {

    var importedHashes = new Set();

    function parseString(content) {
        content = content.trim();
        var board = new SudokuEngine.Board();
        var raw = content.replace(/[^0-9.]/g, '');
        var loadResult;
        if (raw.length === 81) {
            loadResult = board.loadFromString(raw);
        } else {
            var lines = content.split(/[\r\n]+/).filter(function(l) { return l.trim().length > 0; });
            var values = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].replace(/[|+-\s]/g, '');
                for (var j = 0; j < line.length; j++) {
                    var ch = line[j];
                    if (/[0-9.]/.test(ch)) {
                        values.push(ch === '.' ? 0 : parseInt(ch));
                    }
                }
            }
            if (values.length === 81) {
                loadResult = board.loadFromString(values.map(function(v) { return v === 0 ? '.' : v.toString(); }).join(''));
            } else {
                return { ok: false, error: '无法解析盘面格式，需要81个数字或点号，实际为' + values.length + '个' };
            }
        }
        if (!loadResult.ok) {
            return loadResult;
        }
        return { ok: true, data: { board: board } };
    }

    function parseJSON(content) {
        try {
            var data = JSON.parse(content);
            var result = {};
            if (data.board) {
                var board = new SudokuEngine.Board();
                if (typeof data.board === 'string') {
                    var r = board.loadFromString(data.board);
                    if (!r.ok) return r;
                    result.board = board;
                } else {
                    board.fromJSON(data.board);
                    result.board = board;
                }
            }
            if (data.candidates) {
                result.candidates = data.candidates;
            }
            if (data.difficulty) {
                result.difficulty = data.difficulty;
            }
            if (data.userSteps) {
                result.userSteps = data.userSteps;
            }
            if (data.hintHistory) {
                result.hintHistory = data.hintHistory;
            }
            if (data.report) {
                result.report = data.report;
            }
            return { ok: true, data: result };
        } catch (e) {
            return { ok: false, error: 'JSON 解析失败: ' + e.message };
        }
    }

    function detectGaps(data) {
        var gaps = [];
        if (!data.board) {
            gaps.push('缺少数独盘面数据');
        }
        if (data.candidates && Array.isArray(data.candidates)) {
            var missingCandidates = 0;
            for (var i = 0; i < data.candidates.length; i++) {
                if (!data.candidates[i] || data.candidates[i].length === 0) {
                    missingCandidates++;
                }
            }
            if (missingCandidates > 0) {
                gaps.push('有 ' + missingCandidates + ' 个格子缺少候选数信息');
            }
        }
        if (!data.difficulty) {
            gaps.push('缺少难度等级信息');
        }
        if (!data.userSteps || data.userSteps.length === 0) {
            gaps.push('缺少用户解题步骤');
        }
        if (!data.hintHistory || data.hintHistory.length === 0) {
            gaps.push('缺少提示使用历史');
        }
        return gaps;
    }

    function checkForDuplicate(board) {
        var hash = board.hash();
        var exists = importedHashes.has(hash);
        return {
            exists: exists,
            hash: hash
        };
    }

    function recordImport(hash) {
        importedHashes.add(hash);
    }

    function clearImportHistory() {
        importedHashes.clear();
    }

    function handleDuplicate(hash, mode) {
        switch (mode) {
            case 'skip':
                return { action: 'skip', message: '已跳过重复导入' };
            case 'overwrite':
                return { action: 'overwrite', message: '已覆盖旧数据' };
            case 'append':
                return { action: 'append', message: '已追加为新会话' };
            default:
                return { action: 'ask', message: '需要用户选择处理方式' };
        }
    }

    function exportBoard(board, format) {
        switch (format) {
            case 'string':
                return board.toString();
            case 'json':
                return JSON.stringify(board.toJSON(), null, 2);
            case 'pretty':
                var lines = [];
                for (var r = 0; r < 9; r++) {
                    var line = '';
                    for (var c = 0; c < 9; c++) {
                        var v = board.cells[r * 9 + c].value;
                        line += (v === 0 ? '.' : v) + ' ';
                        if (c === 2 || c === 5) line += '| ';
                    }
                    lines.push(line.trim());
                    if (r === 2 || r === 5) {
                        lines.push('------+-------+------');
                    }
                }
                return lines.join('\n');
            default:
                return board.toString();
        }
    }

    function exportSession(session, format) {
        var data = {
            board: session.board ? session.board.toJSON() : null,
            difficulty: session.difficulty || null,
            hintHistory: session.hintHistory || [],
            userSteps: session.userSteps || [],
            exportTime: new Date().toISOString()
        };
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            default:
                return JSON.stringify(data);
        }
    }

    return {
        parseString: parseString,
        parseJSON: parseJSON,
        detectGaps: detectGaps,
        checkForDuplicate: checkForDuplicate,
        recordImport: recordImport,
        clearImportHistory: clearImportHistory,
        handleDuplicate: handleDuplicate,
        exportBoard: exportBoard,
        exportSession: exportSession
    };
})();
