(function(global) {
    'use strict';

    const Validation = {
        ERROR_TYPES: {
            DEPENDENCY_NOT_FOUND: 'dependency_not_found',
            DURATION_MISSING: 'duration_missing',
            HIGH_RISK_TOO_CLOSE: 'high_risk_too_close',
            CIRCULAR_DEPENDENCY: 'circular_dependency'
        },

        ERROR_MESSAGES: {
            dependency_not_found: '依赖的 Cue 不存在',
            duration_missing: '持续时间不能为空',
            high_risk_too_close: '与同组前一个高风险 Cue 间隔小于 30 秒',
            circular_dependency: '存在循环依赖'
        },

        MIN_HIGH_RISK_INTERVAL: 30,

        validateCue: function(cue, allCues) {
            const errors = [];
            
            if (cue.duration === null || cue.duration === undefined || cue.duration === '') {
                errors.push({
                    type: this.ERROR_TYPES.DURATION_MISSING,
                    message: this.ERROR_MESSAGES.duration_missing
                });
            }

            if (cue.dependsOn) {
                const dependencyExists = allCues.some(c => c.id === cue.dependsOn);
                if (!dependencyExists) {
                    errors.push({
                        type: this.ERROR_TYPES.DEPENDENCY_NOT_FOUND,
                        message: this.ERROR_MESSAGES.dependency_not_found
                    });
                }
            }

            if (this.hasCircularDependency(cue, allCues)) {
                errors.push({
                    type: this.ERROR_TYPES.CIRCULAR_DEPENDENCY,
                    message: this.ERROR_MESSAGES.circular_dependency
                });
            }

            return errors;
        },

        hasCircularDependency: function(cue, allCues) {
            const visited = new Set();
            const visiting = new Set();

            const checkDependency = (cueId) => {
                if (visited.has(cueId)) return false;
                if (visiting.has(cueId)) return true;

                visiting.add(cueId);
                const currentCue = allCues.find(c => c.id === cueId);
                
                if (currentCue && currentCue.dependsOn) {
                    if (checkDependency(currentCue.dependsOn)) {
                        return true;
                    }
                }

                visiting.delete(cueId);
                visited.add(cueId);
                return false;
            };

            return checkDependency(cue.id);
        },

        validateAll: function(cues) {
            const results = new Map();
            const sortedCues = [...cues].sort((a, b) => a.order - b.order);

            sortedCues.forEach(cue => {
                const errors = this.validateCue(cue, sortedCues);
                results.set(cue.id, errors);
            });

            this.checkHighRiskIntervals(sortedCues, results);

            return results;
        },

        checkHighRiskIntervals: function(sortedCues, results) {
            const groupCues = new Map();

            sortedCues.forEach(cue => {
                if (!groupCues.has(cue.group)) {
                    groupCues.set(cue.group, []);
                }
                groupCues.get(cue.group).push(cue);
            });

            groupCues.forEach((cues, group) => {
                const highRiskCues = cues
                    .filter(c => c.riskLevel === 'high')
                    .sort((a, b) => a.startTime - b.startTime);

                for (let i = 1; i < highRiskCues.length; i++) {
                    const prev = highRiskCues[i - 1];
                    const current = highRiskCues[i];
                    
                    const prevEndTime = prev.startTime + (prev.duration || 0);
                    const interval = current.startTime - prevEndTime;

                    if (interval < this.MIN_HIGH_RISK_INTERVAL) {
                        const cueErrors = results.get(current.id) || [];
                        cueErrors.push({
                            type: this.ERROR_TYPES.HIGH_RISK_TOO_CLOSE,
                            message: `${this.ERROR_MESSAGES.high_risk_too_close}（当前间隔: ${interval} 秒）`,
                            relatedCueId: prev.id,
                            interval: interval
                        });
                        results.set(current.id, cueErrors);
                    }
                }
            });
        },

        hasErrors: function(cueId, validationResults) {
            const errors = validationResults.get(cueId);
            return errors && errors.length > 0;
        },

        getErrors: function(cueId, validationResults) {
            return validationResults.get(cueId) || [];
        },

        getAllErrors: function(validationResults) {
            const allErrors = [];
            validationResults.forEach((errors, cueId) => {
                if (errors.length > 0) {
                    allErrors.push({
                        cueId: cueId,
                        errors: errors
                    });
                }
            });
            return allErrors;
        },

        formatErrorMessages: function(errors) {
            return errors.map(e => e.message);
        },

        validateImportData: function(data) {
            const issues = [];
            const warnings = [];

            if (!data) {
                issues.push('导入的数据为空');
                return { valid: false, issues, warnings };
            }

            if (!data.version) {
                warnings.push('数据缺少版本号，可能不是本工具导出的数据');
            } else if (data.version !== '1.0.0') {
                warnings.push(`数据版本为 ${data.version}，当前工具版本为 1.0.0，可能存在兼容性问题`);
            }

            if (!data.cues || !Array.isArray(data.cues)) {
                issues.push('数据格式错误：cues 不是数组');
                return { valid: false, issues, warnings };
            }

            data.cues.forEach((cue, index) => {
                const prefix = `Cue ${index + 1}:`;
                
                if (!cue.id) {
                    issues.push(`${prefix} 缺少 id 字段`);
                }
                
                if (cue.number === undefined) {
                    warnings.push(`${prefix} 缺少编号（number）字段`);
                }
                
                if (cue.duration !== undefined && cue.duration !== null) {
                    if (typeof cue.duration !== 'number' || cue.duration < 0) {
                        issues.push(`${prefix} 持续时间（duration）必须是非负数字`);
                    }
                }
                
                if (cue.group && !['灯光', '音响', '道具', '服装', '舞台', '其他'].includes(cue.group)) {
                    warnings.push(`${prefix} 组别（group）'${cue.group}'不是预定义值`);
                }
                
                if (cue.riskLevel && !['low', 'medium', 'high'].includes(cue.riskLevel)) {
                    warnings.push(`${prefix} 风险等级（riskLevel）'${cue.riskLevel}'不是预定义值`);
                }
                
                if (cue.order !== undefined && (typeof cue.order !== 'number' || cue.order < 0)) {
                    issues.push(`${prefix} 排序（order）必须是非负整数`);
                }
            });

            if (data.cues.length > 0) {
                const cueIds = new Set(data.cues.map(c => c.id));
                data.cues.forEach((cue, index) => {
                    if (cue.dependsOn && !cueIds.has(cue.dependsOn)) {
                        warnings.push(`Cue ${index + 1} 依赖的 Cue '${cue.dependsOn}' 不存在`);
                    }
                });
            }

            return {
                valid: issues.length === 0,
                issues,
                warnings
            };
        },

        validateImportAndRepair: function(data) {
            const validation = this.validateImportData(data);
            
            if (!validation.valid) {
                return validation;
            }

            const repairedCues = data.cues.map((cue, index) => {
                const repaired = { ...cue };
                
                if (!repaired.id) {
                    repaired.id = 'imported_cue_' + Date.now() + '_' + index;
                }
                
                if (repaired.number === undefined || repaired.number === null) {
                    repaired.number = `Q${index + 1}`;
                }
                
                if (repaired.order === undefined || repaired.order === null) {
                    repaired.order = index;
                }
                
                if (!repaired.group || !['灯光', '音响', '道具', '服装', '舞台', '其他'].includes(repaired.group)) {
                    repaired.group = '其他';
                }
                
                if (!repaired.riskLevel || !['low', 'medium', 'high'].includes(repaired.riskLevel)) {
                    repaired.riskLevel = 'low';
                }
                
                if (repaired.duration !== undefined && repaired.duration !== null) {
                    repaired.duration = Math.max(0, Number(repaired.duration));
                }
                
                return repaired;
            });

            const cueIds = new Set(repairedCues.map(c => c.id));
            repairedCues.forEach(cue => {
                if (cue.dependsOn && !cueIds.has(cue.dependsOn)) {
                    cue.dependsOn = null;
                    validation.warnings.push(`Cue '${cue.number}' 的无效依赖已被清除`);
                }
            });

            return {
                ...validation,
                repairedCues
            };
        }
    };

    global.Validation = Validation;

})(window);
