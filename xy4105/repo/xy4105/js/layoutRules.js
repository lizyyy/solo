export const VALIDATION_ERRORS = {
    NONE: 'none',
    WRONG_CHARACTER: 'wrong_character',
    OUT_OF_BOUNDS: 'out_of_bounds',
    FORBIDDEN_CELL: 'forbidden_cell',
    INVALID_ORDER: 'invalid_order',
    CELL_OCCUPIED: 'cell_occupied',
    INVALID_PUNCTUATION: 'invalid_punctuation'
};

export const PUNCTUATION = {
    HORIZONTAL: ['，', '。', '、', '：', '；', '？', '！', '「', '」', '『', '』', '（', '）', '【', '】'],
    VERTICAL: ['︐', '︒', '︑', '︓', '︔', '︖', '︕', '﹁', '﹂', '﹃', '﹄', '︵', '︶', '︗', '︘']
};

export class LayoutRules {
    constructor() {
        this.currentLevel = null;
        this.gridState = [];
    }

    init(level) {
        this.currentLevel = level;
        this.initGridState();
    }

    initGridState() {
        const { rows, cols } = this.currentLevel.gridSize;
        this.gridState = [];
        
        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                const isForbidden = this.isForbiddenCell(r, c);
                row.push({
                    row: r,
                    col: c,
                    character: null,
                    isForbidden: isForbidden,
                    forbiddenReason: isForbidden ? this.getForbiddenReason(r, c) : null
                });
            }
            this.gridState.push(row);
        }
    }

    isForbiddenCell(row, col) {
        if (!this.currentLevel.forbiddenCells) return false;
        return this.currentLevel.forbiddenCells.some(
            cell => cell.row === row && cell.col === col
        );
    }

    getForbiddenReason(row, col) {
        if (!this.currentLevel.forbiddenCells) return null;
        const cell = this.currentLevel.forbiddenCells.find(
            c => c.row === row && c.col === col
        );
        return cell ? cell.reason : null;
    }

    isCellInBounds(row, col) {
        const { rows, cols } = this.currentLevel.gridSize;
        return row >= 0 && row < rows && col >= 0 && col < cols;
    }

    isCellOccupied(row, col) {
        if (!this.isCellInBounds(row, col)) return false;
        return this.gridState[row][col].character !== null;
    }

    getGridState() {
        return JSON.parse(JSON.stringify(this.gridState));
    }

    setGridState(state) {
        this.gridState = JSON.parse(JSON.stringify(state));
    }

    placeCharacter(character, row, col) {
        const validation = this.validatePlacement(character, row, col);
        
        if (validation.valid) {
            this.gridState[row][col].character = character;
        }
        
        return validation;
    }

    removeCharacter(row, col) {
        if (!this.isCellInBounds(row, col)) {
            return { success: false, error: '单元格越界' };
        }
        
        const cell = this.gridState[row][col];
        if (cell.character === null) {
            return { success: false, error: '单元格为空' };
        }
        
        const removedChar = cell.character;
        cell.character = null;
        
        return { success: true, character: removedChar };
    }

    moveCharacter(fromRow, fromCol, toRow, toCol) {
        const fromCell = this.gridState[fromRow]?.[fromCol];
        if (!fromCell || fromCell.character === null) {
            return { valid: false, error: VALIDATION_ERRORS.OUT_OF_BOUNDS, message: '源位置无效' };
        }

        const character = fromCell.character;
        const validation = this.validatePlacement(character, toRow, toCol);
        
        if (validation.valid) {
            fromCell.character = null;
            this.gridState[toRow][toCol].character = character;
        }
        
        return validation;
    }

    validatePlacement(character, row, col) {
        if (!this.isCellInBounds(row, col)) {
            return {
                valid: false,
                error: VALIDATION_ERRORS.OUT_OF_BOUNDS,
                message: `位置 (${row}, ${col}) 超出版心范围`
            };
        }

        if (this.isForbiddenCell(row, col)) {
            const reason = this.getForbiddenReason(row, col) || '此处为禁排格';
            return {
                valid: false,
                error: VALIDATION_ERRORS.FORBIDDEN_CELL,
                message: reason
            };
        }

        if (this.isCellOccupied(row, col)) {
            return {
                valid: false,
                error: VALIDATION_ERRORS.CELL_OCCUPIED,
                message: '该位置已有活字'
            };
        }

        if (!this.isValidCharacterForLevel(character)) {
            return {
                valid: false,
                error: VALIDATION_ERRORS.WRONG_CHARACTER,
                message: `活字"${character}"不属于本关字库`
            };
        }

        const punctuationValidation = this.validatePunctuation(character, row, col);
        if (!punctuationValidation.valid) {
            return punctuationValidation;
        }

        const orderValidation = this.validateOrder(character, row, col);
        if (!orderValidation.valid) {
            return orderValidation;
        }

        return { valid: true };
    }

    isValidCharacterForLevel(character) {
        return this.currentLevel.characterPool.includes(character);
    }

    validatePunctuation(character, row, col) {
        const direction = this.currentLevel.punctuationDirection || 'horizontal';
        const validPunctuation = direction === 'vertical' 
            ? PUNCTUATION.VERTICAL 
            : PUNCTUATION.HORIZONTAL;
        const invalidPunctuation = direction === 'vertical' 
            ? PUNCTUATION.HORIZONTAL 
            : PUNCTUATION.VERTICAL;

        if (invalidPunctuation.includes(character)) {
            const directionName = direction === 'vertical' ? '竖排' : '横排';
            const correctForm = this.getCorrectPunctuationForm(character, direction);
            return {
                valid: false,
                error: VALIDATION_ERRORS.INVALID_PUNCTUATION,
                message: `本关为${directionName}版式，标点"${character}"应使用${correctForm || '正确的竖排形式'}`
            };
        }

        return { valid: true };
    }

    getCorrectPunctuationForm(punctuation, direction) {
        const horizontalToVertical = {
            '，': '︐', '。': '︒', '、': '︑', '：': '︓',
            '；': '︔', '？': '︖', '！': '︕', '「': '﹁',
            '」': '﹂', '『': '﹃', '』': '﹄', '（': '︵',
            '）': '︶', '【': '︗', '】': '︘'
        };
        
        const verticalToHorizontal = {};
        for (const [h, v] of Object.entries(horizontalToVertical)) {
            verticalToHorizontal[v] = h;
        }

        if (direction === 'vertical') {
            return horizontalToVertical[punctuation];
        } else {
            return verticalToHorizontal[punctuation];
        }
    }

    validateOrder(character, row, col) {
        const target = this.currentLevel.targetSentence;
        const { rows, cols } = this.currentLevel.gridSize;
        const direction = this.currentLevel.punctuationDirection || 'horizontal';

        const tempGrid = this.getGridState();
        tempGrid[row][col].character = character;

        const currentSequence = this.extractReadingSequence(tempGrid, direction);
        const filledPositions = currentSequence.filter(c => c !== null);

        if (filledPositions.length === 0) {
            return { valid: true };
        }

        for (let i = 0; i < filledPositions.length; i++) {
            if (filledPositions[i] !== target[i]) {
                return {
                    valid: false,
                    error: VALIDATION_ERRORS.INVALID_ORDER,
                    message: `放置顺序不对，第${i + 1}位应为"${target[i]}"而非"${filledPositions[i]}"`
                };
            }
        }

        return { valid: true };
    }

    extractReadingSequence(grid, direction) {
        const sequence = [];
        const { rows, cols } = this.currentLevel.gridSize;

        if (direction === 'horizontal' || direction === 'horizontal-rl') {
            for (let r = 0; r < rows; r++) {
                if (direction === 'horizontal-rl') {
                    for (let c = cols - 1; c >= 0; c--) {
                        if (!grid[r][c].isForbidden) {
                            sequence.push(grid[r][c].character);
                        }
                    }
                } else {
                    for (let c = 0; c < cols; c++) {
                        if (!grid[r][c].isForbidden) {
                            sequence.push(grid[r][c].character);
                        }
                    }
                }
            }
        } else if (direction === 'vertical') {
            for (let c = cols - 1; c >= 0; c--) {
                for (let r = 0; r < rows; r++) {
                    if (!grid[r][c].isForbidden) {
                        sequence.push(grid[r][c].character);
                    }
                }
            }
        }

        return sequence;
    }

    getPlacedCharacters() {
        const placed = [];
        const { rows, cols } = this.currentLevel.gridSize;
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = this.gridState[r][c];
                if (cell.character !== null) {
                    placed.push({
                        character: cell.character,
                        row: r,
                        col: c
                    });
                }
            }
        }
        
        return placed;
    }

    getAvailableCharactersInPool() {
        const placed = this.getPlacedCharacters().map(p => p.character);
        const pool = [...this.currentLevel.characterPool];
        
        placed.forEach(char => {
            const index = pool.indexOf(char);
            if (index > -1) {
                pool.splice(index, 1);
            }
        });
        
        return pool;
    }

    checkCompletion() {
        const direction = this.currentLevel.punctuationDirection || 'horizontal';
        const sequence = this.extractReadingSequence(this.gridState, direction);
        const target = this.currentLevel.targetSentence;
        
        const filledSequence = sequence.slice(0, target.length);
        
        if (filledSequence.some(c => c === null)) {
            return { complete: false, message: '还有活字未放置' };
        }
        
        const currentText = filledSequence.join('');
        
        if (currentText === target) {
            return { complete: true, message: '恭喜！排版完成！' };
        } else {
            return { complete: false, message: '文本顺序不正确，请检查' };
        }
    }

    getReadingOrder() {
        const direction = this.currentLevel.punctuationDirection || 'horizontal';
        const positions = [];
        const { rows, cols } = this.currentLevel.gridSize;

        if (direction === 'horizontal' || direction === 'horizontal-rl') {
            for (let r = 0; r < rows; r++) {
                if (direction === 'horizontal-rl') {
                    for (let c = cols - 1; c >= 0; c--) {
                        if (!this.isForbiddenCell(r, c)) {
                            positions.push({ row: r, col: c });
                        }
                    }
                } else {
                    for (let c = 0; c < cols; c++) {
                        if (!this.isForbiddenCell(r, c)) {
                            positions.push({ row: r, col: c });
                        }
                    }
                }
            }
        } else if (direction === 'vertical') {
            for (let c = cols - 1; c >= 0; c--) {
                for (let r = 0; r < rows; r++) {
                    if (!this.isForbiddenCell(r, c)) {
                        positions.push({ row: r, col: c });
                    }
                }
            }
        }

        return positions;
    }

    getNextExpectedPosition() {
        const placed = this.getPlacedCharacters();
        const readingOrder = this.getReadingOrder();
        
        return readingOrder[placed.length] || null;
    }
}