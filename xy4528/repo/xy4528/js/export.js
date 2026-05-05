/**
 * 数据导出模块
 * 用于导出Markdown复盘单和JSON明细
 */

const Export = {
    // 生成Markdown复盘单
    generateMarkdown: function(analysisResult) {
        const { scoreLogs, roundSchedule, videoTimestamps, refereeNotes, 
                anomalies, manualNotes, summary } = analysisResult;
        
        let markdown = '# 击剑比赛复盘报告\n\n';
        
        // 基本信息
        markdown += '## 基本信息\n\n';
        markdown += `- **生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
        markdown += `- **总剑数**: ${summary.totalBouts}\n`;
        markdown += `- **异常数量**: ${summary.totalAnomalies}\n`;
        markdown += `- **选手数量**: ${summary.totalFencers}\n`;
        markdown += `- **场地数量**: ${summary.totalPistes}\n\n`;
        
        // 异常统计
        markdown += '## 异常统计\n\n';
        markdown += '| 异常类型 | 数量 |\n';
        markdown += '|---------|------|\n';
        markdown += `| 疑似漏记 | ${summary.anomalyBreakdown.missed} |\n`;
        markdown += `| 双灯争议 | ${summary.anomalyBreakdown.doubleLight} |\n`;
        markdown += `| 暂停后比分错位 | ${summary.anomalyBreakdown.scoreMismatch} |\n`;
        markdown += `| 选手轮空异常 | ${summary.anomalyBreakdown.byeAnomaly} |\n\n`;
        
        // 异常详情
        if (anomalies.length > 0) {
            markdown += '## 异常详情\n\n';
            
            const anomalyByType = {};
            anomalies.forEach(anomaly => {
                if (!anomalyByType[anomaly.type]) {
                    anomalyByType[anomaly.type] = [];
                }
                anomalyByType[anomaly.type].push(anomaly);
            });
            
            const typeNames = {
                'missed': '疑似漏记',
                'double-light': '双灯争议',
                'score-mismatch': '暂停后比分错位',
                'bye-anomaly': '选手轮空异常'
            };
            
            Object.keys(anomalyByType).forEach(type => {
                const typeAnomalies = anomalyByType[type];
                markdown += `### ${typeNames[type] || type} (${typeAnomalies.length}条)\n\n`;
                
                typeAnomalies.forEach((anomaly, index) => {
                    markdown += `#### 异常 ${index + 1}\n\n`;
                    markdown += `- **描述**: ${anomaly.description}\n`;
                    markdown += `- **严重程度**: ${anomaly.severity}\n`;
                    markdown += `- **场地**: ${anomaly.piste || '未知'}\n`;
                    markdown += `- **选手**: ${anomaly.fencers ? anomaly.fencers.join(', ') : '无'}\n`;
                    markdown += `- **关联剑次**: ${anomaly.relatedBouts ? anomaly.relatedBouts.join(', ') : '无'}\n`;
                    markdown += `- **时间**: ${anomaly.timestamp || '未知'}\n`;
                    
                    if (anomaly.details) {
                        markdown += '\n**详细信息**:\n```\n';
                        markdown += JSON.stringify(anomaly.details, null, 2);
                        markdown += '\n```\n';
                    }
                    
                    // 检查是否有改判备注
                    if (anomaly.relatedBouts) {
                        anomaly.relatedBouts.forEach(boutId => {
                            const note = manualNotes.find(n => n.boutId === boutId);
                            if (note) {
                                markdown += `\n**改判备注**:\n`;
                                markdown += `- **改判类型**: ${note.reversalType || '无'}\n`;
                                markdown += `- **改判理由**: ${note.reversalReason || '无'}\n`;
                                markdown += `- **备注时间**: ${new Date(note.timestamp).toLocaleString('zh-CN')}\n`;
                            }
                        });
                    }
                    
                    markdown += '\n---\n\n';
                });
            });
        }
        
        // 人工改判备注
        if (manualNotes.length > 0) {
            markdown += '## 人工改判备注\n\n';
            
            manualNotes.forEach((note, index) => {
                markdown += `### 备注 ${index + 1}\n\n`;
                markdown += `- **关联剑次**: ${note.boutId}\n`;
                markdown += `- **改判类型**: ${note.reversalType || '无'}\n`;
                markdown += `- **改判理由**: ${note.reversalReason || '无'}\n`;
                markdown += `- **备注时间**: ${new Date(note.timestamp).toLocaleString('zh-CN')}\n\n`;
            });
        }
        
        // 比赛概况
        markdown += '## 比赛概况\n\n';
        
        // 按场地分组的比赛
        const byPiste = {};
        scoreLogs.forEach(bout => {
            if (!byPiste[bout.piste]) {
                byPiste[bout.piste] = [];
            }
            byPiste[bout.piste].push(bout);
        });
        
        Object.keys(byPiste).forEach(piste => {
            const pistesBouts = byPiste[piste];
            
            // 获取该场地的选手
            const fencers = new Set();
            pistesBouts.forEach(bout => {
                fencers.add(bout.fencer1);
                fencers.add(bout.fencer2);
            });
            
            markdown += `### ${piste}\n\n`;
            markdown += `- **选手**: ${Array.from(fencers).join(' vs ')}\n`;
            markdown += `- **剑数**: ${pistesBouts.length}\n`;
            
            // 统计最终比分
            if (pistesBouts.length > 0) {
                const lastBout = pistesBouts[pistesBouts.length - 1];
                markdown += `- **最终比分**: ${lastBout.fencer1} ${lastBout.score1} - ${lastBout.score2} ${lastBout.fencer2}\n`;
            }
            
            markdown += '\n';
        });
        
        // 轮次表
        if (roundSchedule.length > 0) {
            markdown += '## 轮次安排\n\n';
            markdown += '| 轮次 | 场地 | 选手1 | 选手2 | 开始时间 | 结束时间 | 状态 |\n';
            markdown += '|------|------|-------|-------|---------|---------|------|\n';
            
            roundSchedule.forEach(round => {
                const fencer2 = round.isBye ? '(轮空)' : (round.fencer2 || '-');
                markdown += `| ${round.roundNumber} | ${round.piste} | ${round.fencer1 || '-'} | ${fencer2} | ${round.startTime || '-'} | ${round.endTime || '-'} | ${round.status || '-'} |\n`;
            });
            
            markdown += '\n';
        }
        
        // 视频关键帧
        if (videoTimestamps.length > 0) {
            markdown += '## 视频关键帧\n\n';
            markdown += '| 时间码ID | 关联剑次 | 视频时间 | 实际时间 | 描述 | 关键时刻 |\n';
            markdown += '|---------|---------|---------|---------|------|---------|\n';
            
            videoTimestamps.forEach(ts => {
                markdown += `| ${ts.timestampId} | ${ts.boutId || '-'} | ${ts.videoTime || '-'} | ${ts.realTime || '-'} | ${ts.description || '-'} | ${ts.isKeyMoment ? '是' : '否'} |\n`;
            });
            
            markdown += '\n';
        }
        
        // 裁判备注
        if (refereeNotes.length > 0) {
            markdown += '## 裁判备注\n\n';
            markdown += '| 备注ID | 关联剑次 | 时间 | 裁判 | 类型 | 内容 | 改判 |\n';
            markdown += '|-------|---------|------|------|------|------|------|\n';
            
            refereeNotes.forEach(note => {
                markdown += `| ${note.noteId} | ${note.boutId || '-'} | ${note.timestamp || '-'} | ${note.referee || '-'} | ${note.noteType || '-'} | ${note.content || '-'} | ${note.isReversal ? '是' : '否'} |\n`;
            });
            
            markdown += '\n';
        }
        
        return markdown;
    },
    
    // 生成JSON明细
    generateJSON: function(analysisResult) {
        return JSON.stringify(analysisResult, null, 2);
    },
    
    // 生成CSV异常报告
    generateCSV: function(anomalies, manualNotes) {
        if (anomalies.length === 0) {
            return '';
        }
        
        let csv = '异常ID,类型,描述,严重程度,场地,选手,关联剑次,时间,改判类型,改判理由\n';
        
        anomalies.forEach(anomaly => {
            // 查找改判备注
            let reversalType = '';
            let reversalReason = '';
            
            if (anomaly.relatedBouts) {
                anomaly.relatedBouts.forEach(boutId => {
                    const note = manualNotes.find(n => n.boutId === boutId);
                    if (note) {
                        reversalType = note.reversalType || '';
                        reversalReason = note.reversalReason || '';
                    }
                });
            }
            
            csv += `${anomaly.anomalyId},`;
            csv += `"${anomaly.typeName}",`;
            csv += `"${anomaly.description}",`;
            csv += `${anomaly.severity},`;
            csv += `"${anomaly.piste || ''}",`;
            csv += `"${anomaly.fencers ? anomaly.fencers.join('; ') : ''}",`;
            csv += `"${anomaly.relatedBouts ? anomaly.relatedBouts.join('; ') : ''}",`;
            csv += `"${anomaly.timestamp || ''}",`;
            csv += `"${reversalType}",`;
            csv += `"${reversalReason}"`;
            csv += '\n';
        });
        
        return csv;
    },
    
    // 下载文件
    downloadFile: function(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    // 导出Markdown
    exportMarkdown: function(analysisResult) {
        const markdown = this.generateMarkdown(analysisResult);
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `击剑比赛复盘报告_${timestamp}.md`;
        
        this.downloadFile(markdown, filename, 'text/markdown');
        return markdown;
    },
    
    // 导出JSON
    exportJSON: function(analysisResult) {
        const json = this.generateJSON(analysisResult);
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `击剑比赛数据_${timestamp}.json`;
        
        this.downloadFile(json, filename, 'application/json');
        return json;
    },
    
    // 导出CSV
    exportCSV: function(anomalies, manualNotes) {
        const csv = this.generateCSV(anomalies, manualNotes);
        if (!csv) return null;
        
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `击剑比赛异常报告_${timestamp}.csv`;
        
        this.downloadFile(csv, filename, 'text/csv');
        return csv;
    },
    
    // 预览导出内容
    previewExport: function(type, analysisResult) {
        switch (type) {
            case 'markdown':
                return this.generateMarkdown(analysisResult);
            case 'json':
                return this.generateJSON(analysisResult);
            case 'csv':
                return this.generateCSV(analysisResult.anomalies, analysisResult.manualNotes);
            default:
                return '';
        }
    }
};

// 导出模块（用于Node.js环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Export;
}
