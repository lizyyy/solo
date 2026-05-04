const DataExport = {
    exportMarkdown: function(options) {
        const opts = {
            includeSummary: true,
            includeFeedings: true,
            includeAlerts: true,
            includeNotes: true,
            ...options
        };

        const today = Utils.getToday();
        const now = Utils.formatDateTime(new Date());
        const stats = Storage.getStatistics();
        const alerts = Storage.getAlerts();

        let md = `# 宠物寄养店喂药交接单\n\n`;
        md += `**生成时间**: ${now}\n\n`;
        md += `---\n\n`;

        if (opts.includeSummary) {
            md += `## 📊 班次总结\n\n`;
            md += `### 今日数据概览\n\n`;
            md += `- **在院宠物总数**: ${stats.petsCount} 只\n`;
            md += `- **今日喂药计划**: ${stats.todayPlansCount} 项\n`;
            md += `- **已完成喂药**: ${stats.completedToday} 项\n`;
            md += `- **待喂药**: ${stats.pendingToday} 项\n`;
            md += `- **未闭环异常观察**: ${stats.openObservations} 项\n`;
            md += `- **⚠️ 风险提醒总数**: ${stats.totalWarnings} 项\n`;
            
            if (stats.totalWarnings > 0) {
                md += `  - 剂量超重: ${stats.doseWarnings} 项\n`;
                md += `  - 过敏禁忌: ${stats.allergyWarnings} 项\n`;
                md += `  - 同笼冲突: ${stats.cageConflicts} 项\n`;
                md += `  - 漏喂提醒: ${stats.missedFeedings} 项\n`;
            }
            md += `\n`;

            const shifts = ['morning', 'afternoon', 'evening'];
            md += `### 各时段进度\n\n`;
            
            shifts.forEach(shift => {
                const shiftName = Utils.getShiftName(shift);
                const shiftPlans = Storage.getMedicationPlansByDateAndShift(today, shift);
                const shiftRecords = Storage.getFeedingRecordsByDateAndShift(today, shift);
                const completed = shiftRecords.filter(r => r.status === 'completed').length;
                const total = shiftPlans.length;
                const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                
                md += `- **${shiftName}**: ${completed}/${total} 项已完成 (${percentage}%)\n`;
            });
            md += `\n`;
        }

        if (opts.includeFeedings) {
            md += `## 💊 喂药记录详情\n\n`;
            
            const shifts = ['morning', 'afternoon', 'evening'];
            
            shifts.forEach(shift => {
                const shiftName = Utils.getShiftName(shift);
                const shiftPlans = Storage.getMedicationPlansByDateAndShift(today, shift);
                
                if (shiftPlans.length === 0) return;

                md += `### ${shiftName}\n\n`;
                md += `| 宠物名 | 药品 | 剂量 | 计划时间 | 状态 | 执行人 | 备注 |\n`;
                md += `|--------|------|------|----------|------|--------|------|\n`;

                shiftPlans.forEach(plan => {
                    const records = Storage.getFeedingRecordsByPlanId(plan.id);
                    const latestRecord = records.length > 0 ? records[records.length - 1] : null;
                    
                    const status = latestRecord ? 
                        (latestRecord.status === 'completed' ? '✅ 已喂' : 
                         latestRecord.status === 'missed' ? '❌ 漏喂' : '⏳ 待喂') : 
                        '⏳ 待喂';
                    
                    const administeredBy = latestRecord?.administeredBy || '-';
                    const notes = latestRecord?.notes || plan.instructions || '-';

                    md += `| ${plan.petName} | ${plan.medicationName} | ${plan.dose}${plan.unit} | ${plan.time || '-'} | ${status} | ${administeredBy} | ${notes} |\n`;
                });
                md += `\n`;
            });
        }

        if (opts.includeAlerts) {
            md += `## ⚠️ 异常提醒\n\n`;

            if (alerts.doseWarnings && alerts.doseWarnings.length > 0) {
                md += `### 📏 剂量超重警告\n\n`;
                alerts.doseWarnings.forEach(warning => {
                    md += `- **${warning.petName}** - ${warning.medicationName}\n`;
                    md += `  - 计划剂量: ${warning.plannedDose}${warning.unit}\n`;
                    md += `  - 推荐剂量: ${warning.calculatedDose || warning.maxDose}${warning.unit}\n`;
                    md += `  - 详情: ${warning.message}\n\n`;
                });
            }

            if (alerts.allergyWarnings && alerts.allergyWarnings.length > 0) {
                md += `### 🚨 过敏禁忌警告\n\n`;
                alerts.allergyWarnings.forEach(warning => {
                    md += `- **${warning.petName}** - ${warning.medicationName}\n`;
                    md += `  - 过敏原: ${warning.allergen}\n`;
                    md += `  - 详情: ${warning.message}\n\n`;
                });
            }

            if (alerts.cageConflicts && alerts.cageConflicts.length > 0) {
                md += `### 🐾 同笼冲突警告\n\n`;
                alerts.cageConflicts.forEach(conflict => {
                    const severity = conflict.severity === 'danger' ? '🔴 高风险' : '🟡 警告';
                    md += `- **笼位 ${conflict.cageNumber}** - ${severity}\n`;
                    md += `  - 宠物: ${conflict.petNames || conflict.petIds?.join('、')}\n`;
                    md += `  - 详情: ${conflict.message}\n\n`;
                });
            }

            if (alerts.missedFeedings && alerts.missedFeedings.length > 0) {
                md += `### ⏰ 漏喂提醒\n\n`;
                alerts.missedFeedings.forEach(missed => {
                    const severity = missed.severity === 'danger' ? '🔴 已逾期' : '🟡 可能漏喂';
                    md += `- **${missed.petName}** - ${missed.medicationName}\n`;
                    md += `  - 状态: ${severity}\n`;
                    md += `  - 时间: ${missed.date} ${missed.shiftName} ${missed.time || ''}\n`;
                    md += `  - 剂量: ${missed.dose}${missed.unit}\n`;
                    md += `  - 详情: ${missed.message}\n\n`;
                });
            }

            if (alerts.openObservations && alerts.openObservations.length > 0) {
                md += `### 🔴 异常观察未闭环\n\n`;
                alerts.openObservations.forEach(obs => {
                    const statusText = obs.status === 'in_progress' ? '🔄 处理中' : '⏳ 待处理';
                    md += `- **${obs.petName}** - ${obs.title}\n`;
                    md += `  - 状态: ${statusText}\n`;
                    md += `  - 创建时间: ${obs.createdAt}\n`;
                    md += `  - 描述: ${obs.description}\n\n`;
                });
            }

            const totalAlerts = (alerts.doseWarnings?.length || 0) +
                                (alerts.allergyWarnings?.length || 0) +
                                (alerts.cageConflicts?.length || 0) +
                                (alerts.missedFeedings?.length || 0) +
                                (alerts.openObservations?.length || 0);

            if (totalAlerts === 0) {
                md += `✅ 暂无异常提醒\n\n`;
            }
        }

        if (opts.includeNotes) {
            md += `## 📝 注意事项与交接说明\n\n`;
            md += `### 下一班次注意事项\n\n`;
            md += `- [ ] 检查所有漏喂记录并补喂\n`;
            md += `- [ ] 复核高风险喂药计划\n`;
            md += `- [ ] 跟进未闭环的异常观察\n`;
            md += `- [ ] 确认同笼宠物状态\n\n`;

            md += `### 特殊说明\n\n`;
            
            const pets = Storage.getPets();
            const specialPets = pets.filter(p => p.specialInstructions || (p.allergies && p.allergies.length > 0));
            
            if (specialPets.length > 0) {
                specialPets.forEach(pet => {
                    md += `#### ${pet.petName}\n`;
                    if (pet.allergies && pet.allergies.length > 0) {
                        md += `- ⚠️ 过敏: ${pet.allergies.join('、')}\n`;
                    }
                    if (pet.specialInstructions) {
                        md += `- 📋 特殊说明: ${pet.specialInstructions}\n`;
                    }
                    md += `\n`;
                });
            } else {
                md += `暂无特殊说明的宠物\n\n`;
            }
        }

        md += `---\n\n`;
        md += `*本文档由宠物寄养店喂药与异常交接台系统自动生成*\n`;
        md += `*数据以系统实时记录为准，如有疑问请核对原始记录*\n`;

        return md;
    },

    downloadMarkdown: function(options) {
        const md = this.exportMarkdown(options);
        const filename = `喂药交接单_${Utils.getToday()}.md`;
        Utils.downloadFile(md, filename, 'text/markdown;charset=utf-8');
        Utils.showNotification('Markdown 交接单已下载', 'success');
    },

    exportCSV: function(options) {
        const opts = {
            includeDose: true,
            includeAllergy: true,
            includeCage: true,
            includeMissed: true,
            includeObservations: true,
            ...options
        };

        const alerts = Storage.getAlerts();
        const allRecords = [];

        if (opts.includeDose && alerts.doseWarnings) {
            alerts.doseWarnings.forEach(warning => {
                allRecords.push({
                    '类型': '剂量超重',
                    '严重程度': warning.severity === 'danger' ? '高' : '中',
                    '宠物ID': warning.petId || '',
                    '宠物名': warning.petName || '',
                    '药品名称': warning.medicationName || '',
                    '计划剂量': warning.plannedDose ? `${warning.plannedDose}${warning.unit || ''}` : '',
                    '推荐剂量': (warning.calculatedDose || warning.maxDose) ? `${warning.calculatedDose || warning.maxDose}${warning.unit || ''}` : '',
                    '详情描述': warning.message || '',
                    '发现时间': warning.createdAt || '',
                    '状态': '待处理'
                });
            });
        }

        if (opts.includeAllergy && alerts.allergyWarnings) {
            alerts.allergyWarnings.forEach(warning => {
                allRecords.push({
                    '类型': '过敏禁忌',
                    '严重程度': '高',
                    '宠物ID': warning.petId || '',
                    '宠物名': warning.petName || '',
                    '药品名称': warning.medicationName || '',
                    '过敏原': warning.allergen || '',
                    '详情描述': warning.message || '',
                    '发现时间': warning.createdAt || '',
                    '状态': '待处理'
                });
            });
        }

        if (opts.includeCage && alerts.cageConflicts) {
            alerts.cageConflicts.forEach(conflict => {
                allRecords.push({
                    '类型': '同笼冲突',
                    '严重程度': conflict.severity === 'danger' ? '高' : '中',
                    '笼位编号': conflict.cageNumber || '',
                    '位置': conflict.location || '',
                    '宠物列表': conflict.petNames || (conflict.petIds?.join('、') || ''),
                    '容量': conflict.capacity || '',
                    '实际数量': conflict.actualCount || '',
                    '详情描述': conflict.message || '',
                    '发现时间': conflict.createdAt || '',
                    '状态': '待处理'
                });
            });
        }

        if (opts.includeMissed && alerts.missedFeedings) {
            alerts.missedFeedings.forEach(missed => {
                allRecords.push({
                    '类型': '漏喂提醒',
                    '严重程度': missed.severity === 'danger' ? '高' : '中',
                    '宠物ID': missed.petId || '',
                    '宠物名': missed.petName || '',
                    '药品名称': missed.medicationName || '',
                    '剂量': missed.dose ? `${missed.dose}${missed.unit || ''}` : '',
                    '日期': missed.date || '',
                    '班次': missed.shiftName || '',
                    '时间': missed.time || '',
                    '详情描述': missed.message || '',
                    '发现时间': missed.createdAt || '',
                    '状态': '待处理'
                });
            });
        }

        if (opts.includeObservations && alerts.openObservations) {
            alerts.openObservations.forEach(obs => {
                allRecords.push({
                    '类型': '异常观察',
                    '严重程度': obs.severity === 'danger' ? '高' : (obs.severity === 'warning' ? '中' : '低'),
                    '宠物ID': obs.petId || '',
                    '宠物名': obs.petName || '',
                    '标题': obs.title || '',
                    '描述': obs.description || '',
                    '创建人': obs.createdBy || '',
                    '创建时间': obs.createdAt || '',
                    '状态': obs.status === 'in_progress' ? '处理中' : '待处理'
                });
            });
        }

        if (allRecords.length === 0) {
            return '暂无异常记录';
        }

        const headers = [
            '类型', '严重程度', '宠物ID', '宠物名', '药品名称', 
            '剂量/详情', '日期/班次', '状态', '详情描述', '发现时间'
        ];

        const normalizedRecords = allRecords.map(record => ({
            '类型': record['类型'] || '',
            '严重程度': record['严重程度'] || '',
            '宠物ID': record['宠物ID'] || '',
            '宠物名': record['宠物名'] || '',
            '药品名称': record['药品名称'] || record['笼位编号'] || '',
            '剂量/详情': record['计划剂量'] || record['过敏原'] || record['宠物列表'] || record['标题'] || '',
            '日期/班次': record['日期'] || record['创建时间'] || '',
            '状态': record['状态'] || '',
            '详情描述': record['详情描述'] || record['描述'] || '',
            '发现时间': record['发现时间'] || record['创建时间'] || ''
        }));

        return Utils.toCSV(normalizedRecords, headers);
    },

    downloadCSV: function(options) {
        const csv = this.exportCSV(options);
        if (csv === '暂无异常记录') {
            Utils.showNotification('暂无异常记录可导出', 'info');
            return;
        }
        const filename = `异常清单_${Utils.getToday()}.csv`;
        Utils.downloadFile(csv, filename, 'text/csv;charset=utf-8');
        Utils.showNotification('CSV 异常清单已下载', 'success');
    },

    exportJSON: function(options) {
        const opts = {
            includePets: true,
            includeMedications: true,
            includeFeedings: true,
            includeAlerts: true,
            includeShifts: true,
            ...options
        };

        const auditPackage = {
            'version': '1.0',
            'exportedAt': Utils.formatDateTime(new Date()),
            'exportedBy': 'system',
            'data': {}
        };

        if (opts.includePets) {
            auditPackage.data.pets = Storage.getPets();
        }

        if (opts.includeMedications) {
            auditPackage.data.medications = Storage.getMedications();
            auditPackage.data.medicationPlans = Storage.getMedicationPlans();
        }

        if (opts.includeFeedings) {
            auditPackage.data.feedingRecords = Storage.getFeedingRecords();
        }

        if (opts.includeAlerts) {
            auditPackage.data.alerts = Storage.getAlerts();
            auditPackage.data.observations = Storage.getObservations();
        }

        if (opts.includeShifts) {
            auditPackage.data.shifts = Storage.getShifts();
            auditPackage.data.cages = Storage.getCages();
        }

        auditPackage.data.importHistory = Storage.getImportHistory();

        auditPackage.statistics = this.calculateAuditStatistics(auditPackage.data);

        return JSON.stringify(auditPackage, null, 2);
    },

    calculateAuditStatistics: function(data) {
        const stats = {
            generatedAt: Utils.formatDateTime(new Date()),
            summary: {
                totalPets: data.pets?.length || 0,
                totalMedications: data.medications?.length || 0,
                totalPlans: data.medicationPlans?.length || 0,
                totalRecords: data.feedingRecords?.length || 0,
                totalShifts: data.shifts?.length || 0,
                totalCages: data.cages?.length || 0
            },
            todayStats: {
                date: Utils.getToday()
            },
            alerts: {}
        };

        if (data.medicationPlans) {
            const today = Utils.getToday();
            const todayPlans = data.medicationPlans.filter(p => p.date === today);
            stats.todayStats.plansCount = todayPlans.length;
            
            const shifts = {
                morning: todayPlans.filter(p => p.shift === 'morning').length,
                afternoon: todayPlans.filter(p => p.shift === 'afternoon').length,
                evening: todayPlans.filter(p => p.shift === 'evening').length
            };
            stats.todayStats.shiftBreakdown = shifts;
        }

        if (data.feedingRecords) {
            const today = Utils.getToday();
            const todayRecords = data.feedingRecords.filter(r => r.date === today);
            stats.todayStats.recordsCount = todayRecords.length;
            stats.todayStats.completedCount = todayRecords.filter(r => r.status === 'completed').length;
        }

        if (data.alerts) {
            stats.alerts = {
                doseWarnings: data.alerts.doseWarnings?.length || 0,
                allergyWarnings: data.alerts.allergyWarnings?.length || 0,
                cageConflicts: data.alerts.cageConflicts?.length || 0,
                missedFeedings: data.alerts.missedFeedings?.length || 0,
                openObservations: data.alerts.openObservations?.length || 0
            };
            stats.alerts.total = Object.values(stats.alerts).reduce((a, b) => a + b, 0);
        }

        if (data.observations) {
            stats.observations = {
                total: data.observations.length,
                open: data.observations.filter(o => o.status === 'open').length,
                inProgress: data.observations.filter(o => o.status === 'in_progress').length,
                closed: data.observations.filter(o => o.status === 'closed').length
            };
        }

        return stats;
    },

    downloadJSON: function(options) {
        const json = this.exportJSON(options);
        const filename = `审计包_${Utils.getToday()}.json`;
        Utils.downloadFile(json, filename, 'application/json;charset=utf-8');
        Utils.showNotification('JSON 审计包已下载', 'success');
    },

    exportFeedingRecordsByShift: function(date, shift) {
        const plans = Storage.getMedicationPlansByDateAndShift(date, shift);
        const records = Storage.getFeedingRecordsByDateAndShift(date, shift);
        
        const recordMap = {};
        records.forEach(record => {
            if (record.planId) {
                recordMap[record.planId] = record;
            }
        });

        const exportData = plans.map(plan => {
            const record = recordMap[plan.id];
            return {
                '日期': date,
                '班次': Utils.getShiftName(shift),
                '宠物ID': plan.petId,
                '宠物名': plan.petName,
                '药品名称': plan.medicationName,
                '计划剂量': `${plan.dose}${plan.unit}`,
                '计划时间': plan.time || '-',
                '实际剂量': record?.actualDose ? `${record.actualDose}${plan.unit}` : '-',
                '状态': record?.status ? Utils.getStatusName(record.status) : '待喂',
                '执行人': record?.administeredBy || '-',
                '执行时间': record?.administeredAt || '-',
                '备注': record?.notes || plan.instructions || '-'
            };
        });

        if (exportData.length === 0) {
            return null;
        }

        return Utils.toCSV(exportData);
    },

    exportAllPets: function() {
        const pets = Storage.getPets();
        
        const exportData = pets.map(pet => ({
            '宠物ID': pet.petId,
            '宠物名': pet.petName,
            '主人姓名': pet.ownerName || '-',
            '联系电话': pet.ownerPhone || '-',
            '物种': pet.species || '-',
            '品种': pet.breed || '-',
            '性别': pet.gender || '-',
            '体重(kg)': pet.weight || '-',
            '过敏原': (pet.allergies || []).join('、') || '-',
            '入住日期': pet.checkInDate || '-',
            '离开日期': pet.checkOutDate || '-',
            '笼位号': pet.cageNumber || '-',
            '特殊说明': pet.specialInstructions || '-',
            '状态': pet.status || 'active',
            '创建时间': pet.createdAt || '-',
            '更新时间': pet.updatedAt || '-'
        }));

        if (exportData.length === 0) {
            return null;
        }

        return Utils.toCSV(exportData);
    },

    generateSampleImportData: function(type) {
        return DataImport.exportSampleData(type);
    },

    getDataSummary: function() {
        const stats = Storage.getStatistics();
        const alerts = Storage.getAlerts();
        
        return {
            pets: {
                count: stats.petsCount,
                label: '在院宠物'
            },
            medications: {
                count: stats.medicationsCount,
                label: '药品种类'
            },
            plans: {
                count: stats.plansCount,
                label: '喂药计划'
            },
            records: {
                count: stats.recordsCount,
                label: '喂药记录'
            },
            today: {
                plans: stats.todayPlansCount,
                completed: stats.completedToday,
                pending: stats.pendingToday
            },
            alerts: {
                total: stats.totalWarnings,
                dose: stats.doseWarnings,
                allergy: stats.allergyWarnings,
                cage: stats.cageConflicts,
                missed: stats.missedFeedings,
                openObservations: stats.openObservations
            }
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataExport;
}
