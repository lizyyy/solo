// 导出模块
// 负责导出Markdown练习建议、CSV问题清单和JSON审计包

const Export = (function() {
    // 下载文件
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 生成Markdown练习建议
    function generateMarkdownReport() {
        const issues = Storage.loadIssues() || [];
        const reviews = Storage.loadReviews() || {};
        const lastAnalysis = Storage.loadLastAnalysisTime();
        
        if (issues.length === 0) {
            return { success: false, error: '没有分析数据可导出' };
        }

        // 统计信息
        const stats = {
            total: issues.length,
            pitch: issues.filter(i => i.type === 'pitch').length,
            rhythm: issues.filter(i => i.type === 'rhythm').length,
            balance: issues.filter(i => i.type === 'balance').length,
            repeat: issues.filter(i => i.type === 'repeat').length,
            confirmed: issues.filter(i => reviews[i.id]?.status === 'confirmed').length,
            pending: issues.filter(i => !reviews[i.id] || reviews[i.id].status === 'pending').length
        };

        // 按声部和问题类型分组
        const groupedByVoice = {};
        for (const issue of issues) {
            const voice = issue.voice || '未知声部';
            if (!groupedByVoice[voice]) {
                groupedByVoice[voice] = {
                    issues: [],
                    stats: { total: 0, pitch: 0, rhythm: 0, balance: 0, repeat: 0 }
                };
            }
            groupedByVoice[voice].issues.push(issue);
            groupedByVoice[voice].stats.total++;
            groupedByVoice[voice].stats[issue.type]++;
        }

        // 构建Markdown内容
        let md = '# 合唱团排练复盘报告\n\n';
        
        // 报告信息
        md += `## 报告概览\n\n`;
        md += `- **分析时间**: ${lastAnalysis ? new Date(lastAnalysis).toLocaleString('zh-CN') : '未知'}\n`;
        md += `- **总问题数**: ${stats.total}\n`;
        md += `- **跑调问题**: ${stats.pitch}\n`;
        md += `- **节奏问题**: ${stats.rhythm}\n`;
        md += `- **声部不均衡**: ${stats.balance}\n`;
        md += `- **反复出错小节**: ${stats.repeat}\n`;
        md += `- **已确认问题**: ${stats.confirmed}\n`;
        md += `- **待复核问题**: ${stats.pending}\n\n`;

        // 按声部分类的练习建议
        md += `## 各声部练习建议\n\n`;
        
        for (const voice in groupedByVoice) {
            const voiceData = groupedByVoice[voice];
            
            md += `### ${voice}\n\n`;
            md += `**问题统计**: 共${voiceData.stats.total}个问题 `;
            if (voiceData.stats.pitch > 0) md += `(跑调${voiceData.stats.pitch}) `;
            if (voiceData.stats.rhythm > 0) md += `(节奏${voiceData.stats.rhythm}) `;
            if (voiceData.stats.balance > 0) md += `(不均衡${voiceData.stats.balance}) `;
            if (voiceData.stats.repeat > 0) md += `(反复${voiceData.stats.repeat})`;
            md += `\n\n`;

            // 按问题类型分组显示
            const typeGroups = {
                pitch: { name: '跑调问题', issues: [] },
                rhythm: { name: '节奏问题', issues: [] },
                balance: { name: '声部不均衡', issues: [] },
                repeat: { name: '反复出错', issues: [] }
            };

            for (const issue of voiceData.issues) {
                if (typeGroups[issue.type]) {
                    typeGroups[issue.type].issues.push(issue);
                }
            }

            for (const type in typeGroups) {
                const group = typeGroups[type];
                if (group.issues.length === 0) continue;

                md += `#### ${group.name}\n\n`;
                
                for (const issue of group.issues) {
                    const review = reviews[issue.id];
                    const statusText = review ? 
                        (review.status === 'confirmed' ? '✅ 已确认' : 
                         review.status === 'dismissed' ? '❌ 已忽略' : '⏳ 待复核') : '⏳ 待复核';
                    
                    md += `- **${issue.measure}**: ${issue.description}`;
                    md += ` [${issue.severity}] ${statusText}\n`;
                    
                    if (review && review.comments) {
                        md += `  > 老师批注: ${review.comments}\n`;
                    }
                }
                md += `\n`;
            }

            // 练习建议
            md += `#### 练习建议\n\n`;
            
            if (voiceData.stats.pitch > 0) {
                md += `- **音准练习**: 建议使用钢琴或音准APP辅助练习问题小节，注意听辨音高差异。\n`;
            }
            if (voiceData.stats.rhythm > 0) {
                md += `- **节奏练习**: 使用节拍器，从慢速开始练习，注意小节之间的衔接。\n`;
            }
            if (voiceData.stats.balance > 0) {
                md += `- **声部平衡**: 注意与其他声部的音量协调，多听整体效果。\n`;
            }
            if (voiceData.stats.repeat > 0) {
                md += `- **重点练习**: 反复出错的小节需要单独抽出来重点练习，建议分段突破。\n`;
            }
            md += `\n`;
        }

        // 总体建议
        md += `## 总体建议\n\n`;
        md += `1. **分声部练习**: 建议各声部先单独练习问题小节，再合练。\n`;
        md += `2. **慢练突破**: 对于难度较大的段落，建议从慢速开始，逐步提速。\n`;
        md += `3. **录音对比**: 建议每次排练后录音，与目标版本对比分析。\n`;
        md += `4. **重点标记**: 将反复出错的小节标记为重点，每次排练前先过一遍。\n\n`;

        // 页脚
        md += `---\n`;
        md += `*本报告由音准复盘工具自动生成*\n`;

        return {
            success: true,
            content: md,
            stats: stats
        };
    }

    // 导出Markdown练习建议
    function exportMarkdown() {
        const result = generateMarkdownReport();
        if (!result.success) {
            return result;
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `排练复盘报告_${timestamp}.md`;
        
        downloadFile(result.content, filename, 'text/markdown;charset=utf-8');
        
        return {
            success: true,
            filename: filename,
            stats: result.stats
        };
    }

    // 生成CSV问题清单
    function generateCSVReport() {
        const issues = Storage.loadIssues() || [];
        const reviews = Storage.loadReviews() || {};
        
        if (issues.length === 0) {
            return { success: false, error: '没有分析数据可导出' };
        }

        // CSV表头
        const headers = [
            '问题ID',
            '问题类型',
            '声部',
            '小节',
            '时间(秒)',
            '严重程度',
            '描述',
            '详细信息',
            '复核状态',
            '老师批注',
            '创建时间'
        ];

        // 构建CSV行
        const rows = [headers];
        
        for (const issue of issues) {
            const review = reviews[issue.id];
            const row = [
                issue.id,
                issue.typeName,
                issue.voice,
                issue.measure,
                issue.time.toFixed(2),
                issue.severity,
                issue.description,
                JSON.stringify(issue.details),
                review ? (review.status === 'confirmed' ? '已确认' : 
                          review.status === 'dismissed' ? '已忽略' : '待复核') : '待复核',
                review?.comments || '',
                issue.createdAt
            ];
            
            // 转义CSV特殊字符
            const escapedRow = row.map(cell => {
                if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            });
            
            rows.push(escapedRow);
        }

        // 转换为CSV字符串
        const csvContent = rows.map(row => row.join(',')).join('\n');

        return {
            success: true,
            content: '\uFEFF' + csvContent, // 添加BOM以支持中文
            count: issues.length
        };
    }

    // 导出CSV问题清单
    function exportCSV() {
        const result = generateCSVReport();
        if (!result.success) {
            return result;
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `问题清单_${timestamp}.csv`;
        
        downloadFile(result.content, filename, 'text/csv;charset=utf-8');
        
        return {
            success: true,
            filename: filename,
            count: result.count
        };
    }

    // 生成JSON审计包
    function generateJSONAudit() {
        const rehearsalData = Storage.loadRehearsalData();
        const targetData = Storage.loadTargetData();
        const issues = Storage.loadIssues() || [];
        const reviews = Storage.loadReviews() || {};
        const lastAnalysis = Storage.loadLastAnalysisTime();
        
        const auditPackage = {
            metadata: {
                version: '1.0',
                generatedAt: new Date().toISOString(),
                lastAnalysis: lastAnalysis
            },
            summary: {
                totalIssues: issues.length,
                issueTypes: {
                    pitch: issues.filter(i => i.type === 'pitch').length,
                    rhythm: issues.filter(i => i.type === 'rhythm').length,
                    balance: issues.filter(i => i.type === 'balance').length,
                    repeat: issues.filter(i => i.type === 'repeat').length
                },
                reviewStatus: {
                    pending: issues.filter(i => !reviews[i.id] || reviews[i.id].status === 'pending').length,
                    confirmed: issues.filter(i => reviews[i.id]?.status === 'confirmed').length,
                    dismissed: issues.filter(i => reviews[i.id]?.status === 'dismissed').length
                }
            },
            issues: issues.map(issue => ({
                ...issue,
                review: reviews[issue.id] || null
            })),
            dataSource: {
                rehearsalDataCount: rehearsalData?.length || 0,
                targetDataCount: targetData?.length || 0,
                rehearsalVoices: rehearsalData ? [...new Set(rehearsalData.map(d => d.voice))] : [],
                targetVoices: targetData ? [...new Set(targetData.map(d => d.voice))] : []
            }
        };

        return {
            success: true,
            content: JSON.stringify(auditPackage, null, 2),
            summary: auditPackage.summary
        };
    }

    // 导出JSON审计包
    function exportJSON() {
        const result = generateJSONAudit();
        if (!result.success) {
            return result;
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `审计包_${timestamp}.json`;
        
        downloadFile(result.content, filename, 'application/json;charset=utf-8');
        
        return {
            success: true,
            filename: filename,
            summary: result.summary
        };
    }

    return {
        // 导出方法
        exportMarkdown,
        exportCSV,
        exportJSON,
        
        // 生成方法（用于预览）
        generateMarkdownReport,
        generateCSVReport,
        generateJSONAudit,
        
        // 工具方法
        downloadFile
    };
})();

// 导出Export对象（在浏览器环境中直接可用）
if (typeof window !== 'undefined') {
    window.Export = Export;
}
