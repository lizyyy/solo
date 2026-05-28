var SudokuSolver = (function() {

    function getCandidates(grid, idx) {
        var r = Math.floor(idx / 9);
        var c = idx % 9;
        var br = Math.floor(r / 3) * 3;
        var bc = Math.floor(c / 3) * 3;
        var used = new Set();
        for (var i = 0; i < 9; i++) {
            used.add(grid[r * 9 + i]);
            used.add(grid[i * 9 + c]);
        }
        for (var rr = br; rr < br + 3; rr++) {
            for (var cc = bc; cc < bc + 3; cc++) {
                used.add(grid[rr * 9 + cc]);
            }
        }
        var candidates = [];
        for (var v = 1; v <= 9; v++) {
            if (!used.has(v)) candidates.push(v);
        }
        return candidates;
    }

    function solve(board, findAll) {
        var maxSolutions = findAll ? 2 : 1;
        var solutions = [];
        var grid = board.cells.map(function(c) { return c.value; });

        function backtrack(grid) {
            if (solutions.length >= maxSolutions) return;

            var minCandidates = 10;
            var bestIdx = -1;
            var bestCandidates = [];

            for (var i = 0; i < 81; i++) {
                if (grid[i] === 0) {
                    var cands = getCandidates(grid, i);
                    if (cands.length === 0) return;
                    if (cands.length < minCandidates) {
                        minCandidates = cands.length;
                        bestIdx = i;
                        bestCandidates = cands;
                    }
                }
            }

            if (bestIdx === -1) {
                solutions.push(grid.slice());
                return;
            }

            for (var j = 0; j < bestCandidates.length; j++) {
                grid[bestIdx] = bestCandidates[j];
                backtrack(grid);
                if (solutions.length >= maxSolutions) {
                    grid[bestIdx] = 0;
                    return;
                }
                grid[bestIdx] = 0;
            }
        }

        backtrack(grid);
        return solutions;
    }

    function hasUniqueSolution(board) {
        var solutions = solve(board, true);
        return solutions.length === 1;
    }

    function getSolution(board) {
        var solutions = solve(board, false);
        return solutions.length > 0 ? solutions[0] : null;
    }

    function countSolutions(board, max) {
        var maxSol = max || 2;
        var count = 0;
        var grid = board.cells.map(function(c) { return c.value; });

        function backtrack(grid) {
            if (count >= maxSol) return;

            var minCandidates = 10;
            var bestIdx = -1;
            var bestCandidates = [];

            for (var i = 0; i < 81; i++) {
                if (grid[i] === 0) {
                    var cands = getCandidates(grid, i);
                    if (cands.length === 0) return;
                    if (cands.length < minCandidates) {
                        minCandidates = cands.length;
                        bestIdx = i;
                        bestCandidates = cands;
                    }
                }
            }

            if (bestIdx === -1) {
                count++;
                return;
            }

            for (var j = 0; j < bestCandidates.length; j++) {
                grid[bestIdx] = bestCandidates[j];
                backtrack(grid);
                if (count >= maxSol) {
                    grid[bestIdx] = 0;
                    return;
                }
                grid[bestIdx] = 0;
            }
        }

        backtrack(grid);
        return count;
    }

    return {
        solve: solve,
        hasUniqueSolution: hasUniqueSolution,
        getSolution: getSolution,
        countSolutions: countSolutions
    };
})();
