const fs = require('fs');
const path = require('path');
const Workspace = require('./workspace');

const EXPORT_FORMATS = ['json', 'html', 'md', 'markdown'];

class AuditExporter {
    constructor(workspace) {
        this.workspace = workspace;
    }

    export(options = {}) {
        const {
            format = 'json',
            outputPath = null,
            startTime = null,
            endTime = null,
            includeRevisions = true,
            includeConflicts = true,
            includeLeases = true
        } = options;

        if (!EXPORT_FORMATS.includes(format.toLowerCase())) {
            throw new Error(`Unsupported format: ${format}. Supported: ${EXPORT_FORMATS.join(', ')}`);
        }

        const report = this._generateReport({
            startTime,
            endTime,
            includeRevisions,
            includeConflicts,
            includeLeases
        });

        let content;
        const finalFormat = format.toLowerCase();

        switch (finalFormat) {
            case 'json':
                content = JSON.stringify(report, null, 2);
                break;
            case 'html':
                content = this._renderHtml(report);
                break;
            case 'md':
            case 'markdown':
                content = this._renderMarkdown(report);
                break;
            default:
                content = JSON.stringify(report, null, 2);
        }

        if (outputPath) {
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            fs.writeFileSync(outputPath, content);
            return {
                success: true,
                format: finalFormat,
                outputPath,
                fileSize: Buffer.byteLength(content, 'utf8')
            };
        }

        return {
            success: true,
            format: finalFormat,
            content
        };
    }

    _generateReport(options) {
        const {
            startTime,
            endTime,
            includeRevisions,
            includeConflicts,
            includeLeases
        } = options;

        const meta = this.workspace.getMeta();
        const auditLog = this.workspace.getAuditLog(startTime, endTime);

        const stats = {
            totalOperations: auditLog.length,
            byAction: {},
            byAuthor: {},
            byFile: {},
            timeRange: {
                start: auditLog.length > 0 ? auditLog[0].timestamp : null,
                end: auditLog.length > 0 ? auditLog[auditLog.length - 1].timestamp : null
            }
        };

        auditLog.forEach(entry => {
            const action = entry.action;
            const author = entry.details?.author || 'unknown';
            const file = entry.details?.relativePath || entry.details?.file || 'unknown';

            stats.byAction[action] = (stats.byAction[action] || 0) + 1;
            stats.byAuthor[author] = (stats.byAuthor[author] || 0) + 1;
            stats.byFile[file] = (stats.byFile[file] || 0) + 1;
        });

        const report = {
            generatedAt: new Date().toISOString(),
            workspace: {
                id: meta.id,
                createdAt: meta.createdAt,
                version: meta.version,
                options: meta.options
            },
            stats,
            auditLog: auditLog
        };

        if (includeRevisions) {
            const revisions = this.workspace.getAllRevisions();
            report.revisions = revisions.sort((a, b) =>
                new Date(a.timestamp) - new Date(b.timestamp)
            );

            const files = new Set();
            revisions.forEach(r => files.add(r.relativePath));
            report.files = Array.from(files).map(file => {
                const fileRevisions = revisions.filter(r => r.relativePath === file);
                return {
                    path: file,
                    revisionCount: fileRevisions.length,
                    lastModified: fileRevisions.length > 0
                        ? fileRevisions[fileRevisions.length - 1].timestamp
                        : null,
                    authors: Array.from(new Set(fileRevisions.map(r => r.author)))
                };
            });
        }

        if (includeConflicts) {
            const WriteCoordinator = require('./write-coordinator');
            const coordinator = new WriteCoordinator(this.workspace);

            const conflictsDir = path.join(this.workspace.guardPath, 'conflicts');
            report.conflicts = [];

            if (fs.existsSync(conflictsDir)) {
                const conflictFiles = fs.readdirSync(conflictsDir)
                    .filter(f => f.endsWith('.json'));

                for (const file of conflictFiles) {
                    try {
                        const content = fs.readFileSync(path.join(conflictsDir, file), 'utf8');
                        const conflict = JSON.parse(content);
                        report.conflicts.push({
                            id: conflict.id,
                            relativePath: conflict.relativePath,
                            author: conflict.author,
                            createdAt: conflict.createdAt,
                            status: conflict.status,
                            resolvedAt: conflict.resolvedAt,
                            resolvedBy: conflict.resolvedBy,
                            resolution: conflict.resolution,
                            conflictCount: conflict.conflicts?.length || 0
                        });
                    } catch (e) {
                        // Skip invalid files
                    }
                }
            }
        }

        if (includeLeases) {
            const LeaseManager = require('./lease-manager');
            const leaseManager = new LeaseManager(this.workspace);

            report.leases = leaseManager.getAllLeases().map(lease => ({
                id: lease.id,
                relativePath: lease.relativePath,
                author: lease.author,
                status: lease.status,
                createdAt: lease.createdAt,
                expiresAt: lease.expiresAt,
                releasedAt: lease.releasedAt,
                renewedCount: lease.renewedAt?.length || 0
            }));
        }

        return report;
    }

