const ValidationEngine = (function() {
    
    const CurveThresholds = {
        MIN_DATA_POINTS: 5,
        RECOMMENDED_DATA_POINTS: 10,
        MAX_TIME_INTERVAL_VARIATION: 0.2,
        MIN_TEMP: 0,
        MAX_TEMP: 70,
        MIN_HUMIDITY: 20,
        MAX_HUMIDITY: 95
    };

    const ModelThresholds = {
        PASS_AVG_DEVIATION: 1.5,
        REVIEW_AVG_DEVIATION: 3.0,
        PASS_MAX_DEVIATION: 3.0,
        REVIEW_MAX_DEVIATION: 5.0,
        PASS_CORRELATION: 0.95,
        REVIEW_CORRELATION: 0.80
    };

    const ComparisonThresholds = {
        PASS_TEMP_DEVIATION: 2.0,
        REVIEW_TEMP_DEVIATION: 4.0,
        PASS_HUMIDITY_DEVIATION: 3.0,
        REVIEW_HUMIDITY_DEVIATION: 6.0
    };

    function validateCurveData(curveData, batchInfo) {
        const result = {
            passed: false,
            dataPoints: 0,
            timeIntervalConsistent: false,
            tempRangeValid: false,
            humidityRangeValid: false,
            mcTrendValid: false,
            messages: [],
            warnings: [],
            errors: []
        };

        if (!curveData || curveData.length === 0) {
            result.errors.push('曲线数据为空');
            result.messages.push({ type: 'error', text: '曲线数据为空' });
            return result;
        }

        result.dataPoints = curveData.length;

        if (curveData.length < CurveThresholds.MIN_DATA_POINTS) {
            result.errors.push(`数据点数不足：${curveData.length}个（最小值${CurveThresholds.MIN_DATA_POINTS}个）`);
            result.messages.push({ type: 'error', text: `数据点数不足：${curveData.length}个（建议≥${CurveThresholds.RECOMMENDED_DATA_POINTS}个）` });
        } else if (curveData.length < CurveThresholds.RECOMMENDED_DATA_POINTS) {
            result.warnings.push(`数据点数偏少：${curveData.length}个（建议≥${CurveThresholds.RECOMMENDED_DATA_POINTS}个）`);
            result.messages.push({ type: 'warning', text: `数据点数：${curveData.length}个（建议≥${CurveThresholds.RECOMMENDED_DATA_POINTS}个）` });
        } else {
            result.messages.push({ type: 'success', text: `数据点数充足：${curveData.length}个` });
        }

        const timeIntervals = [];
        for (let i = 1; i < curveData.length; i++) {
            timeIntervals.push(curveData[i].time - curveData[i - 1].time);
        }

        if (timeIntervals.length > 0) {
            const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
            const maxVariation = Math.max(...timeIntervals.map(t => Math.abs((t - avgInterval) / avgInterval)));
            
            if (maxVariation <= CurveThresholds.MAX_TIME_INTERVAL_VARIATION) {
                result.timeIntervalConsistent = true;
                result.messages.push({ type: 'success', text: `时间间隔一致（平均${avgInterval}小时）` });
            } else {
                result.errors.push(`时间间隔不一致（最大偏差${(maxVariation * 100).toFixed(1)}%）`);
                result.messages.push({ type: 'error', text: `时间间隔不一致（最大偏差${(maxVariation * 100).toFixed(1)}%）` });
            }
        }

        const temps = curveData.map(p => p.temperature);
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);

        if (minTemp >= CurveThresholds.MIN_TEMP && maxTemp <= CurveThresholds.MAX_TEMP) {
            result.tempRangeValid = true;
            result.messages.push({ type: 'success', text: `温度范围合理（${minTemp}℃ ~ ${maxTemp}℃）` });
        } else {
            if (minTemp < CurveThresholds.MIN_TEMP) {
                result.errors.push(`温度过低：最低${minTemp}℃`);
            }
            if (maxTemp > CurveThresholds.MAX_TEMP) {
                result.errors.push(`温度过高：最高${maxTemp}℃（建议≤${CurveThresholds.MAX_TEMP}℃）`);
            }
            result.messages.push({ type: 'error', text: `温度范围异常（${minTemp}℃ ~ ${maxTemp}℃）` });
        }

        const humidities = curveData.map(p => p.humidity);
        const minHumidity = Math.min(...humidities);
        const maxHumidity = Math.max(...humidities);

        if (minHumidity >= CurveThresholds.MIN_HUMIDITY && maxHumidity <= CurveThresholds.MAX_HUMIDITY) {
            result.humidityRangeValid = true;
            result.messages.push({ type: 'success', text: `湿度范围合理（${minHumidity}% ~ ${maxHumidity}%）` });
        } else {
            if (minHumidity < CurveThresholds.MIN_HUMIDITY) {
                result.errors.push(`湿度过低：最低${minHumidity}%`);
            }
            if (maxHumidity > CurveThresholds.MAX_HUMIDITY) {
                result.errors.push(`湿度过高：最高${maxHumidity}%`);
            }
            result.messages.push({ type: 'error', text: `湿度范围异常（${minHumidity}% ~ ${maxHumidity}%）` });
        }

        let mcDecreasing = true;
        for (let i = 1; i < curveData.length; i++) {
            if (curveData[i].targetMC > curveData[i - 1].targetMC) {
                mcDecreasing = false;
                break;
            }
        }

        const finalMC = curveData[curveData.length - 1].targetMC;
        const startMC = curveData[0].targetMC;

        if (mcDecreasing && finalMC < startMC) {
            result.mcTrendValid = true;
            result.messages.push({ type: 'success', text: `含水率趋势正确：${startMC}% → ${finalMC}%` });
            
            if (batchInfo && Math.abs(finalMC - batchInfo.targetMC) > 2) {
                result.warnings.push(`曲线最终含水率(${finalMC}%)与目标含水率(${batchInfo.targetMC}%)差异较大`);
                result.messages.push({ type: 'warning', text: `注意：曲线最终含水率(${finalMC}%)与目标(${batchInfo.targetMC}%)差异较大` });
            }
        } else {
            result.errors.push('含水率趋势异常（应随时间逐渐降低）');
            result.messages.push({ type: 'error', text: '含水率趋势异常（应随时间逐渐降低）' });
        }

        result.passed = result.dataPoints >= CurveThresholds.MIN_DATA_POINTS &&
                        result.timeIntervalConsistent &&
                        result.tempRangeValid &&
                        result.humidityRangeValid &&
                        result.mcTrendValid;

        if (result.passed) {
            result.messages.push({ type: 'success', text: '曲线导入验证通过' });
        }

        return result;
    }

    function calculateCorrelation(x, y) {
        if (x.length !== y.length || x.length < 2) return 0;

        const n = x.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
            sumY2 += y[i] * y[i];
        }

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        return denominator === 0 ? 0 : numerator / denominator;
    }

    function validateMoistureModel(curveData, actualData, batchInfo) {
        const result = {
            passed: false,
            avgDeviation: 0,
            maxDeviation: 0,
            correlationCoefficient: 0,
            trendConsistent: false,
            messages: [],
            warnings: [],
            errors: [],
            deviationDetails: []
        };

        if (!curveData || !actualData || curveData.length === 0 || actualData.length === 0) {
            result.errors.push('曲线数据或实测数据缺失');
            result.messages.push({ type: 'error', text: '曲线数据或实测数据缺失' });
            return result;
        }

        const deviations = [];
        const curveMC = [];
        const actualMC = [];

        const actualMap = new Map();
        for (const point of actualData) {
            actualMap.set(point.time, point.moistureContent);
        }

        for (const curvePoint of curveData) {
            if (actualMap.has(curvePoint.time)) {
                const actual = actualMap.get(curvePoint.time);
                const deviation = Math.abs(actual - curvePoint.targetMC);
                deviations.push(deviation);
                curveMC.push(curvePoint.targetMC);
                actualMC.push(actual);
                
                result.deviationDetails.push({
                    time: curvePoint.time,
                    curveMC: curvePoint.targetMC,
                    actualMC: actual,
                    deviation: deviation
                });
            }
        }

        if (deviations.length < 3) {
            result.errors.push('匹配的数据点不足（至少需要3个）');
            result.messages.push({ type: 'error', text: '匹配的数据点不足（至少需要3个）' });
            return result;
        }

        result.avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
        result.maxDeviation = Math.max(...deviations);
        result.correlationCoefficient = calculateCorrelation(curveMC, actualMC);

        let curveDecreasing = true;
        let actualDecreasing = true;

        for (let i = 1; i < curveMC.length; i++) {
            if (curveMC[i] > curveMC[i - 1]) curveDecreasing = false;
            if (actualMC[i] > actualMC[i - 1]) actualDecreasing = false;
        }

        result.trendConsistent = curveDecreasing === actualDecreasing;

        if (result.avgDeviation <= ModelThresholds.PASS_AVG_DEVIATION) {
            result.messages.push({ type: 'success', text: `平均偏差 ${result.avgDeviation.toFixed(2)}%（阈值 ≤ ${ModelThresholds.PASS_AVG_DEVIATION}%）` });
        } else if (result.avgDeviation <= ModelThresholds.REVIEW_AVG_DEVIATION) {
            result.warnings.push(`平均偏差偏高：${result.avgDeviation.toFixed(2)}%`);
            result.messages.push({ type: 'warning', text: `平均偏差 ${result.avgDeviation.toFixed(2)}%（超过阈值 ${ModelThresholds.PASS_AVG_DEVIATION}%）` });
        } else {
            result.errors.push(`平均偏差过高：${result.avgDeviation.toFixed(2)}%`);
            result.messages.push({ type: 'error', text: `平均偏差 ${result.avgDeviation.toFixed(2)}%（远超过阈值 ${ModelThresholds.REVIEW_AVG_DEVIATION}%）` });
        }

        if (result.maxDeviation <= ModelThresholds.PASS_MAX_DEVIATION) {
            result.messages.push({ type: 'success', text: `最大偏差 ${result.maxDeviation.toFixed(2)}%（阈值 ≤ ${ModelThresholds.PASS_MAX_DEVIATION}%）` });
        } else if (result.maxDeviation <= ModelThresholds.REVIEW_MAX_DEVIATION) {
            result.warnings.push(`最大偏差偏高：${result.maxDeviation.toFixed(2)}%`);
            result.messages.push({ type: 'warning', text: `最大偏差 ${result.maxDeviation.toFixed(2)}%（超过阈值 ${ModelThresholds.PASS_MAX_DEVIATION}%）` });
        } else {
            result.errors.push(`最大偏差过高：${result.maxDeviation.toFixed(2)}%`);
            result.messages.push({ type: 'error', text: `最大偏差 ${result.maxDeviation.toFixed(2)}%（远超过阈值 ${ModelThresholds.REVIEW_MAX_DEVIATION}%）` });
        }

        if (result.correlationCoefficient >= ModelThresholds.PASS_CORRELATION) {
            result.messages.push({ type: 'success', text: `相关系数 ${result.correlationCoefficient.toFixed(3)}（阈值 ≥ ${ModelThresholds.PASS_CORRELATION}）` });
        } else if (result.correlationCoefficient >= ModelThresholds.REVIEW_CORRELATION) {
            result.warnings.push(`相关系数偏低：${result.correlationCoefficient.toFixed(3)}`);
            result.messages.push({ type: 'warning', text: `相关系数 ${result.correlationCoefficient.toFixed(3)}（低于阈值 ${ModelThresholds.PASS_CORRELATION}）` });
        } else {
            result.errors.push(`相关系数过低：${result.correlationCoefficient.toFixed(3)}`);
            result.messages.push({ type: 'error', text: `相关系数 ${result.correlationCoefficient.toFixed(3)}（远低于阈值 ${ModelThresholds.REVIEW_CORRELATION}）` });
        }

        if (result.trendConsistent) {
            result.messages.push({ type: 'success', text: '含水率变化趋势一致' });
        } else {
            result.errors.push('含水率变化趋势不一致');
            result.messages.push({ type: 'error', text: '含水率变化趋势不一致' });
        }

        const avgPass = result.avgDeviation <= ModelThresholds.PASS_AVG_DEVIATION;
        const maxPass = result.maxDeviation <= ModelThresholds.PASS_MAX_DEVIATION;
        const corrPass = result.correlationCoefficient >= ModelThresholds.PASS_CORRELATION;
        const trendPass = result.trendConsistent;

        result.passed = avgPass && maxPass && corrPass && trendPass;

        if (result.passed) {
            result.messages.push({ type: 'success', text: '含水率模型验证通过' });
        }

        return result;
    }

    function compareBatchData(curveData, actualData, batchInfo) {
        const result = {
            passed: false,
            tempDeviationAvg: 0,
            humidityDeviationAvg: 0,
            mcDeviationAvg: 0,
            finalMC: 0,
            targetMCMet: false,
            messages: [],
            warnings: [],
            errors: [],
            comparisonDetails: []
        };

        if (!curveData || !actualData || curveData.length === 0 || actualData.length === 0) {
            result.errors.push('曲线数据或实测数据缺失');
            result.messages.push({ type: 'error', text: '曲线数据或实测数据缺失' });
            return result;
        }

        const tempDeviations = [];
        const humidityDeviations = [];
        const mcDeviations = [];

        const actualMap = new Map();
        for (const point of actualData) {
            actualMap.set(point.time, point);
        }

        for (const curvePoint of curveData) {
            if (actualMap.has(curvePoint.time)) {
                const actual = actualMap.get(curvePoint.time);
                const tempDev = Math.abs(actual.temperature - curvePoint.temperature);
                const humidityDev = Math.abs(actual.humidity - curvePoint.humidity);
                const mcDev = Math.abs(actual.moistureContent - curvePoint.targetMC);

                tempDeviations.push(tempDev);
                humidityDeviations.push(humidityDev);
                mcDeviations.push(mcDev);

                result.comparisonDetails.push({
                    time: curvePoint.time,
                    curveTemp: curvePoint.temperature,
                    actualTemp: actual.temperature,
                    tempDeviation: tempDev,
                    curveHumidity: curvePoint.humidity,
                    actualHumidity: actual.humidity,
                    humidityDeviation: humidityDev,
                    curveMC: curvePoint.targetMC,
                    actualMC: actual.moistureContent,
                    mcDeviation: mcDev
                });
            }
        }

        if (tempDeviations.length < 3) {
            result.errors.push('匹配的数据点不足（至少需要3个）');
            result.messages.push({ type: 'error', text: '匹配的数据点不足（至少需要3个）' });
            return result;
        }

        result.tempDeviationAvg = tempDeviations.reduce((a, b) => a + b, 0) / tempDeviations.length;
        result.humidityDeviationAvg = humidityDeviations.reduce((a, b) => a + b, 0) / humidityDeviations.length;
        result.mcDeviationAvg = mcDeviations.reduce((a, b) => a + b, 0) / mcDeviations.length;

        const lastActual = actualData[actualData.length - 1];
        result.finalMC = lastActual.moistureContent;

        if (batchInfo) {
            result.targetMCMet = Math.abs(result.finalMC - batchInfo.targetMC) <= 1.0;
        }

        if (result.tempDeviationAvg <= ComparisonThresholds.PASS_TEMP_DEVIATION) {
            result.messages.push({ type: 'success', text: `温度偏差均值 ${result.tempDeviationAvg.toFixed(2)}℃（阈值 ≤ ${ComparisonThresholds.PASS_TEMP_DEVIATION}℃）` });
        } else if (result.tempDeviationAvg <= ComparisonThresholds.REVIEW_TEMP_DEVIATION) {
            result.warnings.push(`温度偏差偏高：${result.tempDeviationAvg.toFixed(2)}℃`);
            result.messages.push({ type: 'warning', text: `温度偏差均值 ${result.tempDeviationAvg.toFixed(2)}℃（超过阈值 ${ComparisonThresholds.PASS_TEMP_DEVIATION}℃）` });
        } else {
            result.errors.push(`温度偏差过高：${result.tempDeviationAvg.toFixed(2)}℃`);
            result.messages.push({ type: 'error', text: `温度偏差均值 ${result.tempDeviationAvg.toFixed(2)}℃（远超过阈值 ${ComparisonThresholds.REVIEW_TEMP_DEVIATION}℃）` });
        }

        if (result.humidityDeviationAvg <= ComparisonThresholds.PASS_HUMIDITY_DEVIATION) {
            result.messages.push({ type: 'success', text: `湿度偏差均值 ${result.humidityDeviationAvg.toFixed(2)}%RH（阈值 ≤ ${ComparisonThresholds.PASS_HUMIDITY_DEVIATION}%）` });
        } else if (result.humidityDeviationAvg <= ComparisonThresholds.REVIEW_HUMIDITY_DEVIATION) {
            result.warnings.push(`湿度偏差偏高：${result.humidityDeviationAvg.toFixed(2)}%RH`);
            result.messages.push({ type: 'warning', text: `湿度偏差均值 ${result.humidityDeviationAvg.toFixed(2)}%RH（超过阈值 ${ComparisonThresholds.PASS_HUMIDITY_DEVIATION}%）` });
        } else {
            result.errors.push(`湿度偏差过高：${result.humidityDeviationAvg.toFixed(2)}%RH`);
            result.messages.push({ type: 'error', text: `湿度偏差均值 ${result.humidityDeviationAvg.toFixed(2)}%RH（远超过阈值 ${ComparisonThresholds.REVIEW_HUMIDITY_DEVIATION}%）` });
        }

        if (batchInfo) {
            if (result.targetMCMet) {
                result.messages.push({ type: 'success', text: `最终含水率 ${result.finalMC.toFixed(2)}%，达到目标值 ${batchInfo.targetMC}%` });
            } else {
                result.warnings.push(`最终含水率未达标：${result.finalMC.toFixed(2)}%（目标 ${batchInfo.targetMC}%）`);
                result.messages.push({ type: 'warning', text: `最终含水率 ${result.finalMC.toFixed(2)}%（目标 ${batchInfo.targetMC}%）` });
            }
        }

        const highDeviationPoints = result.comparisonDetails.filter(d => 
            d.tempDeviation > ComparisonThresholds.REVIEW_TEMP_DEVIATION ||
            d.humidityDeviation > ComparisonThresholds.REVIEW_HUMIDITY_DEVIATION
        );

        if (highDeviationPoints.length > 0) {
            const times = highDeviationPoints.map(p => `${p.time}h`).join(', ');
            result.warnings.push(`以下时段偏差较大：${times}`);
            result.messages.push({ type: 'warning', text: `注意：以下时段偏差较大：${times}` });
        }

        const tempPass = result.tempDeviationAvg <= ComparisonThresholds.PASS_TEMP_DEVIATION;
        const humidityPass = result.humidityDeviationAvg <= ComparisonThresholds.PASS_HUMIDITY_DEVIATION;
        const mcPass = !batchInfo || result.targetMCMet;

        result.passed = tempPass && humidityPass && mcPass;

        if (result.passed) {
            result.messages.push({ type: 'success', text: '批次对比校准通过' });
            result.messages.push({ type: 'info', text: '建议：可直接用于生产' });
        }

        return result;
    }

    function determineFinalResult(curveResult, modelResult, comparisonResult) {
        if (!curveResult || !curveResult.passed) {
            return {
                status: 'FAILED',
                reason: '曲线导入验证失败',
                severity: 'critical',
                missingData: !curveResult
            };
        }

        if (!modelResult) {
            return {
                status: 'FAILED',
                reason: '含水率模型验证未执行：缺少实测/抽检数据，无法验证模型可靠性',
                severity: 'critical',
                missingData: true
            };
        }

        if (!modelResult.passed && modelResult.errors && modelResult.errors.length > 0) {
            return {
                status: 'FAILED',
                reason: '含水率模型验证失败：' + modelResult.errors[0],
                severity: 'critical'
            };
        }

        if (!comparisonResult) {
            return {
                status: 'FAILED',
                reason: '批次对比未执行：缺少实测数据，无法验证是否与原始数据对得上',
                severity: 'critical',
                missingData: true
            };
        }

        if (!comparisonResult.passed && comparisonResult.errors && comparisonResult.errors.length > 0) {
            return {
                status: 'FAILED',
                reason: '批次对比失败：' + comparisonResult.errors[0],
                severity: 'critical'
            };
        }

        const modelCritical = modelResult.avgDeviation > ModelThresholds.REVIEW_AVG_DEVIATION ||
                             modelResult.maxDeviation > ModelThresholds.REVIEW_MAX_DEVIATION ||
                             modelResult.correlationCoefficient < ModelThresholds.REVIEW_CORRELATION;

        if (modelCritical) {
            return {
                status: 'FAILED',
                reason: '含水率模型验证严重失败',
                severity: 'critical'
            };
        }

        const comparisonCritical = comparisonResult.tempDeviationAvg > ComparisonThresholds.REVIEW_TEMP_DEVIATION ||
                                   comparisonResult.humidityDeviationAvg > ComparisonThresholds.REVIEW_HUMIDITY_DEVIATION;

        if (comparisonCritical) {
            return {
                status: 'FAILED',
                reason: '批次对比偏差过大',
                severity: 'critical'
            };
        }

        const hasWarnings = 
            (modelResult.avgDeviation > ModelThresholds.PASS_AVG_DEVIATION ||
             modelResult.maxDeviation > ModelThresholds.PASS_MAX_DEVIATION ||
             modelResult.correlationCoefficient < ModelThresholds.PASS_CORRELATION) ||
            (comparisonResult.tempDeviationAvg > ComparisonThresholds.PASS_TEMP_DEVIATION ||
             comparisonResult.humidityDeviationAvg > ComparisonThresholds.PASS_HUMIDITY_DEVIATION ||
             !comparisonResult.targetMCMet);

        if (hasWarnings) {
            return {
                status: 'NEEDS_REVIEW',
                reason: '存在中等程度偏差，需人工复核',
                severity: 'medium'
            };
        }

        return {
            status: 'PASSED',
            reason: '所有验证通过：曲线格式正确、模型可靠、批次数据对得上',
            severity: 'low'
        };
    }

    return {
        CurveThresholds,
        ModelThresholds,
        ComparisonThresholds,
        validateCurveData,
        validateMoistureModel,
        compareBatchData,
        determineFinalResult,
        calculateCorrelation
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationEngine;
}
