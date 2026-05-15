const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', '..', 'rag-freshness.db');
const exportDir = path.join(__dirname, '..', '..', 'exports');

if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

console.log('开始导出数据...\n');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

db.all('SELECT * FROM snippets', [], (err, snippets) => {
    if (err) {
        console.error('查询失败:', err);
        db.close();
        return;
    }

    const csvWriter = createCsvWriter({
        path: path.join(exportDir, `snippets-${timestamp}.csv`),
        header: [
            { id: 'id', title: '片段ID' },
            { id: 'data_source_id', title: '数据源ID' },
            { id: 'content', title: '内容' },
            { id: 'freshness_score', title: '新鲜度分数' },
            { id: 'is_expired', title: '是否过期' },
            { id: 'last_modified_at', title: '最后修改时间' },
            { id: 'created_at', title: '创建时间' }
        ]
    });

    csvWriter.writeRecords(snippets).then(() => {
        console.log(`✅ 已导出 ${snippets.length} 个文档片段`);
    });
});

db.all('SELECT * FROM refresh_tasks', [], (err, tasks) => {
    if (err) {
        console.error('查询失败:', err);
        return;
    }

    const csvWriter = createCsvWriter({
        path: path.join(exportDir, `refresh-tasks-${timestamp}.csv`),
        header: [
            { id: 'id', title: '任务ID' },
            { id: 'snippet_id', title: '片段ID' },
            { id: 'status', title: '状态' },
            { id: 'priority', title: '优先级' },
            { id: 'retry_count', title: '重试次数' },
            { id: 'error_message', title: '错误信息' },
            { id: 'is_manual_fix', title: '人工修复' },
            { id: 'fixed_by', title: '修复人' },
            { id: 'fix_note', title: '修复说明' },
            { id: 'created_at', title: '创建时间' }
        ]
    });

    csvWriter.writeRecords(tasks).then(() => {
        console.log(`✅ 已导出 ${tasks.length} 个刷新任务`);
    });
});

db.all('SELECT * FROM alerts', [], (err, alerts) => {
    if (err) {
        console.error('查询失败:', err);
        return;
    }

    const csvWriter = createCsvWriter({
        path: path.join(exportDir, `alerts-${timestamp}.csv`),
        header: [
            { id: 'id', title: '告警ID' },
            { id: 'type', title: '类型' },
            { id: 'level', title: '级别' },
            { id: 'message', title: '消息' },
            { id: 'is_resolved', title: '是否已解决' },
            { id: 'created_at', title: '创建时间' }
        ]
    });

    csvWriter.writeRecords(alerts).then(() => {
        console.log(`✅ 已导出 ${alerts.length} 条告警记录`);
        console.log(`\n📂 导出文件位于: ${exportDir}`);
        db.close();
    });
});