    _renderMarkdown(report) {
        let md = `# Document Sync Guard - Audit Report\n\n`;
        md += `Generated: ${report.generatedAt}\n\n`;

        md += `## Workspace Info\n\n`;
        md += `- **ID**: ${report.workspace.id}\n`;
        md += `- **Created**: ${report.workspace.createdAt}\n`;
        md += `- **Version**: ${report.workspace.version}\n\n`;

        md += `## Statistics\n\n`;
        md += `### Summary\n\n`;
        md += `- **Total Operations**: ${report.stats.totalOperations}\n`;
        if (report.stats.timeRange.start) {
            md += `- **Time Range**: ${report.stats.timeRange.start} to ${report.stats.timeRange.end}\n`;
        }
        md += `\n`;

        md += `### By Action\n\n`;
        md += `| Action | Count |\n`;
        md += `|--------|-------|\n`;
        Object.entries(report.stats.byAction).sort((a, b) => b[1] - a[1]).forEach(([action, count]) => {
            md += `| ${action} | ${count} |\n`;
        });
        md += `\n`;

        md += `### By Author\n\n`;
        md += `| Author | Operations |\n`;
        md += `|--------|------------|\n`;
        Object.entries(report.stats.byAuthor).sort((a, b) => b[1] - a[1]).forEach(([author, count]) => {
            md += `| ${author} | ${count} |\n`;
        });
        md += `\n`;

        if (report.files && report.files.length > 0) {
            md += `## Tracked Files\n\n`;
            md += `| File | Revisions | Last Modified | Authors |\n`;
            md += `|------|-----------|---------------|---------|\n`;
            report.files.forEach(file => {
                md += `| ${file.path} | ${file.revisionCount} | ${file.lastModified || '-'} | ${file.authors.join(', ')} |\n`;
            });
            md += `\n`;
        }

        if (report.revisions && report.revisions.length > 0) {
            md += `## Revisions\n\n`;
            md += `| ID | File | Author | Timestamp | Message |\n`;
            md += `|----|------|--------|-----------|---------|\n`;
            report.revisions.slice(-20).forEach(rev => {
                const shortId = rev.id.substring(0, 8);
                md += `| ${shortId} | ${rev.relativePath} | ${rev.author} | ${rev.timestamp} | ${rev.message || '-'} |\n`;
            });
            if (report.revisions.length > 20) {
                md += `\n*Showing last 20 of ${report.revisions.length} revisions*\n`;
            }
            md += `\n`;
        }

        if (report.conflicts && report.conflicts.length > 0) {
            md += `## Conflicts\n\n`;
            md += `| ID | File | Author | Status | Created | Resolved |\n`;
            md += `|----|------|--------|--------|---------|----------|\n`;
            report.conflicts.forEach(conflict => {
                const shortId = conflict.id.substring(0, 8);
                md += `| ${shortId} | ${conflict.relativePath} | ${conflict.author} | ${conflict.status} | ${conflict.createdAt} | ${conflict.resolvedAt || '-'} |\n`;
            });
            md += `\n`;
        }

        if (report.leases && report.leases.length > 0) {
            md += `## Leases\n\n`;
            md += `| ID | File | Author | Status | Created | Expires |\n`;
            md += `|----|------|--------|--------|---------|---------|\n`;
            report.leases.forEach(lease => {
                const shortId = lease.id.substring(0, 8);
                md += `| ${shortId} | ${lease.relativePath} | ${lease.author} | ${lease.status} | ${lease.createdAt} | ${lease.expiresAt} |\n`;
            });
            md += `\n`;
        }

        if (report.auditLog && report.auditLog.length > 0) {
            md += `## Audit Log (Last 30 entries)\n\n`;
            md += `| Timestamp | Action | Author | Details |\n`;
            md += `|-----------|--------|--------|---------|\n`;
            report.auditLog.slice(-30).forEach(entry => {
                const details = entry.details
                    ? JSON.stringify(entry.details).substring(0, 80)
                    : '-';
                md += `| ${entry.timestamp} | ${entry.action} | ${entry.details?.author || '-'} | ${details} |\n`;
            });
            md += `\n`;
        }

        return md;
    }

