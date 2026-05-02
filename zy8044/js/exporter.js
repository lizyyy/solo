export class ExportManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    exportIssuesCSV() {
        const issues = this.stateManager.getIssues();
        if (!issues || issues.length === 0) {
            alert('没有可导出的问题');
            return;
        }

        const headers = ['ID', '类型', '严重程度', '标题', '元素', '详情', '时间'];
        const rows = issues.map(issue => [
            issue.id,
            this.getTypeLabel(issue.type),
            issue.severity,
            issue.title,
            issue.element,
            issue.detail,
            issue.timestamp
        ]);

        const csvContent = this.generateCSV([headers, ...rows]);
        this.downloadFile(csvContent, 'issues.csv', 'text/csv;charset=utf-8');
    }

    exportPreviewJSON() {
        const previewData = this.stateManager.getPreviewData();
        const jsonString = JSON.stringify(previewData, null, 2);
        this.downloadFile(jsonString, 'preview.json', 'application/json');
    }

    generateCSV(rows) {
        return rows.map(row =>
            row.map(cell => {
                const str = String(cell);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',')
        ).join('\n');
    }

    getTypeLabel(type) {
        const labels = {
            'bleed': '出血不足',
            'text-on-line': '文字压线',
            'missing-color': '色版缺失',
            'overlap': '重叠区域'
        };
        return labels[type] || type;
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob(['\ufeff' + content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
