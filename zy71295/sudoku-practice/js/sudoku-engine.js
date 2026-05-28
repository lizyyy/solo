var SudokuEngine = (function() {
    var SIZE = 9;
    var BOX = 3;

    var peers = [];
    var units = [];

    (function() {
        for (var i = 0; i < 81; i++) {
            var r = Math.floor(i / 9);
            var c = i % 9;
            var br = Math.floor(r / 3) * 3;
            var bc = Math.floor(c / 3) * 3;
            var peerSet = new Set();
            var unitList = [];
            var rowUnit = [];
            var colUnit = [];
            var boxUnit = [];
            for (var cc = 0; cc < 9; cc++) {
                peerSet.add(r * 9 + cc);
                rowUnit.push(r * 9 + cc);
            }
            for (var rr = 0; rr < 9; rr++) {
                peerSet.add(rr * 9 + c);
                colUnit.push(rr * 9 + c);
            }
            for (var rr2 = br; rr2 < br + 3; rr2++) {
                for (var cc2 = bc; cc2 < bc + 3; cc2++) {
                    peerSet.add(rr2 * 9 + cc2);
                    boxUnit.push(rr2 * 9 + cc2);
                }
            }
            peerSet.delete(i);
            peers[i] = Array.from(peerSet);
            unitList.push(rowUnit, colUnit, boxUnit);
            units[i] = unitList;
        }
    })();

    var allUnits = [];
    (function() {
        var r, c, br, bc, unit, rr, cc;
        for (r = 0; r < 9; r++) {
            unit = [];
            for (c = 0; c < 9; c++) unit.push(r * 9 + c);
            allUnits.push(unit);
        }
        for (c = 0; c < 9; c++) {
            unit = [];
            for (r = 0; r < 9; r++) unit.push(r * 9 + c);
            allUnits.push(unit);
        }
        for (br = 0; br < 9; br += 3) {
            for (bc = 0; bc < 9; bc += 3) {
                unit = [];
                for (rr = br; rr < br + 3; rr++) {
                    for (cc = bc; cc < bc + 3; cc++) {
                        unit.push(rr * 9 + cc);
                    }
                }
                allUnits.push(unit);
            }
        }
    })();

    function Board() {
        this.cells = new Array(81);
        this.reset();
    }

    Board.prototype.reset = function() {
        for (var i = 0; i < 81; i++) {
            this.cells[i] = {
                value: 0,
                candidates: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
                given: false,
                conflicts: new Set()
            };
        }
    };

    Board.prototype.loadFromString = function(str) {
        this.reset();
        var s = str.replace(/[^0-9.]/g, '');
        if (s.length !== 81) return { ok: false, error: '需要81个字符，当前' + s.length + '个' };
        for (var i = 0; i < 81; i++) {
            var v = s[i] === '.' ? 0 : parseInt(s[i]);
            if (v > 0) {
                this.cells[i].value = v;
                this.cells[i].given = true;
            }
        }
        this.propagateAll();
        return { ok: true };
    };

    Board.prototype.toString = function() {
        return this.cells.map(function(c) { return c.value === 0 ? '.' : c.value.toString(); }).join('');
    };

    Board.prototype.setValue = function(idx, val, isGiven) {
        var old = this.cells[idx].value;
        var oldCandidates = new Set(this.cells[idx].candidates);
        var wasGiven = this.cells[idx].given;

        this.cells[idx].value = val;
        this.cells[idx].given = isGiven || false;
        if (val > 0) {
            this.cells[idx].candidates.clear();
            this.eliminateFromPeers(idx, val);
        } else {
            this.cells[idx].candidates = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
            this.recalcCandidates(idx);
        }

        return {
            index: idx,
            oldValue: old,
            newValue: val,
            oldCandidates: oldCandidates,
            newCandidates: new Set(this.cells[idx].candidates),
            wasGiven: wasGiven,
            isGiven: this.cells[idx].given
        };
    };

    Board.prototype.propagateAll = function() {
        for (var i = 0; i < 81; i++) {
            if (this.cells[i].value > 0) {
                this.cells[i].candidates.clear();
                this.eliminateFromPeers(i, this.cells[i].value);
            }
        }
    };

    Board.prototype.eliminateFromPeers = function(idx, val) {
        var removed = [];
        var peerList = peers[idx];
        for (var p = 0; p < peerList.length; p++) {
            var pi = peerList[p];
            if (this.cells[pi].candidates.has(val)) {
                this.cells[pi].candidates.delete(val);
                removed.push(pi);
            }
        }
        return removed;
    };

    Board.prototype.recalcCandidates = function(idx) {
        var r = Math.floor(idx / 9);
        var c = idx % 9;
        var br = Math.floor(r / 3) * 3;
        var bc = Math.floor(c / 3) * 3;
        var used = new Set();
        for (var i = 0; i < 9; i++) {
            used.add(this.cells[r * 9 + i].value);
            used.add(this.cells[i * 9 + c].value);
        }
        for (var rr = br; rr < br + 3; rr++) {
            for (var cc = bc; cc < bc + 3; cc++) {
                used.add(this.cells[rr * 9 + cc].value);
            }
        }
        for (var v = 1; v <= 9; v++) {
            if (used.has(v)) this.cells[idx].candidates.delete(v);
        }
    };

    Board.prototype.detectConflicts = function() {
        for (var i = 0; i < 81; i++) {
            this.cells[i].conflicts.clear();
        }
        for (var u = 0; u < allUnits.length; u++) {
            var unit = allUnits[u];
            var valMap = {};
            for (var j = 0; j < unit.length; j++) {
                var idx = unit[j];
                var v = this.cells[idx].value;
                if (v > 0) {
                    if (!valMap[v]) valMap[v] = [];
                    valMap[v].push(idx);
                }
            }
            for (var key in valMap) {
                if (valMap[key].length > 1) {
                    for (var k = 0; k < valMap[key].length; k++) {
                        this.cells[valMap[key][k]].conflicts.add(parseInt(key));
                    }
                }
            }
        }
        return this.hasConflicts();
    };

    Board.prototype.hasConflicts = function() {
        for (var i = 0; i < 81; i++) {
            if (this.cells[i].conflicts.size > 0) return true;
        }
        return false;
    };

    Board.prototype.getConflictCells = function() {
        var result = [];
        for (var i = 0; i < 81; i++) {
            if (this.cells[i].conflicts.size > 0) result.push(i);
        }
        return result;
    };

    Board.prototype.findNakedSingles = function() {
        var results = [];
        for (var i = 0; i < 81; i++) {
            if (this.cells[i].value === 0 && this.cells[i].candidates.size === 1) {
                var val = Array.from(this.cells[i].candidates)[0];
                results.push({ index: i, value: val, technique: 'naked_single' });
            }
        }
        return results;
    };

    Board.prototype.findHiddenSingles = function() {
        var results = [];
        var checked = new Set();
        for (var u = 0; u < allUnits.length; u++) {
            var unit = allUnits[u];
            for (var v = 1; v <= 9; v++) {
                var positions = [];
                for (var j = 0; j < unit.length; j++) {
                    var idx = unit[j];
                    if (this.cells[idx].candidates.has(v)) {
                        positions.push(idx);
                    }
                }
                if (positions.length === 1) {
                    var pidx = positions[0];
                    var key = pidx + '-' + v;
                    if (!checked.has(key) && this.cells[pidx].value === 0) {
                        checked.add(key);
                        results.push({ index: pidx, value: v, technique: 'hidden_single' });
                    }
                }
            }
        }
        return results;
    };

    Board.prototype.getCell = function(idx) {
        return {
            value: this.cells[idx].value,
            candidates: new Set(this.cells[idx].candidates),
            given: this.cells[idx].given,
            conflicts: new Set(this.cells[idx].conflicts),
            index: idx
        };
    };

    Board.prototype.filledCount = function() {
        var count = 0;
        for (var i = 0; i < 81; i++) {
            if (this.cells[i].value > 0) count++;
        }
        return count;
    };

    Board.prototype.givenCount = function() {
        var count = 0;
        for (var i = 0; i < 81; i++) {
            if (this.cells[i].given) count++;
        }
        return count;
    };

    Board.prototype.isComplete = function() {
        for (var i = 0; i < 81; i++) {
            if (this.cells[i].value === 0) return false;
        }
        return true;
    };

    Board.prototype.clone = function() {
        var b = new Board();
        for (var i = 0; i < 81; i++) {
            b.cells[i] = {
                value: this.cells[i].value,
                candidates: new Set(this.cells[i].candidates),
                given: this.cells[i].given,
                conflicts: new Set(this.cells[i].conflicts)
            };
        }
        return b;
    };

    Board.prototype.toJSON = function() {
        return {
            cells: this.cells.map(function(c) {
                return {
                    value: c.value,
                    candidates: Array.from(c.candidates),
                    given: c.given
                };
            })
        };
    };

    Board.prototype.fromJSON = function(data) {
        this.reset();
        if (!data || !data.cells || data.cells.length !== 81) return false;
        for (var i = 0; i < 81; i++) {
            this.cells[i].value = data.cells[i].value || 0;
            this.cells[i].candidates = new Set(data.cells[i].candidates || []);
            this.cells[i].given = data.cells[i].given || false;
        }
        return true;
    };

    Board.prototype.getRow = function(idx) { return Math.floor(idx / 9); };
    Board.prototype.getCol = function(idx) { return idx % 9; };
    Board.prototype.getBox = function(idx) {
        var r = Math.floor(idx / 9);
        var c = idx % 9;
        return Math.floor(r / 3) * 3 + Math.floor(c / 3);
    };

    Board.prototype.hash = function() {
        return this.toString();
    };

    return {
        Board: Board,
        peers: peers,
        units: units,
        allUnits: allUnits,
        SIZE: SIZE,
        BOX: BOX
    };
})();
