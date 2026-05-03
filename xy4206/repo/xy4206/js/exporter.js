class Exporter {
    constructor() {
        this.parser = new Parser();
    }

    exportMarkdown(score, performance, alignment, analysis) {
        const scorer = new Scorer();
        const grade = scorer.getScoreGrade(analysis.totalScore);

        let md = `# 钢琴练习讲评\n\n`;
        md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

        md += `## 基本信息\n\n`;
        md += `- **曲目**: ${score.title || '未命名'}\n`;
        md += `- **作曲家**: ${score.composer || '未知'}\n`;
        md += `- **拍号**: ${score.timeSignature || '4/4'}\n`;
        md += `- **速度**: ${score.tempo || 120} BPM\n\n`;

        md += `## 总体评分\n\n`;
        md += `- **总分**: ${analysis.totalScore.toFixed(1)} / 100 (${grade.label})\n`;
        md += `- **等级**: ${grade.grade}\n\n`;

        md += `## 错误统计\n\n`;
        md += `| 类型 | 数量 | 说明 |\n`;
        md += `|------|------|------|\n`;
        md += `| 总音符数 | ${analysis.summary.totalNotes} | - |\n`;
        md += `| 正确演奏 | ${analysis.summary.correctNotes} | ✅ |\n`;
        md += `| 漏音 | ${analysis.summary.missedNotes} | ❌ 未按下的音符 |\n`;
        md += `| 错音 | ${analysis.summary.wrongNotes} | ❌ 按下错误的音符 |\n`;
        md += `| 节奏问题 | ${analysis.summary.timingIssues} | ⚠️ 提前/滞后 |\n`;
        md += `| 力度问题 | ${analysis.summary.velocityIssues} | ⚠️ 力度偏差 |\n`;
        md += `| 时值问题 | ${analysis.summary.durationIssues} | ⚠️ 时值太短/太长 |\n`;
        md += `| 连音断裂 | ${analysis.summary.slurBreaks} | ⚠️ 连音线中断 |\n\n`;

        if (analysis.timingStatistics.count > 0) {
            md += `## 节奏统计\n\n`;
            md += `- **平均偏差**: ${(analysis.timingStatistics.avg * 1000).toFixed(1)}ms\n`;
            md += `- **最大提前**: ${(Math.min(0, analysis.timingStatistics.min) * 1000).toFixed(1)}ms\n`;
            md += `- **最大滞后**: ${(Math.max(0, analysis.timingStatistics.max) * 1000).toFixed(1)}ms\n\n`;
        }

        const groupedErrors = this.groupErrorsByMeasure(analysis.errors);
        
        if (Object.keys(groupedErrors).length > 0) {
            md += `## 详细错误\n\n`;
            
            Object.keys(groupedErrors).sort((a, b) => parseInt(a) - parseInt(b)).forEach(measureNumber => {
                const errors = groupedErrors[measureNumber];
                md += `### 第 ${measureNumber} 小节\n\n`;
                
                errors.forEach((error, idx) => {
                    md += `${idx + 1}. **${this.getErrorTypeName(error.type)}**: ${error.message}\n`;
                    if (error.details) {
                        if (error.details.deviationMs) {
                            md += `   - 偏差: ${error.details.deviationMs}ms (${error.details.direction})\n`;
                        }
                        if (error.details.expectedTime !== undefined && error.details.actualTime !== undefined) {
                            md += `   - 期望时间: ${error.details.expectedTime.toFixed(2)}s, 实际时间: ${error.details.actualTime.toFixed(2)}s\n`;
                        }
                        if (error.details.expectedVelocity !== undefined) {
                            md += `   - 期望力度: ${error.details.expectedVelocity}, 实际力度: ${error.details.actualVelocity}\n`;
                        }
                        if (error.details.expectedDuration !== undefined) {
                            md += `   - 期望时值: ${error.details.expectedDuration.toFixed(2)}s, 实际时值: ${error.details.actualDuration.toFixed(2)}s\n`;
                        }
                        if (error.details.gapDuration !== undefined) {
                            md += `   - 断裂间隔: ${(error.details.gapDuration * 1000).toFixed(0)}ms\n`;
                        }
                    }
                    md += `   - 严重程度: ${this.getSeverityLabel(error.severity)}\n`;
                    md += `   - 扣分: ${error.penalty}分\n\n`;
                });
            });
        }

        md += `## 建议\n\n`;
        const suggestions = this.generateSuggestions(analysis);
        suggestions.forEach((suggestion, idx) => {
            md += `${idx + 1}. ${suggestion}\n`;
        });
        md += `\n`;

        md += `---\n`;
        md += `*由错音回放谱架生成 | ${new Date().toLocaleDateString('zh-CN')}*\n`;

        return md;
    }

    exportCSV(analysis) {
        const headers = [
            '小节',
            '错误类型',
            '音高',
            '音符名称',
            '严重程度',
            '消息',
            '扣分',
            '期望时间',
            '实际时间',
            '偏差(ms)',
            '期望力度',
            '实际力度',
            '期望时值(s)',
            '实际时值(s)'
        ];

        const rows = [headers.join(',')];

        analysis.errors.forEach(error => {
            const row = [];
            row.push(error.measure || '');
            row.push(this.getErrorTypeName(error.type));
            
            if (error.note) {
                row.push(error.note.pitch || '');
                row.push(error.note.noteName || '');
            } else if (error.performance) {
                row.push(error.performance.pitch || '');
                row.push(error.performance.noteName || '');
            } else {
                row.push('');
                row.push('');
            }
            
            row.push(this.getSeverityLabel(error.severity));
            row.push(`"${error.message}"`);
            row.push(error.penalty || 0);
            
            if (error.details) {
                row.push(error.details.expectedTime !== undefined ? error.details.expectedTime.toFixed(3) : '');
                row.push(error.details.actualTime !== undefined ? error.details.actualTime.toFixed(3) : '');
                row.push(error.details.deviationMs || '');
                row.push(error.details.expectedVelocity || '');
                row.push(error.details.actualVelocity || '');
                row.push(error.details.expectedDuration !== undefined ? error.details.expectedDuration.toFixed(3) : '');
                row.push(error.details.actualDuration !== undefined ? error.details.actualDuration.toFixed(3) : '');
            } else {
                row.push('', '', '', '', '', '', '');
            }

            rows.push(row.join(','));
        });

        return rows.join('\n');
    }

    exportJSON(score, performance, alignment, analysis) {
        const exportData = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            score: {
                title: score.title,
                composer: score.composer,
                timeSignature: score.timeSignature,
                tempo: score.tempo,
                measures: score.measures
            },
            performance: {
                notes: performance.notes,
                pedalEvents: performance.pedalEvents
            },
            alignment: alignment,
            analysis: analysis
        };

        return JSON.stringify(exportData, null, 2);
    }

    download(data, filename, mimeType) {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    downloadMarkdown(score, performance, alignment, analysis) {
        const md = this.exportMarkdown(score, performance, alignment, analysis);
        const filename = `讲评_${score.title || '练习'}_${this.getDateString()}.md`;
        this.download(md, filename, 'text/markdown');
    }

    downloadCSV(analysis) {
        const csv = this.exportCSV(analysis);
        const filename = `错误明细_${this.getDateString()}.csv`;
        this.download(csv, filename, 'text/csv');
    }

    downloadJSON(score, performance, alignment, analysis) {
        const json = this.exportJSON(score, performance, alignment, analysis);
        const filename = `审计包_${score.title || '练习'}_${this.getDateString()}.json`;
        this.download(json, filename, 'application/json');
    }

    groupErrorsByMeasure(errors) {
        const groups = {};
        errors.forEach(error => {
            const measure = error.measure || '其他';
            if (!groups[measure]) {
                groups[measure] = [];
            }
            groups[measure].push(error);
        });
        return groups;
    }

    getErrorTypeName(type) {
        const types = {
            missed: '漏音',
            wrong_pitch: '错音',
            timing: '节奏问题',
            velocity: '力度问题',
            duration: '时值问题',
            slur_break: '连音断裂',
            slur_missed_note: '连音缺音'
        };
        return types[type] || type;
    }

    getSeverityLabel(severity) {
        const labels = {
            high: '严重',
            medium: '中等',
            low: '轻微'
        };
        return labels[severity] || '未知';
    }

    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    }

    generateSuggestions(analysis) {
        const suggestions = [];

        if (analysis.summary.missedNotes > 0) {
            suggestions.push(`存在 ${analysis.summary.missedNotes} 处漏音，请特别注意这些音符的位置和指法，建议慢速分手练习。`);
        }

        if (analysis.summary.wrongNotes > 0) {
            suggestions.push(`存在 ${analysis.summary.wrongNotes} 处错音，请核对乐谱，确认音高和指法是否正确。`);
        }

        if (analysis.summary.timingIssues > 0) {
            const avgDeviation = Math.abs(analysis.timingStatistics.avg || 0) * 1000;
            if (avgDeviation > 100) {
                suggestions.push(`节奏偏差较大（平均 ${avgDeviation.toFixed(0)}ms），建议使用节拍器练习，从较慢速度开始。`);
            } else {
                suggestions.push(`存在节奏问题，建议重点练习有问题的小节，注意数拍。`);
            }
        }

        if (analysis.summary.slurBreaks > 0) {
            suggestions.push(`存在 ${analysis.summary.slurBreaks} 处连音断裂，请注意连音线的演奏方法，保持音符之间的连贯性。`);
        }

        if (analysis.summary.velocityIssues > 0) {
            suggestions.push(`存在力度控制问题，注意乐谱上的力度标记（如 f, p, mf 等）。`);
        }

        if (analysis.summary.durationIssues > 0) {
            suggestions.push(`存在时值问题，注意音符的实际持续时间，特别是附点音符和延音线。`);
        }

        if (suggestions.length === 0) {
            suggestions.push(`演奏表现良好！建议保持练习，可以尝试加快速度或增加音乐表现力。`);
        }

        return suggestions;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Exporter;
}
