import { EchoCalculator } from '../physics/EchoCalculator.js';
import { CollisionDetector } from '../physics/CollisionDetector.js';

export class ErrorDetector {
    constructor(options = {}) {
        this.angleTolerance = options.angleTolerance ?? 1;
        this.timeTolerance = options.timeTolerance ?? 0.001;
        this.distanceThreshold = options.distanceThreshold ?? 5;
        this.detectedErrors = [];
        this.confirmedErrors = [];
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    validateAll(wave, walls, echoes = []) {
        this.detectedErrors = [];
        
        if (wave && wave.reflections && wave.reflections.length > 0) {
            const angleErrors = this.validateReflectionAngles(wave.reflections);
            this.detectedErrors.push(...angleErrors);
        }
        
        if (echoes && echoes.length > 0) {
            const timeErrors = this.validateTimeUnits(echoes);
            this.detectedErrors.push(...timeErrors);
        }
        
        if (wave && wave.path && walls) {
            const penetrationErrors = this.validateWallPenetration(wave.path, walls);
            this.detectedErrors.push(...penetrationErrors);
        }
        
        if (wave && wave.path) {
            const boundaryErrors = this.validateBoundaries(wave.path, wave);
            this.detectedErrors.push(...boundaryErrors);
        }
        
        if (echoes && echoes.length > 0) {
            const consistencyErrors = this.validateEchoConsistency(echoes);
            this.detectedErrors.push(...consistencyErrors);
        }
        
        this.emit('errorsDetected', this.detectedErrors);
        return this.detectedErrors;
    }

    validateReflectionAngles(reflections) {
        return EchoCalculator.detectReflectionAngleErrors(reflections, this.angleTolerance)
            .map(error => this.enhanceError(error, 'reflection_angle'));
    }

    validateTimeUnits(echoes) {
        return EchoCalculator.detectTimeUnitErrors(echoes)
            .map(error => this.enhanceError(error, 'time_unit'));
    }

    validateWallPenetration(path, walls) {
        return EchoCalculator.detectWallPenetration(path, walls)
            .map(error => this.enhanceError(error, 'wall_penetration'));
    }

    validateBoundaries(path, wave) {
        const errors = [];
        const mazeWidth = wave.mazeWidth || 600;
        const mazeHeight = wave.mazeHeight || 600;
        
        for (let i = 0; i < path.length; i++) {
            const point = path[i];
            if (point.x < -this.distanceThreshold || point.x > mazeWidth + this.distanceThreshold ||
                point.y < -this.distanceThreshold || point.y > mazeHeight + this.distanceThreshold) {
                errors.push(this.enhanceError({
                    type: 'boundary_violation',
                    severity: 'warning',
                    description: `声波路径超出边界：位置 (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`,
                    location: { x: point.x, y: point.y },
                    expected: `在边界内 (0-${mazeWidth}, 0-${mazeHeight})`,
                    actual: `(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`,
                    pathIndex: i
                }, 'boundary_violation'));
            }
        }
        
        return errors;
    }

    validateEchoConsistency(echoes) {
        const errors = [];
        
        for (let i = 0; i < echoes.length; i++) {
            const echo = echoes[i];
            
            if (echo.time < this.timeTolerance) {
                errors.push(this.enhanceError({
                    type: 'echo_consistency',
                    severity: 'warning',
                    description: `回声 ${i + 1} 时间异常短 (${echo.time.toFixed(6)}s)`,
                    location: echo.point,
                    expected: `> ${this.timeTolerance}s`,
                    actual: echo.time,
                    echoIndex: i
                }, 'echo_consistency'));
            }
            
            if (echo.distance < 1) {
                errors.push(this.enhanceError({
                    type: 'echo_consistency',
                    severity: 'warning',
                    description: `回声 ${i + 1} 距离异常短 (${echo.distance.toFixed(2)}m)`,
                    location: echo.point,
                    expected: '> 1m',
                    actual: echo.distance,
                    echoIndex: i
                }, 'echo_consistency'));
            }
            
            if (echo.intensity <= 0 || echo.intensity > 1) {
                errors.push(this.enhanceError({
                    type: 'echo_consistency',
                    severity: 'error',
                    description: `回声 ${i + 1} 强度异常 (${echo.intensity.toFixed(3)})`,
                    location: echo.point,
                    expected: '0 < intensity <= 1',
                    actual: echo.intensity,
                    echoIndex: i
                }, 'echo_consistency'));
            }
            
            const expectedTime = echo.distance / 343;
            const timeDiff = Math.abs(echo.time - expectedTime);
            if (timeDiff > this.timeTolerance * 10) {
                errors.push(this.enhanceError({
                    type: 'echo_consistency',
                    severity: 'warning',
                    description: `回声 ${i + 1} 时间-距离不一致：计算值 ${expectedTime.toFixed(4)}s，实际 ${echo.time.toFixed(4)}s`,
                    location: echo.point,
                    expected: expectedTime,
                    actual: echo.time,
                    difference: timeDiff,
                    echoIndex: i
                }, 'echo_consistency'));
            }
        }
        
        return errors;
    }

    validateMovement(fromX, fromY, toX, toY, walls, mazeWidth, mazeHeight) {
        const errors = [];
        
        if (toX < 0 || toX > mazeWidth || toY < 0 || toY > mazeHeight) {
            errors.push(this.enhanceError({
                type: 'movement_boundary',
                severity: 'error',
                description: '移动目标位置超出边界',
                location: { x: toX, y: toY },
                expected: `在边界内 (0-${mazeWidth}, 0-${mazeHeight})`,
                actual: `(${toX}, ${toY})`
            }, 'movement_boundary'));
        }
        
        const collision = CollisionDetector.checkWallCollision(
            fromX, fromY, toX, toY, walls
        );
        
        if (collision.hit) {
            errors.push(this.enhanceError({
                type: 'movement_collision',
                severity: 'error',
                description: '移动路径与墙体碰撞',
                location: collision.point,
                expected: '无碰撞路径',
                actual: `与墙体 ${collision.wall.id} 碰撞`,
                wallId: collision.wall.id
            }, 'movement_collision'));
        }
        
        return errors;
    }

    validateWallData(wallData, existingWalls = []) {
        const errors = [];
        
        if (wallData.x1 === undefined || wallData.y1 === undefined ||
            wallData.x2 === undefined || wallData.y2 === undefined) {
            errors.push(this.enhanceError({
                type: 'invalid_wall',
                severity: 'critical',
                description: '墙体数据缺少必要的坐标字段',
                location: null,
                expected: 'x1, y1, x2, y2',
                actual: Object.keys(wallData).join(', ')
            }, 'invalid_wall'));
            return errors;
        }
        
        if (wallData.x1 === wallData.x2 && wallData.y1 === wallData.y2) {
            errors.push(this.enhanceError({
                type: 'invalid_wall',
                severity: 'error',
                description: '墙体起点和终点相同，长度为0',
                location: { x: wallData.x1, y: wallData.y1 },
                expected: '长度 > 0',
                actual: 0
            }, 'invalid_wall'));
        }
        
        for (const existing of existingWalls) {
            if (existing.id === wallData.id) continue;
            
            const overlap = CollisionDetector.lineIntersection(
                { x: wallData.x1, y: wallData.y1 },
                { x: wallData.x2, y: wallData.y2 },
                { x: existing.x1, y: existing.y1 },
                { x: existing.x2, y: existing.y2 }
            );
            
            if (overlap && overlap.t > 0.01 && overlap.t < 0.99 && overlap.s > 0.01 && overlap.s < 0.99) {
                errors.push(this.enhanceError({
                    type: 'wall_overlap',
                    severity: 'warning',
                    description: `新墙体与现有墙体 ${existing.id} 交叉`,
                    location: { x: overlap.x, y: overlap.y },
                    expected: '无交叉的墙体',
                    actual: `与墙体 ${existing.id} 交叉`,
                    overlappingWallId: existing.id
                }, 'wall_overlap'));
            }
        }
        
        if (wallData.reflectionCoefficient !== undefined) {
            if (wallData.reflectionCoefficient < 0 || wallData.reflectionCoefficient > 1) {
                errors.push(this.enhanceError({
                    type: 'invalid_wall',
                    severity: 'error',
                    description: '反射系数必须在 0-1 范围内',
                    location: null,
                    expected: '0 <= reflectionCoefficient <= 1',
                    actual: wallData.reflectionCoefficient
                }, 'invalid_wall'));
            }
        }
        
        return errors;
    }

    validateCharacterData(charData, mazeWidth, mazeHeight) {
        const errors = [];
        
        if (charData.x === undefined || charData.y === undefined) {
            errors.push(this.enhanceError({
                type: 'invalid_character',
                severity: 'critical',
                description: '角色数据缺少坐标字段',
                location: null,
                expected: 'x, y',
                actual: Object.keys(charData).join(', ')
            }, 'invalid_character'));
            return errors;
        }
        
        if (charData.x < 0 || charData.x > mazeWidth || charData.y < 0 || charData.y > mazeHeight) {
            errors.push(this.enhanceError({
                type: 'invalid_character',
                severity: 'error',
                description: '角色位置超出迷宫边界',
                location: { x: charData.x, y: charData.y },
                expected: `在边界内 (0-${mazeWidth}, 0-${mazeHeight})`,
                actual: `(${charData.x}, ${charData.y})`
            }, 'invalid_character'));
        }
        
        if (charData.type && !['player', 'teammate'].includes(charData.type)) {
            errors.push(this.enhanceError({
                type: 'invalid_character',
                severity: 'warning',
                description: '未知的角色类型',
                location: null,
                expected: 'player 或 teammate',
                actual: charData.type
            }, 'invalid_character'));
        }
        
        if (charData.health !== undefined && (charData.health < 0 || charData.health > 100)) {
            errors.push(this.enhanceError({
                type: 'invalid_character',
                severity: 'warning',
                description: '生命值应在 0-100 范围内',
                location: null,
                expected: '0 <= health <= 100',
                actual: charData.health
            }, 'invalid_character'));
        }
        
        return errors;
    }

    enhanceError(error, type) {
        return {
            ...error,
            type: type || error.type,
            id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            detectedAt: Date.now(),
            confirmed: false,
            ignored: false
        };
    }

    confirmError(errorId) {
        const error = this.detectedErrors.find(e => e.id === errorId);
        if (error) {
            error.confirmed = true;
            this.confirmedErrors.push(error);
            this.emit('errorConfirmed', error);
            return true;
        }
        return false;
    }

    ignoreError(errorId) {
        const error = this.detectedErrors.find(e => e.id === errorId);
        if (error) {
            error.ignored = true;
            this.emit('errorIgnored', error);
            return true;
        }
        return false;
    }

    confirmAllErrors() {
        this.detectedErrors.forEach(error => {
            if (!error.confirmed && !error.ignored) {
                error.confirmed = true;
                this.confirmedErrors.push(error);
            }
        });
        this.emit('allErrorsConfirmed', this.confirmedErrors);
        return this.confirmedErrors.length;
    }

    getErrorsByType(type) {
        return this.detectedErrors.filter(e => e.type === type);
    }

    getErrorsBySeverity(severity) {
        return this.detectedErrors.filter(e => e.severity === severity);
    }

    getUnconfirmedErrors() {
        return this.detectedErrors.filter(e => !e.confirmed && !e.ignored);
    }

    clearErrors() {
        this.detectedErrors = [];
        this.confirmedErrors = [];
        this.emit('errorsCleared');
    }

    hasCriticalErrors() {
        return this.detectedErrors.some(e => e.severity === 'critical' && !e.ignored);
    }

    getErrorSummary() {
        const summary = {
            total: this.detectedErrors.length,
            byType: {},
            bySeverity: {
                warning: 0,
                error: 0,
                critical: 0
            },
            unconfirmed: this.getUnconfirmedErrors().length,
            confirmed: this.confirmedErrors.length
        };
        
        for (const error of this.detectedErrors) {
            summary.byType[error.type] = (summary.byType[error.type] || 0) + 1;
            summary.bySeverity[error.severity]++;
        }
        
        return summary;
    }

    toJSON() {
        return {
            detectedErrors: [...this.detectedErrors],
            confirmedErrors: [...this.confirmedErrors],
            angleTolerance: this.angleTolerance,
            timeTolerance: this.timeTolerance,
            distanceThreshold: this.distanceThreshold
        };
    }

    loadJSON(data) {
        if (data.detectedErrors) {
            this.detectedErrors = [...data.detectedErrors];
        }
        if (data.confirmedErrors) {
            this.confirmedErrors = [...data.confirmedErrors];
        }
        if (data.angleTolerance !== undefined) {
            this.angleTolerance = data.angleTolerance;
        }
        if (data.timeTolerance !== undefined) {
            this.timeTolerance = data.timeTolerance;
        }
        if (data.distanceThreshold !== undefined) {
            this.distanceThreshold = data.distanceThreshold;
        }
    }
}
