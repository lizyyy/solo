var HintSystem = (function() {

    var TECHNIQUE_NAMES = {
        'naked_single': '唯一候选数',
        'hidden_single': '隐性唯一'
    };

    function getTechniqueName(technique) {
        return TECHNIQUE_NAMES[technique] || technique;
    }

    function findNextStep(board) {
        var nakedSingles = board.findNakedSingles();
        var hiddenSingles = board.findHiddenSingles();
        var allSteps = nakedSingles.concat(hiddenSingles);
        if (allSteps.length === 0) return null;
        return allSteps[0];
    }

    function pickNextStep(board, hintHistory) {
        var nakedSingles = board.findNakedSingles();
        var hiddenSingles = board.findHiddenSingles();
        var allSteps = nakedSingles.concat(hiddenSingles);

        if (allSteps.length === 0) return null;

        var hintedCells = {};
        for (var i = 0; i < hintHistory.length; i++) {
            var h = hintHistory[i];
            if (!hintedCells[h.cell]) hintedCells[h.cell] = 0;
            hintedCells[h.cell]++;
        }

        for (var j = 0; j < allSteps.length; j++) {
            if (!hintedCells[allSteps[j].index]) return allSteps[j];
        }

        var minHints = Infinity;
        var best = null;
        for (var k = 0; k < allSteps.length; k++) {
            var count = hintedCells[allSteps[k].index] || 0;
            if (count < minHints) {
                minHints = count;
                best = allSteps[k];
            }
        }
        return best;
    }

    function getHint(board, level, hintHistory) {
        var step = pickNextStep(board, hintHistory || []);

        if (!step) {
            return {
                type: 'no_hint',
                level: 0,
                message: '没有找到基础技巧的提示，可能需要更高级的推理技巧',
                cell: null,
                technique: null,
                value: null
            };
        }

        var row = Math.floor(step.index / 9) + 1;
        var col = (step.index % 9) + 1;
        var box = board.getBox(step.index) + 1;
        var techName = getTechniqueName(step.technique);

        switch (level) {
            case 1:
                return {
                    type: 'direction',
                    level: 1,
                    message: '尝试观察第' + row + '行 / 第' + col + '列 / 宫' + box,
                    cell: step.index,
                    technique: step.technique,
                    value: null
                };
            case 2:
                return {
                    type: 'technique',
                    level: 2,
                    message: 'R' + row + 'C' + col + ' 可以通过「' + techName + '」确定',
                    cell: step.index,
                    technique: step.technique,
                    value: null
                };
            case 3:
                return {
                    type: 'answer',
                    level: 3,
                    message: 'R' + row + 'C' + col + ' = ' + step.value + '（' + techName + '）',
                    cell: step.index,
                    technique: step.technique,
                    value: step.value
                };
            default:
                return {
                    type: 'error',
                    level: 0,
                    message: '无效的提示级别',
                    cell: null,
                    technique: null,
                    value: null
                };
        }
    }

    function checkOverHinting(board, hintHistory) {
        var filledByHints = 0;
        for (var i = 0; i < hintHistory.length; i++) {
            if (hintHistory[i].level === 3 && hintHistory[i].value) filledByHints++;
        }
        var totalEmpty = 81 - board.givenCount();
        if (totalEmpty === 0) return { overHinted: false, ratio: 0, message: '' };
        var ratio = filledByHints / totalEmpty;
        if (ratio > 0.5) {
            return {
                overHinted: true,
                ratio: ratio,
                message: '答案提示已占空格的' + Math.round(ratio * 100) + '%，建议多独立思考'
            };
        }
        if (ratio > 0.3) {
            return {
                overHinted: false,
                ratio: ratio,
                message: '提示使用比例：' + Math.round(ratio * 100) + '%，注意控制提示频率'
            };
        }
        return { overHinted: false, ratio: ratio, message: '' };
    }

    return {
        getHint: getHint,
        checkOverHinting: checkOverHinting,
        getTechniqueName: getTechniqueName,
        findNextStep: findNextStep,
        TECHNIQUE_NAMES: TECHNIQUE_NAMES
    };
})();
