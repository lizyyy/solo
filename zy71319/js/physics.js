const Physics = {
    STANDARD_GRAVITY: 9.8,

    calculateDensity(mass, volume) {
        if (volume === 0) return null;
        return mass / volume;
    },

    calculateBuoyancy(liquidDensity, displacedVolume) {
        return liquidDensity * this.STANDARD_GRAVITY * displacedVolume / 1000;
    },

    calculateDisplacement(objectVolume, objectDensity, liquidDensity) {
        if (objectDensity <= liquidDensity) {
            return objectVolume * (objectDensity / liquidDensity);
        } else {
            return objectVolume;
        }
    },

    calculateWaterLevelRise(displacedVolume, tankBaseArea = 500) {
        return displacedVolume / tankBaseArea;
    },

    predictState(objectDensity, liquidDensity) {
        if (objectDensity < liquidDensity) {
            return { state: 'floating', label: '漂浮', icon: '⬆️' };
        } else if (Math.abs(objectDensity - liquidDensity) < 0.001) {
            return { state: 'suspended', label: '悬浮', icon: '➖' };
        } else {
            return { state: 'sinking', label: '下沉', icon: '⬇️' };
        }
    },

    validateRecord(record) {
        const errors = [];
        const warnings = [];
        const info = [];

        if (!record.name || record.name.trim() === '') {
            errors.push({
                field: 'name',
                message: '物体名称不能为空',
                type: 'error'
            });
        }

        if (record.volume === undefined || record.volume === null || record.volume === '') {
            errors.push({
                field: 'volume',
                message: '体积为必填字段',
                type: 'error'
            });
        } else if (isNaN(Number(record.volume))) {
            errors.push({
                field: 'volume',
                message: `体积格式错误："${record.volume}" 不是有效数字`,
                type: 'error'
            });
        } else if (Number(record.volume) <= 0) {
            errors.push({
                field: 'volume',
                message: `体积必须大于0，当前值：${record.volume} cm³`,
                type: 'error',
                value: record.volume
            });
        }

        if (record.mass === undefined || record.mass === null || record.mass === '') {
            errors.push({
                field: 'mass',
                message: '质量为必填字段',
                type: 'error'
            });
        } else if (isNaN(Number(record.mass))) {
            errors.push({
                field: 'mass',
                message: `质量格式错误："${record.mass}" 不是有效数字`,
                type: 'error'
            });
        } else if (Number(record.mass) < 0) {
            errors.push({
                field: 'mass',
                message: `质量不能为负数，当前值：${record.mass} g`,
                type: 'error',
                value: record.mass
            });
        } else if (Number(record.mass) === 0) {
            warnings.push({
                field: 'mass',
                message: `质量为0，请确认数据是否正确`,
                type: 'warning',
                value: record.mass
            });
        }

        if (record.liquidDensity === undefined || record.liquidDensity === null || record.liquidDensity === '') {
            errors.push({
                field: 'liquidDensity',
                message: '液体密度为必填字段',
                type: 'error'
            });
        } else if (isNaN(Number(record.liquidDensity))) {
            errors.push({
                field: 'liquidDensity',
                message: `液体密度格式错误："${record.liquidDensity}" 不是有效数字`,
                type: 'error'
            });
        } else if (Number(record.liquidDensity) <= 0) {
            errors.push({
                field: 'liquidDensity',
                message: `液体密度必须大于0，当前值：${record.liquidDensity} g/cm³`,
                type: 'error',
                value: record.liquidDensity
            });
        } else if (Number(record.liquidDensity) > 25) {
            warnings.push({
                field: 'liquidDensity',
                message: `液体密度异常高（${record.liquidDensity} g/cm³），请确认单位是否正确（应为 g/cm³）`,
                type: 'warning',
                value: record.liquidDensity
            });
        }

        const volume = Number(record.volume);
        const mass = Number(record.mass);
        const liquidDensity = Number(record.liquidDensity);

        if (!isNaN(volume) && !isNaN(mass) && volume > 0) {
            const calculatedDensity = mass / volume;
            
            if (calculatedDensity > 22.5) {
                warnings.push({
                    field: 'density',
                    message: `计算密度异常高（${calculatedDensity.toFixed(2)} g/cm³），请确认质量/体积单位是否正确`,
                    type: 'warning',
                    value: calculatedDensity
                });
            }

            if (calculatedDensity < 0.05 && mass > 0) {
                warnings.push({
                    field: 'density',
                    message: `计算密度异常低（${calculatedDensity.toFixed(4)} g/cm³），请确认数据是否正确`,
                    type: 'warning',
                    value: calculatedDensity
                });
            }
        }

        if (record.displacement !== undefined && record.displacement !== null && record.displacement !== '') {
            if (isNaN(Number(record.displacement))) {
                errors.push({
                    field: 'displacement',
                    message: `排水量格式错误："${record.displacement}" 不是有效数字`,
                    type: 'error'
                });
            } else if (Number(record.displacement) < 0) {
                errors.push({
                    field: 'displacement',
                    message: `排水量不能为负数，当前值：${record.displacement} cm³`,
                    type: 'error',
                    value: record.displacement
                });
            } else if (!isNaN(volume) && volume > 0 && Number(record.displacement) > volume) {
                errors.push({
                    field: 'displacement',
                    message: `排水量（${record.displacement} cm³）不能大于物体体积（${volume} cm³）`,
                    type: 'error',
                    value: record.displacement,
                    max: volume
                });
            } else if (!isNaN(volume) && !isNaN(mass) && !isNaN(liquidDensity) && volume > 0 && liquidDensity > 0) {
                const objectDensity = mass / volume;
                let expectedDisplacement;
                
                if (objectDensity <= liquidDensity) {
                    expectedDisplacement = volume * (objectDensity / liquidDensity);
                } else {
                    expectedDisplacement = volume;
                }

                const actualDisplacement = Number(record.displacement);
                const diffPercent = Math.abs((actualDisplacement - expectedDisplacement) / expectedDisplacement) * 100;

                if (diffPercent > 5 && diffPercent <= 20) {
                    warnings.push({
                        field: 'displacement',
                        message: `排水量偏差${diffPercent.toFixed(1)}%，实测${actualDisplacement} cm³，理论值${expectedDisplacement.toFixed(2)} cm³`,
                        type: 'warning',
                        expected: expectedDisplacement,
                        actual: actualDisplacement
                    });
                } else if (diffPercent > 20) {
                    errors.push({
                        field: 'displacement',
                        message: `排水量偏差过大（${diffPercent.toFixed(1)}%），实测${actualDisplacement} cm³，理论值${expectedDisplacement.toFixed(2)} cm³`,
                        type: 'error',
                        expected: expectedDisplacement,
                        actual: actualDisplacement
                    });
                }
            }
        }

        if (record.densityUnit && record.densityUnit !== 'g/cm³') {
            warnings.push({
                field: 'densityUnit',
                message: `密度单位建议使用 g/cm³，当前单位：${record.densityUnit}`,
                type: 'warning'
            });
        }

        const missingFields = [];
        if (!record.operator || record.operator.trim() === '') {
            missingFields.push('操作者');
        }
        if (!record.notes || record.notes.trim() === '') {
            missingFields.push('备注');
        }
        if (missingFields.length > 0) {
            info.push({
                field: 'meta',
                message: `建议补充：${missingFields.join('、')}`,
                type: 'info'
            });
        }

        return {
            isValid: errors.length === 0,
            hasWarnings: warnings.length > 0,
            errors,
            warnings,
            info,
            all: [...errors, ...warnings, ...info]
        };
    },

    analyzeRecord(record) {
        const volume = Number(record.volume);
        const mass = Number(record.mass);
        const liquidDensity = Number(record.liquidDensity);
        
        const objectDensity = this.calculateDensity(mass, volume);
        const stateInfo = this.predictState(objectDensity, liquidDensity);
        
        let displacement;
        if (record.displacement !== undefined && record.displacement !== null && record.displacement !== '') {
            displacement = Number(record.displacement);
        } else {
            displacement = this.calculateDisplacement(volume, objectDensity, liquidDensity);
        }
        
        const buoyancy = this.calculateBuoyancy(liquidDensity, displacement);
        const gravity = mass * this.STANDARD_GRAVITY / 1000;
        const apparentWeight = gravity - buoyancy;
        const waterLevelRise = this.calculateWaterLevelRise(displacement);

        return {
            objectDensity,
            liquidDensity,
            displacement,
            buoyancy,
            gravity,
            apparentWeight,
            waterLevelRise,
            state: stateInfo.state,
            stateLabel: stateInfo.label,
            stateIcon: stateInfo.icon,
            mass,
            volume
        };
    },

    generateComparison(analysis) {
        const { objectDensity, liquidDensity, buoyancy, gravity, state } = analysis;
        
        const comparisons = [];
        
        comparisons.push({
            label: '密度对比',
            value1: `${objectDensity.toFixed(3)} g/cm³`,
            value2: `${liquidDensity.toFixed(3)} g/cm³`,
            relation: objectDensity < liquidDensity ? '<' : objectDensity > liquidDensity ? '>' : '=',
            conclusion: objectDensity < liquidDensity ? '物体密度小' : objectDensity > liquidDensity ? '物体密度大' : '密度相等'
        });
        
        comparisons.push({
            label: '力的对比',
            value1: `浮力 ${buoyancy.toFixed(3)} N`,
            value2: `重力 ${gravity.toFixed(3)} N`,
            relation: buoyancy > gravity ? '>' : buoyancy < gravity ? '<' : '=',
            conclusion: buoyancy > gravity ? '浮力更大' : buoyancy < gravity ? '重力更大' : '二力平衡'
        });
        
        return comparisons;
    }
};
