const VerificationService = {
    VERIFICATION_STATUS: {
        PASS: 'pass',
        WARN: 'warn',
        FAIL: 'fail',
        CONFLICT: 'conflict'
    },
    
    runCompleteVerification: function(members, sections, attendance, allocationResult) {
        const results = {
            overallStatus: this.VERIFICATION_STATUS.PASS,
            categories: {},
            summary: {
                pass: 0,
                warn: 0,
                fail: 0,
                conflict: 0
            },
            runAt: Date.now()
        };
        
        results.categories.voiceRange = this.verifyVoiceRanges(members, sections, allocationResult);
        results.categories.capacity = this.verifySectionCapacities(sections, allocationResult);
        results.categories.attendance = this.verifyAttendance(members, attendance, allocationResult);
        results.categories.balance = this.verifyBalance(members, sections, allocationResult);
        results.categories.consistency = this.verifyDataConsistency(members, sections);
        
        for (const category in results.categories) {
            const cat = results.categories[category];
            results.summary[cat.status]++;
            
            if (this.isWorseStatus(cat.status, results.overallStatus)) {
                results.overallStatus = cat.status;
            }
        }
        
        results.summaryMessage = this.generateSummaryMessage(results);
        results.suggestions = this.generateSuggestions(results);
        
        return results;
    },
    
    verifyVoiceRanges: function(members, sections, allocationResult) {
        const result = {
            status: this.VERIFICATION_STATUS.PASS,
            title: '音域匹配验证',
            items: [],
            summary: ''
        };
        
        let validCount = 0;
        let warningCount = 0;
        let failCount = 0;
        
        for (const member of members) {
            if (!member.voiceLow || !member.voiceHigh) {
                result.items.push({
                    status: this.VERIFICATION_STATUS.FAIL,
                    title: `${member.name} 音域未设置`,
                    description: '最低音和最高音必须都设置才能参与分配',
                    suggestion: `请在成员管理中为 ${member.name} 设置完整的音域范围`
                });
                failCount++;
                continue;
            }
            
            const lowIdx = NOTES.getIndex(member.voiceLow);
            const highIdx = NOTES.getIndex(member.voiceHigh);
            
            if (lowIdx >= highIdx) {
                result.items.push({
                    status: this.VERIFICATION_STATUS.FAIL,
                    title: `${member.name} 音域范围无效`,
                    description: `最低音 ${member.voiceLow} 不能高于最高音 ${member.voiceHigh}`,
                    suggestion: '请调整音域范围，确保最低音低于最高音'
                });
                failCount++;
                continue;
            }
            
            const alloc = allocationResult ? allocationResult.getMemberAllocation(member.id) : null;
            if (alloc) {
                const section = sections.find(s => s.id === alloc.sectionId);
                if (section) {
                    if (!member.canFitSection(section)) {
                        result.items.push({
                            status: this.VERIFICATION_STATUS.WARN,
                            title: `${member.name} 音域与 ${section.name} 部分不匹配`,
                            description: `成员音域 (${member.voiceLow}-${member.voiceHigh}) 与声部音域 (${section.voiceLow}-${section.voiceHigh}) 重叠度不足`,
                            suggestion: '建议检查音域设置，或考虑调整分配'
                        });
                        warningCount++;
                    } else {
                        validCount++;
                    }
                }
            } else {
                const hasMatchingSection = sections.some(s => member.canFitSection(s));
                if (!hasMatchingSection && sections.length > 0) {
                    result.items.push({
                        status: this.VERIFICATION_STATUS.WARN,
                        title: `${member.name} 音域可能超出所有声部范围`,
                        description: `成员音域 (${member.voiceLow}-${member.voiceHigh}) 可能无法匹配任何声部`,
                        suggestion: '建议扩宽声部音域或调整成员音域设置'
                    });
                    warningCount++;
                } else {
                    validCount++;
                }
            }
        }
        
        if (failCount > 0) {
            result.status = this.VERIFICATION_STATUS.FAIL;
            result.summary = `发现 ${failCount} 个音域问题需要修复，${warningCount} 个警告需要关注`;
        } else if (warningCount > 0) {
            result.status = this.VERIFICATION_STATUS.WARN;
            result.summary = `音域基本有效，${warningCount} 个成员音域需要关注`;
        } else {
            result.summary = `全部 ${members.length} 个成员音域设置有效`;
        }
        
        return result;
    },
    
    verifySectionCapacities: function(sections, allocationResult) {
        const result = {
            status: this.VERIFICATION_STATUS.PASS,
            title: '声部容量验证',
            items: [],
            summary: ''
        };
        
        let failCount = 0;
        let warnCount = 0;
        
        for (const section of sections) {
            if (section.minCapacity < 0) {
                result.items.push({
                    status: this.VERIFICATION_STATUS.FAIL,
                    title: `${section.name} 最小人数设置无效`,
                    description: '最小人数不能为负数',
                    suggestion: '请将最小人数设置为0或更大的数值'
                });
                failCount++;
            }
            
            if (section.maxCapacity < 1) {
                result.items.push({
                    status: this.VERIFICATION_STATUS.FAIL,
                    title: `${section.name} 最大人数设置无效`,
                    description: '最大人数必须大于0',
                    suggestion: '请设置至少1人的最大容量'
                });
                failCount++;
            }
            
            if (section.minCapacity > section.maxCapacity) {
                result.items.push({
                    status: this.VERIFICATION_STATUS.FAIL,
                    title: `${section.name} 容量设置冲突`,
                    description: `最小人数 (${section.minCapacity}) 不能大于最大人数 (${section.maxCapacity})`,
                    suggestion: '请调整容量范围，确保最小值小于等于最大值'
                });
                failCount++;
            }
            
            if (!section.voiceLow || !section.voiceHigh) {
                result.items.push({
                    status: this.VERIFICATION_STATUS.FAIL,
                    title: `${section.name} 音域未设置`,
                    description: '声部必须设置音域范围才能进行分配',
                    suggestion: '请为声部落低设置完整的音域范围'
                });
                failCount++;
            }
            
            if (allocationResult) {
                const count = allocationResult.getSectionCount(section.id);
                
                if (section.isOverCapacity(count)) {
                    result.items.push({
                        status: this.VERIFICATION_STATUS.FAIL,
                        title: `${section.name} 超额分配`,
                        description: `当前分配 ${count} 人，超出最大容量 ${section.maxCapacity} 人`,
                        suggestion: `请减少 ${section.name} 的分配人数，或增加该声部的最大容量`
                    });
                    failCount++;
                } else if (section.isBelowMinimum(count)) {
                    result.items.push({
                        status: this.VERIFICATION_STATUS.WARN,
                        title: `${section.name} 人数不足`,
                        description: `当前分配 ${count} 人，未达到最小要求 ${section.minCapacity} 人`,
                        suggestion: '建议确认该声部最小人数要求，或尝试调整分配参数'
                    });
                    warnCount++;
                }
            }
        }
        
        if (failCount > 0) {
            result.status = this.VERIFICATION_STATUS.FAIL;
            result.summary = `发现 ${failCount} 个声部容量问题需要修复`;
        } else if (warnCount > 0) {
            result.status = this.VERIFICATION_STATUS.WARN;
            result.summary = `声部配置有效，${warnCount} 个声部未达到最小人数`;
        } else {
            result.summary = `全部 ${sections.length} 个声部容量配置有效`;
        }
        
        return result;
    },
    
    verifyAttendance: function(members, attendance, allocationResult) {
        const result = {
            status: this.VERIFICATION_STATUS.PASS,
            title: '出勤状态验证',
            items: [],
            summary: ''
        };
        
        let inconsistentCount = 0;
        let totalPresent = 0;
        let totalAbsent = 0;
        
        for (const member of members) {
            const status = attendance[member.id];
            const isPresent = status === undefined || status === true;
            
            if (isPresent) {
                totalPresent++;
            } else {
                totalAbsent++;
            }
            
            if (allocationResult) {
                const isAllocated = allocationResult.isMemberAllocated(member.id);
                
                if (!isPresent && isAllocated) {
                    result.items.push({
                        status: this.VERIFICATION_STATUS.WARN,
                        title: `${member.name} 出勤状态与分配不一致`,
                        description: '该成员标记为缺勤，但已被分配到声部',
                        suggestion: '建议重新分配，或更新出勤状态'
                    });
                    inconsistentCount++;
                }
            }
        }
        
        const newMembers = members.filter(m => attendance[m.id] === undefined);
        if (newMembers.length > 0) {
            result.items.push({
                status: this.VERIFICATION_STATUS.WARN,
                title: `${newMembers.length} 个成员出勤状态未设置`,
                description: '新成员默认按出勤处理',
                suggestion: '建议在出勤管理中确认所有成员的出勤状态'
            });
        }
        
        if (inconsistentCount > 0) {
            result.status = this.VERIFICATION_STATUS.WARN;
            result.summary = `发现 ${inconsistentCount} 个出勤与分配不一致的情况`;
        } else {
            result.summary = `出勤数据一致：${totalPresent} 人出勤，${totalAbsent} 人缺勤`;
        }
        
        return result;
    },
    
    verifyBalance: function(members, sections, allocationResult) {
        const result = {
            status: this.VERIFICATION_STATUS.PASS,
            title: '声部平衡验证',
            items: [],
            summary: ''
        };
        
        if (!allocationResult || sections.length === 0) {
            result.summary = '暂无分配数据进行平衡验证';
            return result;
        }
        
        const sectionCounts = sections.map(s => ({
            section: s,
            count: allocationResult.getSectionCount(s.id)
        }));
        
        const totalAllocated = sectionCounts.reduce((sum, sc) => sum + sc.count, 0);
        
        if (totalAllocated === 0) {
            result.summary = '暂无分配数据';
            return result;
        }
        
        const unallocated = allocationResult.unallocated.length;
        if (unallocated > 0) {
            result.items.push({
                status: this.VERIFICATION_STATUS.WARN,
                title: `${unallocated} 人未分配`,
                description: '部分成员未能分配到任何声部',
                suggestion: '建议检查这些成员的音域设置，或调整声部容量'
            });
        }
        
        const counts = sectionCounts.map(sc => sc.count);
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts.filter(c => c > 0));
        
        if (maxCount - minCount > 3 && totalAllocated > 5) {
            result.items.push({
                status: this.VERIFICATION_STATUS.WARN,
                title: '声部人数差异较大',
                description: `最人声部 ${maxCount} 人，最少声部 ${minCount} 人，差异超过3人`,
                suggestion: '建议开启"平衡各声部人数"选项重新分配'
            });
        }
        
        const voiceRangeMatchRate = allocationResult.stats.voiceRangeMatchRate;
        if (voiceRangeMatchRate < 0.9) {
            result.items.push({
                status: this.VERIFICATION_STATUS.WARN,
                title: '音域匹配率偏低',
                description: `当前音域匹配率 ${(voiceRangeMatchRate * 100).toFixed(0)}%，建议检查分配合理性`,
                suggestion: '建议开启"优先匹配音域"选项，或调整声部音域范围'
            });
        }
        
        if (result.items.length > 0) {
            result.status = this.VERIFICATION_STATUS.WARN;
            result.summary = `已分配 ${totalAllocated} 人，${result.items.length} 个平衡问题需要关注`;
        } else {
            result.summary = `声部平衡良好：共分配 ${totalAllocated} 人，音域匹配率 ${(voiceRangeMatchRate * 100).toFixed(0)}%`;
        }
        
        return result;
    },
    
    verifyDataConsistency: function(members, sections) {
        const result = {
            status: this.VERIFICATION_STATUS.PASS,
            title: '数据一致性验证',
            items: [],
            summary: ''
        };
        
        const memberIds = new Set();
        for (const member of members) {
            if (memberIds.has(member.id)) {
                result.items.push({
                    status: this.VERIFICATION_STATUS.FAIL,
                    title: `成员ID重复: ${member.id}`,
                    description: '存在重复的成员记录',
                    suggestion: '请检查数据一致性'
                });
            }
            memberIds.add(member.id);
        }
        
        const sectionIds = new Set();
        for (const section of sections) {
            if (sectionIds.has(section.id)) {
                result.items.push({
                    status: this.VERIFICATION_STATUS.FAIL,
                    title: `声部ID重复: ${section.id}`,
                    description: '存在重复的声部记录',
                    suggestion: '请检查数据一致性'
                });
            }
            sectionIds.add(section.id);
        }
        
        for (const member of members) {
            if (member.preferredSection && !sectionIds.has(member.preferredSection)) {
                result.items.push({
                    status: this.VERIFICATION_STATUS.WARN,
                    title: `${member.name} 的偏好声部不存在`,
                    description: `偏好声部ID ${member.preferredSection} 在声部列表中未找到`,
                    suggestion: '建议更新该成员的偏好声部设置'
                });
            }
        }
        
        const issuesCount = result.items.filter(i => i.status === this.VERIFICATION_STATUS.FAIL).length;
        
        if (issuesCount > 0) {
            result.status = this.VERIFICATION_STATUS.FAIL;
            result.summary = `发现 ${issuesCount} 个数据一致性问题`;
        } else if (result.items.length > 0) {
            result.status = this.VERIFICATION_STATUS.WARN;
            result.summary = `数据基本一致，${result.items.length} 个次要问题`;
        } else {
            result.summary = '数据一致性检查通过';
        }
        
        return result;
    },
    
    isWorseStatus: function(newStatus, currentStatus) {
        const order = {
            'pass': 0,
            'warn': 1,
            'conflict': 2,
            'fail': 3
        };
        return (order[newStatus] || 0) > (order[currentStatus] || 0);
    },
    
    generateSummaryMessage: function(results) {
        const statusMessages = {
            'pass': '验证通过',
            'warn': '验证通过但存在警告',
            'fail': '验证失败',
            'conflict': '存在需要人工决策的冲突'
        };
        
        let message = statusMessages[results.overallStatus] || '验证完成';
        
        const details = [];
        if (results.summary.pass > 0) {
            details.push(`${results.summary.pass} 项通过`);
        }
        if (results.summary.warn > 0) {
            details.push(`${results.summary.warn} 项警告`);
        }
        if (results.summary.fail > 0) {
            details.push(`${results.summary.fail} 项失败`);
        }
        if (results.summary.conflict > 0) {
            details.push(`${results.summary.conflict} 项冲突`);
        }
        
        if (details.length > 0) {
            message += '：' + details.join('，');
        }
        
        return message;
    },
    
    generateSuggestions: function(results) {
        const suggestions = [];
        
        switch (results.overallStatus) {
            case this.VERIFICATION_STATUS.PASS:
                suggestions.push('当前配置可以正常使用，建议定期重新分配以适应人员变化');
                suggestions.push('可以进行正式排练分配');
                break;
                
            case this.VERIFICATION_STATUS.WARN:
                suggestions.push('存在的警告不影响使用，但建议查看详情');
                suggestions.push('可以进行分配，但需关注警告项');
                break;
                
            case this.VERIFICATION_STATUS.CONFLICT:
                suggestions.push('需要人工决策部分分配问题');
                suggestions.push('建议查看冲突详情后手动调整');
                break;
                
            case this.VERIFICATION_STATUS.FAIL:
                suggestions.push('必须先修复失败项才能继续');
                suggestions.push('建议按验证报告逐项修复问题');
                suggestions.push('修复完成后重新运行验证');
                break;
        }
        
        return suggestions;
    }
};
