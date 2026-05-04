// 音准分析模块
// 负责检测跑调、抢拍、声部不均衡和反复出错的问题

const Analysis = (function() {
    // 配置参数
    const CONFIG = {
        // 音准阈值（音分，100音分 = 1半音）
        PITCH_THRESHOLD_CENTS: 25,
        // 节奏阈值（秒）
        RHYTHM_THRESHOLD_SECONDS: 0.2,
        // 声部不均衡阈值（分贝差异）
        BALANCE_THRESHOLD_DB: 10,
        // 反复出错阈值（同一问题出现次数）
        REPEAT_ISSUE_THRESHOLD: 3,
        // 最小有效频率（排除静音）
        MIN_FREQUENCY: 60,
        // 最小有效响度
        MIN_LOUDNESS: -40
    };

    // 计算频率偏差（音分）
    function calculatePitchCents(actualFreq, targetFreq) {
        if (targetFreq <= 0 || actualFreq <= 0) return 0;
        return 1200 * Math.log2(actualFreq / targetFreq);
    }

    // 检测跑调问题
    function detectPitchIssues(rehearsalData, targetData) {
        const issues = [];
        
        // 按声部和小节分组排练数据
        const groupedRehearsal = groupDataByVoiceAndMeasure(rehearsalData);
        
        // 按声部和小节分组目标数据
        const groupedTarget = groupDataByVoiceAndMeasure(targetData);
        
        // 遍历每个声部和小节
        for (const voice in groupedRehearsal) {
            for (const measure in groupedRehearsal[voice]) {
                const rehearsalItems = groupedRehearsal[voice][measure];
                const targetItems = groupedTarget[voice]?.[measure] || [];
                
                if (targetItems.length === 0) continue;
                
                // 计算该小节的平均频率
                const validFrequencies = rehearsalItems
                    .filter(item => item.frequency >= CONFIG.MIN_FREQUENCY)
                    .map(item => item.frequency);
                
                if (validFrequencies.length === 0) continue;
                
                const avgFrequency = validFrequencies.reduce((a, b) => a + b, 0) / validFrequencies.length;
                
                // 与目标音高比较
                for (const target of targetItems) {
                    if (target.targetFrequency <= 0) continue;
                    
                    const centsDeviation = calculatePitchCents(avgFrequency, target.targetFrequency);
                    const absCents = Math.abs(centsDeviation);
                    
                    if (absCents >= CONFIG.PITCH_THRESHOLD_CENTS) {
                        const direction = centsDeviation > 0 ? '偏高' : '偏低';
                        const severity = absCents >= 50 ? '严重' : (absCents >= 35 ? '中等' : '轻微');
                        
                        issues.push({
                            id: Storage.generateId(),
                            type: 'pitch',
                            typeName: '跑调',
                            voice: voice,
                            measure: measure,
                            time: rehearsalItems[0]?.time || 0,
                            severity: severity,
                            details: {
                                actualFrequency: avgFrequency.toFixed(2),
                                targetFrequency: target.targetFrequency.toFixed(2),
                                targetPitch: target.targetPitch,
                                centsDeviation: centsDeviation.toFixed(1),
                                direction: direction,
                                sampleCount: validFrequencies.length
                            },
                            description: `${voice}声部在${measure}小节${direction} ${Math.abs(centsDeviation).toFixed(1)}音分`,
                            status: 'pending',
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            }
        }
        
        return issues;
    }

    // 检测节奏问题（抢拍/拖拍）
    function detectRhythmIssues(rehearsalData, targetData) {
        const issues = [];
        
        // 按声部和小节分组
        const groupedRehearsal = groupDataByVoiceAndMeasure(rehearsalData);
        const groupedTarget = groupDataByVoiceAndMeasure(targetData);
        
        // 检测每个声部的时间偏差
        for (const voice in groupedRehearsal) {
            const measures = Object.keys(groupedRehearsal[voice]).sort();
            
            for (let i = 0; i < measures.length; i++) {
                const measure = measures[i];
                const rehearsalItems = groupedRehearsal[voice][measure];
                
                if (rehearsalItems.length === 0) continue;
                
                // 获取该小节的实际开始时间
                const actualStartTime = Math.min(...rehearsalItems.map(item => item.time));
                
                // 查找目标数据中的预期时间（如果有）
                const targetItems = groupedTarget[voice]?.[measure] || [];
                
                // 简单的节奏检测：基于相邻小节的时间间隔
                if (i > 0) {
                    const prevMeasure = measures[i - 1];
                    const prevItems = groupedRehearsal[voice][prevMeasure];
                    
                    if (prevItems.length > 0) {
                        const prevEndTime = Math.max(...prevItems.map(item => item.time));
                        const actualInterval = actualStartTime - prevEndTime;
                        
                        // 预期间隔（假设平均每个小节2秒，可根据实际情况调整）
                        const expectedInterval = 2.0;
                        const timeDeviation = actualInterval - expectedInterval;
                        
                        if (Math.abs(timeDeviation) >= CONFIG.RHYTHM_THRESHOLD_SECONDS) {
                            const direction = timeDeviation < 0 ? '抢拍' : '拖拍';
                            const severity = Math.abs(timeDeviation) >= 0.5 ? '严重' : (Math.abs(timeDeviation) >= 0.35 ? '中等' : '轻微');
                            
                            issues.push({
                                id: Storage.generateId(),
                                type: 'rhythm',
                                typeName: '节奏',
                                voice: voice,
                                measure: measure,
                                time: actualStartTime,
                                severity: severity,
                                details: {
                                    actualInterval: actualInterval.toFixed(2),
                                    expectedInterval: expectedInterval.toFixed(2),
                                    timeDeviation: timeDeviation.toFixed(2),
                                    direction: direction
                                },
                                description: `${voice}声部在${measure}小节${direction} ${Math.abs(timeDeviation).toFixed(2)}秒`,
                                status: 'pending',
                                createdAt: new Date().toISOString()
                            });
                        }
                    }
                }
            }
        }
        
        return issues;
    }

    // 检测声部不均衡问题
    function detectBalanceIssues(rehearsalData) {
        const issues = [];
        
        // 按小节和时间分组
        const timeGroups = groupDataByTimeWindow(rehearsalData, 1.0); // 1秒窗口
        
        for (const timeKey in timeGroups) {
            const timeItems = timeGroups[timeKey];
            
            // 按声部分组
            const voiceGroups = {};
            for (const item of timeItems) {
                if (!voiceGroups[item.voice]) {
                    voiceGroups[item.voice] = [];
                }
                if (item.loudness >= CONFIG.MIN_LOUDNESS) {
                    voiceGroups[item.voice].push(item.loudness);
                }
            }
            
            // 计算每个声部的平均响度
            const voiceAvgs = {};
            for (const voice in voiceGroups) {
                if (voiceGroups[voice].length > 0) {
                    voiceAvgs[voice] = voiceGroups[voice].reduce((a, b) => a + b, 0) / voiceGroups[voice].length;
                }
            }
            
            // 比较各声部响度差异
            const voices = Object.keys(voiceAvgs);
            if (voices.length >= 2) {
                const loudnessValues = Object.values(voiceAvgs);
                const maxLoudness = Math.max(...loudnessValues);
                const minLoudness = Math.min(...loudnessValues);
                const loudnessDiff = maxLoudness - minLoudness;
                
                if (loudnessDiff >= CONFIG.BALANCE_THRESHOLD_DB) {
                    const loudestVoice = voices.find(v => voiceAvgs[v] === maxLoudness);
                    const quietestVoice = voices.find(v => voiceAvgs[v] === minLoudness);
                    const severity = loudnessDiff >= 20 ? '严重' : (loudnessDiff >= 15 ? '中等' : '轻微');
                    
                    // 获取代表性小节
                    const measures = [...new Set(timeItems.map(item => item.measure))];
                    
                    issues.push({
                        id: Storage.generateId(),
                        type: 'balance',
                        typeName: '声部不均衡',
                        voice: '多声部',
                        measure: measures.length > 0 ? measures[0] : '未知',
                        time: parseFloat(timeKey.split('-')[0]),
                        severity: severity,
                        details: {
                            loudestVoice: loudestVoice,
                            quietestVoice: quietestVoice,
                            loudestLoudness: maxLoudness.toFixed(2),
                            quietestLoudness: minLoudness.toFixed(2),
                            loudnessDiff: loudnessDiff.toFixed(2),
                            voices: voices
                        },
                        description: `${loudestVoice}声部（${maxLoudness.toFixed(1)}dB）比${quietestVoice}声部（${minLoudness.toFixed(1)}dB）响${loudnessDiff.toFixed(1)}dB`,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }
        
        // 去重（同一问题可能在多个时间窗口检测到）
        return deduplicateIssues(issues, 'balance');
    }

    // 检测反复出错的小节
    function detectRepeatIssues(issues, rehearsalData) {
        const repeatIssues = [];
        
        // 按声部和小节统计问题出现次数
        const issueCount = {};
        
        for (const issue of issues) {
            const key = `${issue.voice}-${issue.measure}`;
            if (!issueCount[key]) {
                issueCount[key] = {
                    count: 0,
                    issues: [],
                    voice: issue.voice,
                    measure: issue.measure
                };
            }
            issueCount[key].count++;
            issueCount[key].issues.push(issue);
        }
        
        // 找出反复出错的小节
        for (const key in issueCount) {
            const data = issueCount[key];
            if (data.count >= CONFIG.REPEAT_ISSUE_THRESHOLD) {
                const issueTypes = [...new Set(data.issues.map(i => i.typeName))];
                const avgTime = data.issues.reduce((sum, i) => sum + i.time, 0) / data.issues.length;
                
                repeatIssues.push({
                    id: Storage.generateId(),
                    type: 'repeat',
                    typeName: '反复出错',
                    voice: data.voice,
                    measure: data.measure,
                    time: avgTime,
                    severity: '严重',
                    details: {
                        issueCount: data.count,
                        issueTypes: issueTypes,
                        relatedIssues: data.issues.map(i => i.id)
                    },
                    description: `${data.voice}声部在${data.measure}小节反复出现${data.count}次问题（${issueTypes.join('、')}）`,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                });
            }
        }
        
        return repeatIssues;
    }

    // 按声部和小节分组数据
    function groupDataByVoiceAndMeasure(data) {
        const groups = {};
        
        for (const item of data) {
            const voice = item.voice || '未知声部';
            const measure = item.measure || '未知小节';
            
            if (!groups[voice]) {
                groups[voice] = {};
            }
            if (!groups[voice][measure]) {
                groups[voice][measure] = [];
            }
            groups[voice][measure].push(item);
        }
        
        return groups;
    }

    // 按时间窗口分组数据
    function groupDataByTimeWindow(data, windowSize) {
        const groups = {};
        
        for (const item of data) {
            const windowStart = Math.floor(item.time / windowSize) * windowSize;
            const windowEnd = windowStart + windowSize;
            const key = `${windowStart.toFixed(1)}-${windowEnd.toFixed(1)}`;
            
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
        }
        
        return groups;
    }

    // 去重问题
    function deduplicateIssues(issues, type) {
        const seen = new Set();
        const uniqueIssues = [];
        
        for (const issue of issues) {
            const key = `${issue.voice}-${issue.measure}-${issue.type}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueIssues.push(issue);
            }
        }
        
        return uniqueIssues;
    }

    // 主分析函数
    function analyze() {
        const rehearsalData = Storage.loadRehearsalData();
        const targetData = Storage.loadTargetData();
        
        if (!rehearsalData || rehearsalData.length === 0) {
            return { success: false, error: '没有排练数据，请先导入排练片段CSV' };
        }
        
        if (!targetData || targetData.length === 0) {
            return { success: false, error: '没有目标音高表数据，请先导入目标音高表CSV' };
        }
        
        // 执行各类检测
        const pitchIssues = detectPitchIssues(rehearsalData, targetData);
        const rhythmIssues = detectRhythmIssues(rehearsalData, targetData);
        const balanceIssues = detectBalanceIssues(rehearsalData);
        
        // 合并所有基础问题
        const allBaseIssues = [...pitchIssues, ...rhythmIssues, ...balanceIssues];
        
        // 检测反复出错的小节
        const repeatIssues = detectRepeatIssues(allBaseIssues, rehearsalData);
        
        // 合并所有问题
        const allIssues = [...allBaseIssues, ...repeatIssues];
        
        // 保存分析结果
        Storage.saveIssues(allIssues);
        Storage.saveLastAnalysisTime(new Date().toISOString());
        
        // 统计数据
        const stats = {
            total: allIssues.length,
            pitch: pitchIssues.length,
            rhythm: rhythmIssues.length,
            balance: balanceIssues.length,
            repeat: repeatIssues.length
        };
        
        return {
            success: true,
            issues: allIssues,
            stats: stats,
            rehearsalCount: rehearsalData.length,
            targetCount: targetData.length
        };
    }

    // 获取问题类型名称
    function getIssueTypeName(type) {
        const typeMap = {
            'pitch': '跑调',
            'rhythm': '节奏',
            'balance': '声部不均衡',
            'repeat': '反复出错'
        };
        return typeMap[type] || type;
    }

    // 获取严重程度名称
    function getSeverityName(severity) {
        const severityMap = {
            'mild': '轻微',
            'medium': '中等',
            'severe': '严重'
        };
        return severityMap[severity] || severity;
    }

    return {
        // 主方法
        analyze,
        
        // 单独检测方法
        detectPitchIssues,
        detectRhythmIssues,
        detectBalanceIssues,
        detectRepeatIssues,
        
        // 工具方法
        getIssueTypeName,
        getSeverityName,
        calculatePitchCents,
        
        // 配置
        CONFIG
    };
})();

// 导出Analysis对象（在浏览器环境中直接可用）
if (typeof window !== 'undefined') {
    window.Analysis = Analysis;
}
