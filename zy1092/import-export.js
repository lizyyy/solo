/**
 * CueDesk 导入导出模块
 * 负责从各种格式导入流程，以及导出各种格式的文件
 */

/**
 * 导入导出管理器类
 */
class ImportExportManager {
    /**
     * 从 JSON 格式解析流程数据
     * @param {string} jsonString - JSON 字符串
     * @returns {Array<Object>} 流程数据列表
     */
    parseJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (Array.isArray(data)) {
                return data.map(item => this.normalizeCueData(item));
            }
            
            if (data.cues && Array.isArray(data.cues)) {
                return data.cues.map(item => this.normalizeCueData(item));
            }
            
            return [this.normalizeCueData(data)];
        } catch (error) {
            throw new Error(`JSON 解析错误: ${error.message}`);
        }
    }

    /**
     * 从 CSV 格式解析流程数据
     * @param {string} csvString - CSV 字符串
     * @returns {Array<Object>} 流程数据列表
     */
    parseCsv(csvString) {
        const lines = csvString.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV 文件格式错误：至少需要包含表头和一行数据');
        }

        const headers = this.parseCsvLine(lines[0]);
        const cues = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCsvLine(lines[i]);
            if (values.length === 0) continue;

            const cue = {};
            headers.forEach((header, index) => {
                const value = values[index] || '';
                this.setCueProperty(cue, header.trim(), value);
            });
            cues.push(this.normalizeCueData(cue));
        }

        return cues;
    }

    /**
     * 解析 CSV 行，处理引号内的逗号
     * @param {string} line - CSV 行字符串
     * @returns {Array<string>} 字段值列表
     */
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * 设置流程属性
     * @param {Object} cue - 流程对象
     * @param {string} header - 表头名称
     * @param {string} value - 字段值
     */
    setCueProperty(cue, header, value) {
        const headerLower = header.toLowerCase();
        
        switch (headerLower) {
            case 'name':
            case '流程名称':
            case '名称':
                cue.name = value;
                break;
            case 'order':
            case '顺序':
                cue.order = parseInt(value) || 0;
                break;
            case 'status':
            case '状态':
                cue.status = this.parseStatus(value);
                break;
            case 'responsible':
            case '负责人':
                cue.responsible = value;
                break;
            case 'duration':
            case '预估时长':
            case '时长':
                cue.duration = parseFloat(value) || 0;
                break;
            case 'starttime':
            case 'start_time':
            case '开始时间':
                cue.startTime = value;
                break;
            case 'microphones':
            case '麦克风':
                cue.microphones = value.split(/[,，]/).map(m => m.trim()).filter(m => m);
                break;
            case 'audiopath':
            case 'audio_path':
            case '音频路径':
            case '音频文件':
                cue.audioPath = value;
                break;
            case 'script':
            case '口播卡':
            case '口播词':
                cue.script = value;
                break;
            case 'notes':
            case '备注':
            case '现场备注':
                cue.notes = value;
                break;
            default:
                if (!cue[headerLower]) {
                    cue[headerLower] = value;
                }
        }
    }

    /**
     * 解析状态值
     * @param {string} value - 状态字符串
     * @returns {string} 标准化的状态值
     */
    parseStatus(value) {
        if (!value) return CUE_STATUSES.PENDING;
        
        const valueLower = value.toLowerCase();
        
        switch (valueLower) {
            case 'pending':
            case '待确认':
            case '待彩排':
                return CUE_STATUSES.PENDING;
            case 'rehearsed':
            case '已彩排':
            case '已确认':
                return CUE_STATUSES.REHEARSED;
            case 'changed':
            case '现场变更':
            case '已变更':
                return CUE_STATUSES.CHANGED;
            case 'completed':
            case '已完成':
            case '完成':
                return CUE_STATUSES.COMPLETED;
            default:
                return CUE_STATUSES.PENDING;
        }
    }

    /**
     * 标准化流程数据
     * @param {Object} data - 原始数据
     * @returns {Object} 标准化的数据
     */
    normalizeCueData(data) {
        return {
            name: data.name || '',
            order: data.order || 0,
            status: data.status || CUE_STATUSES.PENDING,
            responsible: data.responsible || '',
            duration: data.duration || 0,
            startTime: data.startTime || '',
            microphones: data.microphones || [],
            audioPath: data.audioPath || '',
            script: data.script || '',
            notes: data.notes || ''
        };
    }

    /**
     * 导出为 JSON 格式
     * @param {string} projectId - 项目ID
     * @returns {string} JSON 字符串
     */
    exportToJson(projectId) {
        const project = dataStore.getProjectById(projectId);
        if (!project) {
            throw new Error('项目不存在');
        }

        const exportData = {
            project: {
                id: project.id,
                name: project.name,
                description: project.description,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt
            },
            cues: dataStore.getCues(projectId)
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * 导出为 Markdown 格式的 Cue Sheet
     * @param {string} projectId - 项目ID
     * @returns {string} Markdown 字符串
     */
    exportToMarkdown(projectId) {
        const project = dataStore.getProjectById(projectId);
        if (!project) {
            throw new Error('项目不存在');
        }

        const cues = dataStore.getCues(projectId);
        let markdown = `# ${project.name}\n\n`;
        
        if (project.description) {
            markdown += `${project.description}\n\n`;
        }

        markdown += `## 流程列表\n\n`;
        markdown += `| 顺序 | 流程名称 | 状态 | 负责人 | 时长 | 开始时间 | 麦克风 |\n`;
        markdown += `|------|----------|------|--------|------|----------|--------|\n`;

        cues.forEach(cue => {
            const statusLabel = CUE_STATUS_LABELS[cue.status] || cue.status;
            const microphones = cue.microphones.length > 0 ? cue.microphones.join(', ') : '-';
            
            markdown += `| ${cue.order} | ${cue.name} | ${statusLabel} | ${cue.responsible || '-'} | ${cue.duration || '-'} 分钟 | ${cue.startTime || '-'} | ${microphones} |\n`;
        });

        markdown += `\n---\n\n`;

        cues.forEach((cue, index) => {
            const statusLabel = CUE_STATUS_LABELS[cue.status] || cue.status;
            markdown += `### ${index + 1}. ${cue.name}\n\n`;
            markdown += `- **状态**: ${statusLabel}\n`;
            
            if (cue.responsible) {
                markdown += `- **负责人**: ${cue.responsible}\n`;
            }
            
            if (cue.duration) {
                markdown += `- **预估时长**: ${cue.duration} 分钟\n`;
            }
            
            if (cue.startTime) {
                markdown += `- **开始时间**: ${cue.startTime}\n`;
            }
            
            if (cue.microphones.length > 0) {
                markdown += `- **麦克风**: ${cue.microphones.join(', ')}\n`;
            }
            
            if (cue.audioPath) {
                markdown += `- **音频文件**: ${cue.audioPath}\n`;
            }
            
            if (cue.script) {
                markdown += `\n**口播卡**:\n\n${cue.script}\n\n`;
            }
            
            if (cue.notes) {
                markdown += `\n**现场备注**:\n\n${cue.notes}\n\n`;
            }
            
            markdown += `\n---\n\n`;
        });

        return markdown;
    }

    /**
     * 导出为 HTML 格式的 Cue Sheet
     * @param {string} projectId - 项目ID
     * @returns {string} HTML 字符串
     */
    exportToHtml(projectId) {
        const project = dataStore.getProjectById(projectId);
        if (!project) {
            throw new Error('项目不存在');
        }

        const cues = dataStore.getCues(projectId);
        
        let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name} - Cue Sheet</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
        }
        h3 {
            color: #2c3e50;
            margin-top: 25px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #2c3e50;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .status-pending { background-color: #fff3cd; color: #856404; }
        .status-rehearsed { background-color: #d4edda; color: #155724; }
        .status-changed { background-color: #ffe5d0; color: #9c4c00; }
        .status-completed { background-color: #e9ecef; color: #383d41; }
        .cue-detail {
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 15px 0;
        }
        .cue-detail h4 {
            margin-top: 0;
            color: #2c3e50;
        }
        hr {
            border: none;
            border-top: 1px solid #ddd;
            margin: 30px 0;
        }
    </style>
</head>
<body>
    <h1>${project.name}</h1>
`;

        if (project.description) {
            html += `    <p>${this.escapeHtml(project.description)}</p>\n`;
        }

        html += `
    <h2>流程概览</h2>
    <table>
        <thead>
            <tr>
                <th>顺序</th>
                <th>流程名称</th>
                <th>状态</th>
                <th>负责人</th>
                <th>时长</th>
                <th>开始时间</th>
                <th>麦克风</th>
            </tr>
        </thead>
        <tbody>
`;

        cues.forEach(cue => {
            const statusLabel = CUE_STATUS_LABELS[cue.status] || cue.status;
            const statusClass = `status-${cue.status}`;
            const microphones = cue.microphones.length > 0 ? cue.microphones.join(', ') : '-';
            
            html += `            <tr>
                <td>${cue.order}</td>
                <td>${this.escapeHtml(cue.name)}</td>
                <td><span class="${statusClass}">${this.escapeHtml(statusLabel)}</span></td>
                <td>${this.escapeHtml(cue.responsible || '-')}</td>
                <td>${cue.duration || '-'} 分钟</td>
                <td>${this.escapeHtml(cue.startTime || '-')}</td>
                <td>${this.escapeHtml(microphones)}</td>
            </tr>\n`;
        });

        html += `        </tbody>
    </table>

    <hr>

    <h2>详细流程</h2>
`;

        cues.forEach((cue, index) => {
            const statusLabel = CUE_STATUS_LABELS[cue.status] || cue.status;
            const statusClass = `status-${cue.status}`;
            
            html += `
    <div class="cue-detail">
        <h3>${index + 1}. ${this.escapeHtml(cue.name)}</h3>
        <p><strong>状态:</strong> <span class="${statusClass}">${this.escapeHtml(statusLabel)}</span></p>
`;

            if (cue.responsible) {
                html += `        <p><strong>负责人:</strong> ${this.escapeHtml(cue.responsible)}</p>\n`;
            }
            
            if (cue.duration) {
                html += `        <p><strong>预估时长:</strong> ${cue.duration} 分钟</p>\n`;
            }
            
            if (cue.startTime) {
                html += `        <p><strong>开始时间:</strong> ${this.escapeHtml(cue.startTime)}</p>\n`;
            }
            
            if (cue.microphones.length > 0) {
                html += `        <p><strong>麦克风:</strong> ${this.escapeHtml(cue.microphones.join(', '))}</p>\n`;
            }
            
            if (cue.audioPath) {
                html += `        <p><strong>音频文件:</strong> ${this.escapeHtml(cue.audioPath)}</p>\n`;
            }
            
            if (cue.script) {
                html += `        <h4>口播卡</h4>
        <p>${this.escapeHtml(cue.script).replace(/\n/g, '<br>')}</p>\n`;
            }
            
            if (cue.notes) {
                html += `        <h4>现场备注</h4>
        <p>${this.escapeHtml(cue.notes).replace(/\n/g, '<br>')}</p>\n`;
            }
            
            html += `    </div>\n`;
        });

        html += `
</body>
</html>`;

        return html;
    }

    /**
     * 导出为 CSV 格式的物料清单
     * @param {string} projectId - 项目ID
     * @returns {string} CSV 字符串
     */
    exportToCsv(projectId) {
        const project = dataStore.getProjectById(projectId);
        if (!project) {
            throw new Error('项目不存在');
        }

        const cues = dataStore.getCues(projectId);
        
        const headers = [
            '顺序',
            '流程名称',
            '状态',
            '负责人',
            '预估时长(分钟)',
            '开始时间',
            '麦克风',
            '音频文件路径',
            '口播卡',
            '现场备注'
        ];

        let csv = headers.join(',') + '\n';

        cues.forEach(cue => {
            const statusLabel = CUE_STATUS_LABELS[cue.status] || cue.status;
            const microphones = cue.microphones.length > 0 ? cue.microphones.join('; ') : '';
            
            const row = [
                cue.order,
                this.escapeCsvField(cue.name),
                this.escapeCsvField(statusLabel),
                this.escapeCsvField(cue.responsible || ''),
                cue.duration || '',
                this.escapeCsvField(cue.startTime || ''),
                this.escapeCsvField(microphones),
                this.escapeCsvField(cue.audioPath || ''),
                this.escapeCsvField(cue.script || ''),
                this.escapeCsvField(cue.notes || '')
            ];
            
            csv += row.join(',') + '\n';
        });

        return csv;
    }

    /**
     * 导出为开场前 10 分钟急救清单
     * @param {string} projectId - 项目ID
     * @returns {string} Markdown 字符串
     */
    exportChecklist(projectId) {
        const project = dataStore.getProjectById(projectId);
        if (!project) {
            throw new Error('项目不存在');
        }

        const cues = dataStore.getCues(projectId);
        const risks = riskChecker.checkAll(projectId);

        let checklist = `# ${project.name} - 开场前 10 分钟急救清单\n\n`;
        checklist += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
        checklist += `---\n\n`;

        checklist += `## 🚨 紧急风险项 (必须处理)\n\n`;
        
        const highRisks = risks.filter(r => r.level === RISK_LEVELS.HIGH);
        const mediumRisks = risks.filter(r => r.level === RISK_LEVELS.MEDIUM);
        
        if (highRisks.length > 0) {
            highRisks.forEach((risk, index) => {
                checklist += `- [ ] **${index + 1}. ${risk.title}**\n`;
                checklist += `  ${risk.description}\n\n`;
            });
        } else {
            checklist += `✅ 无高风险项\n\n`;
        }

        checklist += `## ⚠️ 注意事项 (建议处理)\n\n`;
        
        if (mediumRisks.length > 0) {
            mediumRisks.forEach((risk, index) => {
                checklist += `- [ ] ${index + 1}. ${risk.title}\n`;
                checklist += `  ${risk.description}\n\n`;
            });
        } else {
            checklist += `✅ 无中风险项\n\n`;
        }

        checklist += `---\n\n`;
        checklist += `## 📋 开场前确认清单\n\n`;

        checklist += `### 设备检查\n`;
        checklist += `- [ ] 所有麦克风电池电量充足\n`;
        checklist += `- [ ] 所有音频文件路径正确且可以正常播放\n`;
        checklist += `- [ ] 音响系统音量测试正常\n`;
        checklist += `- [ ] 灯光系统测试正常\n`;
        checklist += `- [ ] 备用设备准备就绪\n\n`;

        checklist += `### 人员确认\n`;
        const allResponsibles = new Set(cues.filter(c => c.responsible).map(c => c.responsible));
        allResponsibles.forEach(responsible => {
            checklist += `- [ ] ${responsible} 已到场并准备就绪\n`;
        });
        checklist += `- [ ] 音控人员就位\n`;
        checklist += `- [ ] 灯光人员就位\n`;
        checklist += `- [ ] 应急联系人已确认\n\n`;

        checklist += `### 流程确认\n`;
        const changedCues = cues.filter(c => c.status === CUE_STATUSES.CHANGED);
        const pendingCues = cues.filter(c => c.status === CUE_STATUSES.PENDING);
        
        if (changedCues.length > 0) {
            checklist += `⚠️ 以下流程有现场变更，请再次确认：\n`;
            changedCues.forEach(cue => {
                checklist += `- [ ] 流程 ${cue.order}: ${cue.name} - 变更内容: ${cue.notes || '请查看详细信息'}\n`;
            });
            checklist += `\n`;
        }
        
        if (pendingCues.length > 0) {
            checklist += `⚠️ 以下流程状态为"待确认"：\n`;
            pendingCues.forEach(cue => {
                checklist += `- [ ] 流程 ${cue.order}: ${cue.name}\n`;
            });
            checklist += `\n`;
        }

        checklist += `- [ ] 所有流程顺序已确认\n`;
        checklist += `- [ ] 所有口播词已准备好\n`;
        checklist += `- [ ] 所有音频素材已准备好\n`;
        checklist += `- [ ] 时间安排已确认\n\n`;

        checklist += `### 应急准备\n`;
        checklist += `- [ ] 应急预案已确认\n`;
        checklist += `- [ ] 应急通讯方式已确认\n`;
        checklist += `- [ ] 应急联系人已通知\n\n`;

        checklist += `---\n\n`;
        checklist += `## 📝 备注\n\n`;
        checklist += `在此处记录现场特殊情况：\n\n`;
        checklist += `---\n\n`;
        checklist += `**最后确认**: 所有检查项完成后，请在此处签名：___________\n`;
        checklist += `**时间**: ___________\n`;

        return checklist;
    }

    /**
     * 转义 HTML 特殊字符
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 转义 CSV 字段
     * @param {string} field - 字段值
     * @returns {string} 转义后的字段
     */
    escapeCsvField(field) {
        if (field === null || field === undefined) {
            return '';
        }
        
        const str = String(field);
        
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        
        return str;
    }

    /**
     * 下载文件
     * @param {string} content - 文件内容
     * @param {string} filename - 文件名
     * @param {string} mimeType - MIME 类型
     */
    downloadFile(content, filename, mimeType = 'text/plain') {
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

    /**
     * 读取文件内容
     * @param {File} file - 文件对象
     * @returns {Promise<string>} 文件内容
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = (event) => {
                reject(new Error('文件读取失败'));
            };
            
            reader.readAsText(file);
        });
    }
}

// 全局导入导出管理器实例
const importExportManager = new ImportExportManager();

// 导出导入导出管理器（供其他脚本使用）
window.ImportExportManager = ImportExportManager;
window.importExportManager = importExportManager;