    _renderHtml(report) {
        const markdown = this._renderMarkdown(report);

        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Doc Sync Guard - Audit Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f9fafb;
        }
        h1 { font-size: 2em; margin: 1em 0 0.5em; color: #1a202c; border-bottom: 2px solid #4299e1; padding-bottom: 10px; }
        h2 { font-size: 1.5em; margin: 1.5em 0 0.8em; color: #2d3748; }
        h3 { font-size: 1.2em; margin: 1em 0 0.5em; color: #4a5568; }
        p { margin: 1em 0; }
        ul { margin: 1em 0; padding-left: 2em; }
        li { margin: 0.5em 0; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        th {
            background: #edf2f7;
            font-weight: 600;
            color: #2d3748;
        }
        tr:hover { background: #f7fafc; }
        code {
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 0.9em;
        }
        pre {
            background: #1a202c;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
        }
        pre code {
            background: none;
            padding: 0;
        }
        .header-info {
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .header-info p { margin: 5px 0; }
        .status-pending { color: #ecc94b; font-weight: bold; }
        .status-resolved { color: #48bb78; font-weight: bold; }
        .status-active { color: #4299e1; font-weight: bold; }
        .status-expired { color: #f56565; font-weight: bold; }
        .status-released { color: #a0aec0; }
    </style>
</head>
<body>
    <div class="header-info">
        <h1 style="border: none; color: white; margin: 0;">📋 Document Sync Guard - Audit Report</h1>
        <p>Generated: ${report.generatedAt}</p>
    </div>

    <h2>Workspace Info</h2>
    <ul>
        <li><strong>ID:</strong> <code>${report.workspace.id}</code></li>
        <li><strong>Created:</strong> ${report.workspace.createdAt}</li>
        <li><strong>Version:</strong> ${report.workspace.version}</li>
    </ul>

    <h2>Statistics</h2>

    <h3>Summary</h3>
    <ul>
        <li><strong>Total Operations:</strong> ${report.stats.totalOperations}</li>
        ${report.stats.timeRange.start ? `<li><strong>Time Range:</strong> ${report.stats.timeRange.start} to ${report.stats.timeRange.end}</li>` : ''}
    </ul>

    <h3>By Action</h3>
    <table>
        <tr><th>Action</th><th>Count</th></tr>
        ${Object.entries(report.stats.byAction).sort((a, b) => b[1] - a[1]).map(([action, count]) =>
            `<tr><td>${action}</td><td>${count}</td></tr>`
        ).join('')}
    </table>

    <h3>By Author</h3>
    <table>
        <tr><th>Author</th><th>Operations</th></tr>
        ${Object.entries(report.stats.byAuthor).sort((a, b) => b[1] - a[1]).map(([author, count]) =>
            `<tr><td>${author}</td><td>${count}</td></tr>`
        ).join('')}
    </table>

    ${report.files && report.files.length > 0 ? `
    <h2>Tracked Files</h2>
    <table>
        <tr><th>File</th><th>Revisions</th><th>Last Modified</th><th>Authors</th></tr>
        ${report.files.map(file => `
            <tr>
                <td><code>${file.path}</code></td>
                <td>${file.revisionCount}</td>
                <td>${file.lastModified || '-'}</td>
                <td>${file.authors.join(', ')}</td>
            </tr>
        `).join('')}
    </table>
    ` : ''}

    ${report.conflicts && report.conflicts.length > 0 ? `
    <h2>Conflicts</h2>
    <table>
        <tr><th>ID</th><th>File</th><th>Author</th><th>Status</th><th>Created</th><th>Resolved</th></tr>
        ${report.conflicts.map(conflict => `
            <tr>
                <td><code>${conflict.id.substring(0, 8)}</code></td>
                <td><code>${conflict.relativePath}</code></td>
                <td>${conflict.author}</td>
                <td><span class="status-${conflict.status}">${conflict.status}</span></td>
                <td>${conflict.createdAt}</td>
                <td>${conflict.resolvedAt || '-'}</td>
            </tr>
        `).join('')}
    </table>
    ` : ''}

    ${report.leases && report.leases.length > 0 ? `
    <h2>Leases</h2>
    <table>
        <tr><th>ID</th><th>File</th><th>Author</th><th>Status</th><th>Created</th><th>Expires</th></tr>
        ${report.leases.map(lease => `
            <tr>
                <td><code>${lease.id.substring(0, 8)}</code></td>
                <td><code>${lease.relativePath}</code></td>
                <td>${lease.author}</td>
                <td><span class="status-${lease.status}">${lease.status}</span></td>
                <td>${lease.createdAt}</td>
                <td>${lease.expiresAt}</td>
            </tr>
        `).join('')}
    </table>
    ` : ''}

    ${report.revisions && report.revisions.length > 0 ? `
    <h2>Revisions (Last 20)</h2>
    <table>
        <tr><th>ID</th><th>File</th><th>Author</th><th>Timestamp</th><th>Message</th></tr>
        ${report.revisions.slice(-20).map(rev => `
            <tr>
                <td><code>${rev.id.substring(0, 8)}</code></td>
                <td><code>${rev.relativePath}</code></td>
                <td>${rev.author}</td>
                <td>${rev.timestamp}</td>
                <td>${rev.message || '-'}</td>
            </tr>
        `).join('')}
    </table>
    ` : ''}

</body>
</html>`;

        return html;
    }
}

module.exports = AuditExporter;
