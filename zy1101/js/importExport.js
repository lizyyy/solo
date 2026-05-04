const ImportExport = {
    async importFromFile(file) {
        const fileName = file.name.toLowerCase();
        
        if (fileName.endsWith('.json')) {
            return this.importFromJSONFile(file);
        } else if (fileName.endsWith('.csv')) {
            return this.importFromCSVFile(file);
        }
        
        throw new Error('不支持的文件格式，请使用 .json 或 .csv 文件');
    },
    
    async importFromJSONFile(file) {
        const text = await Utils.readFileAsText(file);
        const data = Storage.importFromJSON(text);
        return { type: 'json', data };
    },
    
    async importFromCSVFile(file) {
        const text = await Utils.readFileAsText(file);
        const csvData = Utils.parseCSV(text);
        const fileName = file.name.toLowerCase();
        
        let dataType = null;
        
        if (fileName.includes('room') || csvData.some(row => 
            row.name || row.房间名称 || row.area || row.面积
        )) {
            dataType = 'rooms';
        } else if (fileName.includes('material') || csvData.some(row => 
            row.type || row.类型 || row.lossRate || row.损耗率
        )) {
            dataType = 'materials';
        } else if (fileName.includes('purchase') || csvData.some(row => 
            row.batchNo || row.批次号 || row.quantity || row.数量
        )) {
            dataType = 'purchases';
        } else if (fileName.includes('change') || csvData.some(row => 
            row.changeType || row.变更类型 || row.originalArea || row.原面积
        )) {
            dataType = 'changes';
        }
        
        return {
            type: 'csv',
            dataType: dataType,
            data: csvData
        };
    },
    
    exportToJSON() {
        const data = DataStore.exportData();
        return JSON.stringify(data, null, 2);
    },
    
    exportToMarkdown() {
        const calculatedData = DataStore.calculatedData;
        const risks = DataStore.risks;
        
        if (!calculatedData) {
            return '# 装修材料报告\n\n暂无数据，请先导入数据。';
        }
        
        const today = new Date().toLocaleDateString('zh-CN');
        let md = `# 装修材料账目报告\n\n`;
        md += `**生成日期**: ${today}\n\n`;
        md += `---\n\n`;
        
        const highRisks = risks.filter(r => r.level === 'high');
        const mediumRisks = risks.filter(r => r.level === 'medium');
        const lowRisks = risks.filter(r => r.level === 'low');
        
        if (risks.length > 0) {
            md += `## ⚠️ 风险预警\n\n`;
            md += `| 风险等级 | 数量 |\n`;
            md += `|----------|------|\n`;
            md += `| 🔴 高风险 | ${highRisks.length} |\n`;
            md += `| 🟡 中风险 | ${mediumRisks.length} |\n`;
            md += `| 🟢 低风险 | ${lowRisks.length} |\n\n`;
            
            if (highRisks.length > 0) {
                md += `### 🔴 高风险\n\n`;
                highRisks.forEach(r => {
                    md += `- **${r.title}**: ${r.summary}\n`;
                });
                md += `\n`;
            }
        }
        
        md += `## 📦 补货清单\n\n`;
        
        const shortageMaterials = calculatedData.materialSummary.filter(ms => ms.shortage > 0);
        
        if (shortageMaterials.length > 0) {
            md += `| 材料名称 | 类型 | 单位 | 需补货量 | 已采购 | 总需求 |\n`;
            md += `|----------|------|------|----------|--------|--------|\n`;
            
            shortageMaterials.forEach(ms => {
                md += `| ${ms.materialName} | ${ms.materialType} | ${ms.unit} | ${Utils.formatNumber(ms.shortage)} | ${Utils.formatNumber(ms.totalPurchased)} | ${Utils.formatNumber(ms.totalRequired)} |\n`;
            });
            md += `\n`;
        } else {
            md += `所有材料库存充足，无需补货。\n\n`;
        }
        
        md += `## 🔄 退料建议\n\n`;
        
        const surplusMaterials = calculatedData.materialSummary.filter(ms => ms.surplus > 0);
        
        if (surplusMaterials.length > 0) {
            md += `| 材料名称 | 类型 | 单位 | 过剩量 | 过剩比例 | 建议 |\n`;
            md += `|----------|------|------|--------|----------|------|\n`;
            
            surplusMaterials.forEach(ms => {
                const percentage = ms.totalRequired > 0 ? (ms.surplus / ms.totalRequired) * 100 : 0;
                let suggestion = '';
                if (percentage > 50) {
                    suggestion = '优先退料';
                } else if (percentage > 30) {
                    suggestion = '可考虑退料';
                } else {
                    suggestion = '留作备用';
                }
                
                md += `| ${ms.materialName} | ${ms.materialType} | ${ms.unit} | ${Utils.formatNumber(ms.surplus)} | ${Utils.formatNumber(percentage)}% | ${suggestion} |\n`;
            });
            md += `\n`;
        } else {
            md += `暂无过剩材料。\n\n`;
        }
        
        md += `## 🏠 各房间材料需求\n\n`;
        
        calculatedData.roomSummary.forEach(rs => {
            md += `### ${rs.roomName}\n\n`;
            
            const roomMaterials = calculatedData.roomMaterials.filter(rm => rm.roomId === rs.roomId);
            
            if (roomMaterials.length > 0) {
                md += `| 材料 | 单位 | 需求 | 已购 | 状态 |\n`;
                md += `|------|------|------|------|------|\n`;
                
                roomMaterials.forEach(rm => {
                    let status = '✓ 充足';
                    if (rm.shortage > 0) status = `✗ 短缺 ${Utils.formatNumber(rm.shortage)}`;
                    else if (rm.surplus > 0) status = `○ 过剩 ${Utils.formatNumber(rm.surplus)}`;
                    
                    md += `| ${rm.materialName} | ${rm.unit} | ${Utils.formatNumber(rm.totalRequired)} | ${Utils.formatNumber(rm.totalPurchased)} | ${status} |\n`;
                });
                md += `\n`;
            }
        });
        
        md += `## 📋 采购汇总\n\n`;
        md += `| 材料 | 类型 | 单位 | 总需求 | 已采购 | 短缺 | 过剩 |\n`;
        md += `|------|------|------|--------|--------|------|------|\n`;
        
        calculatedData.materialSummary.forEach(ms => {
            md += `| ${ms.materialName} | ${ms.materialType} | ${ms.unit} | ${Utils.formatNumber(ms.totalRequired)} | ${Utils.formatNumber(ms.totalPurchased)} | ${Utils.formatNumber(ms.shortage)} | ${Utils.formatNumber(ms.surplus)} |\n`;
        });
        
        return md;
    },
    
    exportToHTML() {
        const markdown = this.exportToMarkdown();
        return this.markdownToHTML(markdown);
    },
    
    markdownToHTML(markdown) {
        let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>装修材料账目报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            padding: 40px;
            max-width: 900px;
            margin: 0 auto;
            color: #1e293b;
        }
        h1 { font-size: 28px; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
        h2 { font-size: 22px; margin-top: 32px; margin-bottom: 16px; color: #1e40af; }
        h3 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { padding: 12px; text-align: left; border: 1px solid #e2e8f0; }
        th { background-color: #f1f5f9; font-weight: 600; }
        ul { margin: 16px 0; padding-left: 24px; }
        li { margin: 8px 0; }
        hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
        .highlight { background-color: #fef3c7; padding: 2px 6px; border-radius: 4px; }
        .risk-high { color: #dc2626; font-weight: 600; }
        .risk-medium { color: #d97706; font-weight: 600; }
        .risk-low { color: #2563eb; font-weight: 600; }
    </style>
</head>
<body>
`;
        
        const lines = markdown.split('\n');
        let inTable = false;
        let tableRows = [];
        
        lines.forEach(line => {
            line = line.trim();
            
            if (line.startsWith('# ')) {
                html += `<h1>${line.slice(2)}</h1>\n`;
            } else if (line.startsWith('## ')) {
                html += `<h2>${line.slice(3)}</h2>\n`;
            } else if (line.startsWith('### ')) {
                html += `<h3>${line.slice(4)}</h3>\n`;
            } else if (line.startsWith('---')) {
                html += `<hr>\n`;
            } else if (line.startsWith('| ')) {
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(line);
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
                if (inTable) {
                    html += this.renderTable(tableRows);
                    inTable = false;
                    tableRows = [];
                }
                html += `<li>${line.slice(2)}</li>\n`;
            } else if (line === '') {
                if (inTable) {
                    html += this.renderTable(tableRows);
                    inTable = false;
                    tableRows = [];
                }
            } else {
                if (inTable) {
                    html += this.renderTable(tableRows);
                    inTable = false;
                    tableRows = [];
                }
                
                line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                line = line.replace(/🔴/g, '<span class="risk-high">🔴</span>');
                line = line.replace(/🟡/g, '<span class="risk-medium">🟡</span>');
                line = line.replace(/🟢/g, '<span class="risk-low">🟢</span>');
                
                html += `<p>${line}</p>\n`;
            }
        });
        
        if (inTable) {
            html += this.renderTable(tableRows);
        }
        
        html += `
</body>
</html>`;
        
        return html;
    },
    
    renderTable(rows) {
        if (rows.length < 2) return '';
        
        const isSeparator = rows[1].startsWith('|---') || rows[1].startsWith('|:-');
        
        let html = '<table>\n';
        
        if (isSeparator) {
            const headers = this.parseTableRow(rows[0]);
            html += '<thead><tr>';
            headers.forEach(h => {
                html += `<th>${h}</th>`;
            });
            html += '</tr></thead>\n';
            
            html += '<tbody>\n';
            for (let i = 2; i < rows.length; i++) {
                const cells = this.parseTableRow(rows[i]);
                html += '<tr>';
                cells.forEach(c => {
                    let cellHtml = c;
                    cellHtml = cellHtml.replace(/✗/g, '❌');
                    cellHtml = cellHtml.replace(/✓/g, '✅');
                    cellHtml = cellHtml.replace(/○/g, '⚪');
                    html += `<td>${cellHtml}</td>`;
                });
                html += '</tr>\n';
            }
            html += '</tbody>\n';
        }
        
        html += '</table>\n';
        return html;
    },
    
    parseTableRow(row) {
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        return cells;
    },
    
    downloadJSON() {
        const data = this.exportToJSON();
        const fileName = `装修材料数据_${new Date().toISOString().slice(0, 10)}.json`;
        Utils.downloadFile(data, fileName, 'application/json');
    },
    
    downloadMarkdown() {
        const data = this.exportToMarkdown();
        const fileName = `装修材料报告_${new Date().toISOString().slice(0, 10)}.md`;
        Utils.downloadFile(data, fileName, 'text/markdown');
    },
    
    downloadHTML() {
        const data = this.exportToHTML();
        const fileName = `装修材料报告_${new Date().toISOString().slice(0, 10)}.html`;
        Utils.downloadFile(data, fileName, 'text/html');
    }
};

window.ImportExport = ImportExport;
