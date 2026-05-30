const Physics = {
    parseValueWithUnit(valueStr, unitType) {
        const result = {
            raw: valueStr,
            value: null,
            unit: null,
            baseValue: null,
            valid: false,
            error: null
        };

        if (!valueStr || typeof valueStr !== 'string') {
            result.error = '值为空或格式错误';
            return result;
        }

        const match = valueStr.match(/^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)\s*([\u4e00-\u9fa5a-zA-Z⊕☉]+\/?[a-zA-Z]*)$/i);
        
        if (!match) {
            result.error = `无法解析 "${valueStr}"，请使用"数字+单位"格式，如"5.97e24 kg"`;
            return result;
        }

        const value = parseFloat(match[1]);
        const unit = match[2];

        result.value = value;
        result.unit = unit;

        const unitDefs = GAME_CONFIG.UNITS[unitType];
        if (!unitDefs) {
            result.error = `未知的单位类型: ${unitType}`;
            return result;
        }

        const unitDef = unitDefs[unit.toLowerCase()] || unitDefs[unit];
        if (!unitDef) {
            result.error = `未知的${unitType === 'mass' ? '质量' : unitType === 'radius' ? '长度' : '速度'}单位: "${unit}"，支持的单位: ${Object.keys(unitDefs).join(', ')}`;
            return result;
        }

        result.unitName = unitDef.name;
        result.baseValue = value * unitDef.factor;
        result.valid = true;

        return result;
    },

    parseMass(massStr) {
        return this.parseValueWithUnit(massStr, 'mass');
    },

    parseRadius(radiusStr) {
        return this.parseValueWithUnit(radiusStr, 'radius');
    },

    parseVelocity(velStr) {
        return this.parseValueWithUnit(velStr, 'velocity');
    },

    calculateEscapeVelocity(body, options = {}) {
        const result = {
            body: body,
            mass: null,
            radius: null,
            escapeVelocity: null,
            escapeVelocityMs: null,
            escapeVelocityKms: null,
            valid: false,
            error: null,
            steps: []
        };

        if (!body) {
            result.error = '天体数据为空';
            return result;
        }

        const massResult = this.parseMass(body.mass);
        result.mass = massResult;
        result.steps.push({
            label: '质量解析',
            input: body.mass,
            output: massResult.valid ? `${formatScientific(massResult.baseValue)} kg` : massResult.error,
            valid: massResult.valid
        });

        if (!massResult.valid) {
            result.error = `质量单位错误: ${massResult.error}`;
            return result;
        }

        const radiusResult = this.parseRadius(body.radius);
        result.radius = radiusResult;
        result.steps.push({
            label: '半径解析',
            input: body.radius,
            output: radiusResult.valid ? `${formatScientific(radiusResult.baseValue)} m` : radiusResult.error,
            valid: radiusResult.valid
        });

        if (!radiusResult.valid) {
            result.error = `半径单位错误: ${radiusResult.error}`;
            return result;
        }

        const G = GAME_CONFIG.G;
        const M = massResult.baseValue;
        const r = radiusResult.baseValue;

        if (r <= 0) {
            result.error = '天体半径必须大于0';
            result.steps.push({
                label: '半径检查',
                input: r,
                output: '半径必须大于0',
                valid: false
            });
            return result;
        }

        result.steps.push({
            label: '公式',
            input: 'v = √(2GM/r)',
            output: '逃逸速度公式',
            valid: true
        });

        result.steps.push({
            label: '代入参数',
            input: `G=${G}, M=${formatScientific(M)}kg, r=${formatScientific(r)}m`,
            output: `v = √(2 × ${G} × ${formatScientific(M)} / ${formatScientific(r)})`,
            valid: true
        });

        const vMs = Math.sqrt(2 * G * M / r);
        result.escapeVelocityMs = vMs;
        result.escapeVelocityKms = vMs * GAME_CONFIG.M_TO_KM;
        result.escapeVelocity = result.escapeVelocityKms;

        result.steps.push({
            label: '计算结果 (m/s)',
            input: '√(2GM/r)',
            output: `${vMs.toFixed(4)} m/s`,
            valid: true
        });

        result.steps.push({
            label: '单位转换 (km/s)',
            input: `${vMs.toFixed(4)} m/s × 0.001`,
            output: `${result.escapeVelocityKms.toFixed(4)} km/s`,
            valid: true
        });

        result.valid = true;
        return result;
    },

    calculateTotalVelocity(ship, selectedFuels, direction) {
        const result = {
            ship: ship,
            selectedFuels: selectedFuels,
            direction: direction,
            baseVelocity: 0,
            baseVelocityKms: 0,
            fuelBoost: 0,
            fuelBoostKms: 0,
            directionModifier: 1.0,
            totalVelocity: 0,
            totalVelocityKms: 0,
            valid: true,
            error: null,
            steps: []
        };

        if (!ship) {
            result.error = '飞船数据为空';
            result.valid = false;
            return result;
        }

        const baseVelResult = this.parseVelocity(ship.baseVelocity);
        result.steps.push({
            label: '飞船基础速度',
            input: ship.baseVelocity,
            output: baseVelResult.valid ? `${baseVelResult.baseValue} m/s = ${(baseVelResult.baseValue * GAME_CONFIG.M_TO_KM).toFixed(2)} km/s` : baseVelResult.error,
            valid: baseVelResult.valid
        });

        if (!baseVelResult.valid) {
            result.error = `飞船速度单位错误: ${baseVelResult.error}`;
            result.valid = false;
            return result;
        }

        result.baseVelocity = baseVelResult.baseValue;
        result.baseVelocityKms = baseVelResult.baseValue * GAME_CONFIG.M_TO_KM;

        let totalFuelBoost = 0;
        for (const fuel of selectedFuels) {
            const fuelVelResult = this.parseVelocity(fuel.velocityBoost);
            result.steps.push({
                label: `燃料卡: ${fuel.name}`,
                input: fuel.velocityBoost,
                output: fuelVelResult.valid ? `${fuelVelResult.baseValue} m/s` : fuelVelResult.error,
                valid: fuelVelResult.valid
            });

            if (!fuelVelResult.valid) {
                result.error = `燃料卡"${fuel.name}"速度单位错误: ${fuelVelResult.error}`;
                result.valid = false;
                return result;
            }

            totalFuelBoost += fuelVelResult.baseValue;
        }

        result.fuelBoost = totalFuelBoost;
        result.fuelBoostKms = totalFuelBoost * GAME_CONFIG.M_TO_KM;

        result.steps.push({
            label: '燃料卡总增量',
            input: selectedFuels.map(f => f.name).join(' + ') || '无',
            output: `${totalFuelBoost} m/s = ${result.fuelBoostKms.toFixed(2)} km/s`,
            valid: true
        });

        const dirConfig = GAME_CONFIG.DIRECTIONS[direction];
        if (!dirConfig) {
            result.error = `未知方向: ${direction}`;
            result.valid = false;
            return result;
        }

        result.directionModifier = dirConfig.modifier;
        result.steps.push({
            label: '方向修正',
            input: dirConfig.name,
            output: `系数 ×${dirConfig.modifier}`,
            valid: true
        });

        const rawTotal = result.baseVelocity + result.fuelBoost;
        result.totalVelocity = rawTotal * result.directionModifier;
        result.totalVelocityKms = result.totalVelocity * GAME_CONFIG.M_TO_KM;

        result.steps.push({
            label: '总速度计算',
            input: `(${result.baseVelocity} + ${result.fuelBoost}) × ${result.directionModifier}`,
            output: `${result.totalVelocity} m/s = ${result.totalVelocityKms.toFixed(2)} km/s`,
            valid: true
        });

        return result;
    },

    checkEscape(velocityResult, escapeResult) {
        const result = {
            canEscape: false,
            reason: '',
            velocityDiff: 0,
            velocityDiffKms: 0,
            errorType: null,
            details: null
        };

        if (!velocityResult.valid) {
            result.canEscape = false;
            result.reason = `速度计算错误: ${velocityResult.error}`;
            result.errorType = 'velocity_error';
            return result;
        }

        if (!escapeResult.valid) {
            result.canEscape = false;
            result.reason = `逃逸速度计算错误: ${escapeResult.error}`;
            result.errorType = 'escape_error';
            return result;
        }

        const totalVelKms = velocityResult.totalVelocityKms;
        const escapeVelKms = escapeResult.escapeVelocityKms;

        result.velocityDiff = totalVelKms - escapeVelKms;
        result.velocityDiffKms = result.velocityDiff;

        if (velocityResult.directionModifier < 0) {
            result.canEscape = false;
            result.reason = '速度方向错误！朝向天体飞行会被引力捕获';
            result.errorType = 'wrong_direction';
            return result;
        }

        if (totalVelKms >= escapeVelKms) {
            result.canEscape = true;
            result.reason = `成功逃逸！速度超出逃逸速度 ${result.velocityDiffKms.toFixed(2)} km/s`;
            result.errorType = null;
        } else {
            result.canEscape = false;
            result.reason = `燃料不足！速度还差 ${Math.abs(result.velocityDiffKms).toFixed(2)} km/s`;
            result.errorType = 'insufficient_fuel';
        }

        return result;
    },

    calculateScore(escapeResult, velocityResult, checkResult, usedFuelCount) {
        if (!checkResult.canEscape) return 0;

        const escapeVel = escapeResult.escapeVelocityKms;
        const totalVel = velocityResult.totalVelocityKms;
        const mass = escapeResult.mass.baseValue;

        let score = GAME_CONFIG.SCORE.baseEscape;
        score += Math.log10(mass + 1) * GAME_CONFIG.SCORE.massMultiplier * 1000;

        const efficiency = escapeVel / totalVel;
        if (efficiency > 0.9 && efficiency <= 1.0) {
            score += GAME_CONFIG.SCORE.perfectEscapeBonus;
        } else if (efficiency > 0.7) {
            score += GAME_CONFIG.SCORE.fuelEfficiencyBonus;
        }

        return Math.round(score);
    }
};
