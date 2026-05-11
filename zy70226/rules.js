const CoffeeRules = {
    CONFIG: {
        BEST_BEFORE_DAYS: 14,
        OPENED_EXPIRY_DAYS: 7,
        LOW_STOCK_THRESHOLD: 500,
        CRITICAL_STOCK_THRESHOLD: 200
    },

    RULES: [
        {
            id: 'RULE-001',
            name: '烘焙日期验证',
            description: '烘焙日期不能晚于当前日期',
            type: 'validation',
            test: (data) => {
                if (!data.roastDate) return { valid: true };
                const roastDate = new Date(data.roastDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                roastDate.setHours(0, 0, 0, 0);
                if (roastDate > today) {
                    return { 
                        valid: false, 
                        reason: `烘焙日期(${data.roastDate})不能晚于今天` 
                    };
                }
                return { valid: true };
            }
        },
        {
            id: 'RULE-002',
            name: '数量验证',
            description: '数量必须大于0',
            type: 'validation',
            test: (data) => {
                const quantity = data.quantity || data.openQuantity || data.consumptionQuantity;
                if (quantity === undefined || quantity === null) return { valid: true };
                if (quantity <= 0) {
                    return { 
                        valid: false, 
                        reason: `数量(${quantity})必须大于0` 
                    };
                }
                return { valid: true };
            }
        },
        {
            id: 'RULE-003',
            name: '批次存在性验证',
            description: '批次必须存在',
            type: 'validation',
            test: (data, context) => {
                if (!data.batchId) return { valid: true };
                const batch = DataStore.getBatch(data.batchId);
                if (!batch) {
                    return { 
                        valid: false, 
                        reason: `批次(${data.batchId})不存在` 
                    };
                }
                return { valid: true, batch };
            }
        },
        {
            id: 'RULE-004',
            name: '开封数量验证',
            description: '开封数量不能超过批次剩余数量',
            type: 'validation',
            test: (data, context) => {
                if (!data.batchId || !data.openQuantity) return { valid: true };
                const batch = DataStore.getBatch(data.batchId);
                if (!batch) return { valid: true };
                if (data.openQuantity > batch.remainingQuantity) {
                    return { 
                        valid: false, 
                        reason: `开封数量(${data.openQuantity}g)超过批次剩余数量(${batch.remainingQuantity}g)` 
                    };
                }
                return { valid: true };
            }
        },
        {
            id: 'RULE-005',
            name: '消耗数量验证',
            description: '消耗数量不能超过开封数量',
            type: 'validation',
            test: (data, context) => {
                if (!data.batchId || !data.quantity) return { valid: true };
                const openings = DataStore.openings.filter(o => 
                    o.batchId === data.batchId && o.status === 'confirmed'
                );
                const totalOpened = openings.reduce((sum, o) => sum + o.openQuantity, 0);
                const consumptions = DataStore.consumptions.filter(c => c.batchId === data.batchId);
                const totalConsumed = consumptions.reduce((sum, c) => sum + c.quantity, 0);
                if (totalConsumed + data.quantity > totalOpened) {
                    return { 
                        valid: false, 
                        reason: `累计消耗(${totalConsumed + data.quantity}g)超过开封数量(${totalOpened}g)` 
                    };
                }
                return { valid: true };
            }
        },
        {
            id: 'RULE-006',
            name: '最佳赏味期提醒',
            description: '批次即将到达最佳赏味期时优先使用',
            type: 'rotation',
            priority: 1,
            evaluate: (batch) => {
                const bestBefore = new Date(batch.bestBefore);
                const today = new Date();
                const diffDays = Math.ceil((bestBefore - today) / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) {
                    return {
                        score: 100,
                        level: 'critical',
                        message: `已过期${Math.abs(diffDays)}天，应立即处理`
                    };
                } else if (diffDays <= 3) {
                    return {
                        score: 90 - diffDays,
                        level: 'warning',
                        message: `剩余${diffDays}天到达最佳赏味期，建议优先使用`
                    };
                }
                return {
                    score: 50,
                    level: 'normal',
                    message: '赏味期正常'
                };
            }
        },
        {
            id: 'RULE-007',
            name: '开封时间轮换',
            description: '已开封的咖啡豆优先使用',
            type: 'rotation',
            priority: 2,
            evaluate: (batch, context) => {
                const openings = context.openings.filter(o => 
                    o.batchId === batch.id && o.status === 'confirmed'
                );
                
                if (openings.length === 0) {
                    return {
                        score: 40,
                        level: 'normal',
                        message: '尚未开封'
                    };
                }
                
                const latestOpening = openings.reduce((latest, o) => 
                    new Date(o.openDate) > new Date(latest.openDate) ? o : latest
                );
                
                const openDate = new Date(latestOpening.openDate);
                const today = new Date();
                const daysOpened = Math.ceil((today - openDate) / (1000 * 60 * 60 * 24));
                
                if (daysOpened >= 7) {
                    return {
                        score: 85,
                        level: 'warning',
                        message: `已开封${daysOpened}天，超过建议保质期，应尽快使用`
                    };
                } else if (daysOpened >= 3) {
                    return {
                        score: 70,
                        level: 'warning',
                        message: `已开封${daysOpened}天，建议尽快使用`
                    };
                }
                return {
                    score: 65,
                    level: 'normal',
                    message: `已开封${daysOpened}天`
                };
            }
        },
        {
            id: 'RULE-008',
            name: '门店消耗分析',
            description: '根据门店消耗速率调整轮换优先级',
            type: 'rotation',
            priority: 3,
            evaluate: (batch, context) => {
                const consumptions = context.consumptions.filter(c => c.batchId === batch.id);
                
                if (consumptions.length === 0) {
                    return {
                        score: 50,
                        level: 'normal',
                        message: '暂无消耗记录'
                    };
                }
                
                const totalConsumed = consumptions.reduce((sum, c) => sum + c.quantity, 0);
                const remainingDays = Math.ceil((new Date(batch.bestBefore) - new Date()) / (1000 * 60 * 60 * 24));
                
                if (remainingDays <= 0) {
                    return {
                        score: 50,
                        level: 'normal',
                        message: '已过期，结合其他规则处理'
                    };
                }
                
                const dailyConsumption = totalConsumed / Math.max(1, consumptions.length);
                const estimatedDays = batch.remainingQuantity / Math.max(1, dailyConsumption);
                
                if (estimatedDays < remainingDays * 0.5) {
                    return {
                        score: 75,
                        level: 'warning',
                        message: `消耗速度(${Math.round(dailyConsumption)}g/天)较慢，剩余${Math.round(estimatedDays)}天用量，需关注`
                    };
                } else if (estimatedDays > remainingDays * 1.5) {
                    return {
                        score: 55,
                        level: 'normal',
                        message: `消耗速度正常，预计${Math.round(estimatedDays)}天用完`
                    };
                }
                
                return {
                    score: 50,
                    level: 'normal',
                    message: '消耗速度与剩余时间匹配'
                };
            }
        },
        {
            id: 'RULE-009',
            name: '库存水平监控',
            description: '库存低于阈值时提醒补货',
            type: 'rotation',
            priority: 4,
            evaluate: (batch) => {
                const remaining = batch.remainingQuantity;
                
                if (remaining <= this.CONFIG.CRITICAL_STOCK_THRESHOLD) {
                    return {
                        score: 95,
                        level: 'critical',
                        message: `库存严重不足(${remaining}g)，需紧急补货`
                    };
                } else if (remaining <= this.CONFIG.LOW_STOCK_THRESHOLD) {
                    return {
                        score: 80,
                        level: 'warning',
                        message: `库存较低(${remaining}g)，建议补货`
                    };
                }
                
                return {
                    score: 45,
                    level: 'normal',
                    message: `库存充足(${remaining}g)`
                };
            }
        }
    ],

    validateBatch(data) {
        const validationRules = this.RULES.filter(r => r.type === 'validation');
        const results = [];
        let isValid = true;
        
        for (const rule of validationRules) {
            const result = rule.test(data);
            results.push({
                ruleId: rule.id,
                ruleName: rule.name,
                ...result
            });
            if (!result.valid) {
                isValid = false;
            }
        }
        
        return {
            valid: isValid,
            results,
            firstError: results.find(r => !r.valid)
        };
    },

    validateOpening(data) {
        return this.validateBatch(data);
    },

    validateConsumption(data) {
        return this.validateBatch(data);
    },

    calculateRotation(store) {
        const batches = DataStore.getBatchesByStore(store).filter(b => b.status === 'confirmed');
        const openings = DataStore.getOpeningsByStore(store);
        const consumptions = DataStore.getConsumptionsByStore(store);
        const rotationRules = this.RULES.filter(r => r.type === 'rotation');
        
        const context = { openings, consumptions };
        const results = [];
        
        for (const batch of batches) {
            const ruleResults = [];
            let totalScore = 0;
            
            for (const rule of rotationRules) {
                const result = rule.evaluate(batch, context);
                ruleResults.push({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    ...result
                });
                totalScore += result.score * rule.priority;
            }
            
            const avgScore = totalScore / rotationRules.reduce((sum, r) => sum + r.priority, 0);
            const hasWarning = ruleResults.some(r => r.level === 'warning');
            const hasCritical = ruleResults.some(r => r.level === 'critical');
            
            results.push({
                batch,
                score: avgScore,
                level: hasCritical ? 'critical' : hasWarning ? 'warning' : 'normal',
                ruleResults,
                recommendations: ruleResults.filter(r => r.level !== 'normal').map(r => r.message)
            });
        }
        
        results.sort((a, b) => b.score - a.score);
        
        return {
            results,
            criticalCount: results.filter(r => r.level === 'critical').length,
            warningCount: results.filter(r => r.level === 'warning').length,
            normalCount: results.filter(r => r.level === 'normal').length
        };
    },

    generateRotationReport(store) {
        const rotation = this.calculateRotation(store);
        
        let report = '# 豆仓轮换报告\n\n';
        report += `**生成时间**: ${new Date().toLocaleString()}\n\n`;
        report += `**门店**: ${store}\n\n`;
        report += `---\n\n`;
        
        report += '## 概览\n\n';
        report += `- 严重问题: ${rotation.criticalCount}\n`;
        report += `- 需要关注: ${rotation.warningCount}\n`;
        report += `- 正常状态: ${rotation.normalCount}\n\n`;
        report += `---\n\n`;
        
        report += '## 轮换优先级\n\n';
        
        for (let i = 0; i < rotation.results.length; i++) {
            const item = rotation.results[i];
            const levelBadge = item.level === 'critical' ? '🔴' : 
                              item.level === 'warning' ? '🟡' : '🟢';
            
            report += `### ${levelBadge} 优先级 ${i + 1}: ${item.batch.coffeeType}\n\n`;
            report += `- **批次编号**: ${item.batch.id}\n`;
            report += `- **烘焙日期**: ${item.batch.roastDate}\n`;
            report += `- **最佳赏味期**: ${item.batch.bestBefore}\n`;
            report += `- **剩余数量**: ${item.batch.remainingQuantity}g\n`;
            report += `- **轮换分数**: ${Math.round(item.score)}\n\n`;
            
            if (item.recommendations.length > 0) {
                report += '**建议**:\n';
                for (const rec of item.recommendations) {
                    report += `- ${rec}\n`;
                }
                report += '\n';
            }
            
            report += '**规则详情**:\n';
            for (const rule of item.ruleResults) {
                const ruleBadge = rule.level === 'critical' ? '🔴' : 
                                 rule.level === 'warning' ? '🟡' : '🟢';
                report += `- ${ruleBadge} ${rule.ruleName}: ${rule.message} (分数: ${rule.score})\n`;
            }
            report += '\n---\n\n';
        }
        
        return report;
    }
};

const RuleTests = {
    tests: [
        {
            id: 'TEST-001',
            name: '烘焙日期不能晚于今天',
            ruleId: 'RULE-001',
            description: '验证系统拒绝未来的烘焙日期',
            testData: {
                roastDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            expected: { valid: false }
        },
        {
            id: 'TEST-002',
            name: '数量不能为负数',
            ruleId: 'RULE-002',
            description: '验证系统拒绝负数量',
            testData: {
                quantity: -100
            },
            expected: { valid: false }
        },
        {
            id: 'TEST-003',
            name: '数量不能为零',
            ruleId: 'RULE-002',
            description: '验证系统拒绝零数量',
            testData: {
                quantity: 0
            },
            expected: { valid: false }
        },
        {
            id: 'TEST-004',
            name: '正常烘焙日期应通过',
            ruleId: 'RULE-001',
            description: '验证系统接受过去的烘焙日期',
            testData: {
                roastDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            expected: { valid: true }
        },
        {
            id: 'TEST-005',
            name: '正常数量应通过',
            ruleId: 'RULE-002',
            description: '验证系统接受正数量',
            testData: {
                quantity: 1000
            },
            expected: { valid: true }
        },
        {
            id: 'TEST-006',
            name: '开封数量不能超过剩余数量',
            ruleId: 'RULE-004',
            description: '验证系统拒绝超过剩余数量的开封请求',
            setup: () => {
                const batch = DataStore.addBatch({
                    coffeeType: '测试咖啡豆',
                    roastDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    bestBefore: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    quantity: 500,
                    remainingQuantity: 500,
                    status: 'confirmed'
                });
                return { batch };
            },
            testData: (context) => ({
                batchId: context.batch.id,
                openQuantity: 600
            }),
            expected: { valid: false }
        }
    ],

    runAllTests() {
        const results = [];
        
        for (const test of this.tests) {
            const result = this.runTest(test);
            results.push(result);
        }
        
        return {
            total: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length,
            results
        };
    },

    runTest(test) {
        let context = null;
        let testData = test.testData;
        
        try {
            if (test.setup) {
                context = test.setup();
            }
            
            if (typeof test.testData === 'function') {
                testData = test.testData(context);
            }
            
            const rule = CoffeeRules.RULES.find(r => r.id === test.ruleId);
            if (!rule) {
                return {
                    ...test,
                    passed: false,
                    error: `规则 ${test.ruleId} 不存在`
                };
            }
            
            const result = rule.test ? rule.test(testData) : { valid: true };
            const passed = result.valid === test.expected.valid;
            
            return {
                ...test,
                passed,
                actual: result,
                error: passed ? null : `期望 ${JSON.stringify(test.expected)}，实际 ${JSON.stringify(result)}`
            };
        } catch (error) {
            return {
                ...test,
                passed: false,
                error: error.message
            };
        } finally {
            if (context && context.batch) {
                DataStore.batches = DataStore.batches.filter(b => b.id !== context.batch.id);
            }
        }
    }
};
