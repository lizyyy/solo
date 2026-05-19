const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', '..', 'rag-freshness.db');
const db = new sqlite3.Database(dbPath);

console.log('开始填充测试数据...\n');

db.serialize(() => {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();

    const source1Id = uuidv4();
    const source2Id = uuidv4();
    const source3Id = uuidv4();

    console.log('1. 创建数据源...');
    const sources = [
        { id: source1Id, name: '产品文档库', type: 'web', url: 'https://docs.example.com', status: 'active' },
        { id: source2Id, name: 'API文档中心', type: 'api', url: 'https://api.example.com/docs', status: 'active' },
        { id: source3Id, name: '知识库V2', type: 'database', url: null, status: 'active' }
    ];

    sources.forEach(source => {
        db.run(
            'INSERT INTO data_sources (id, name, type, url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [source.id, source.name, source.type, source.url, source.status, now, now]
        );
        console.log(`   - ${source.name}`);
    });

    console.log('\n2. 创建抓取批次...');
    const batches = [
        { id: uuidv4(), sourceId: source1Id, status: 'completed', successCount: 15, failedCount: 0 },
        { id: uuidv4(), sourceId: source2Id, status: 'completed', successCount: 12, failedCount: 2 },
        { id: uuidv4(), sourceId: source3Id, status: 'failed', successCount: 0, failedCount: 20 }
    ];

    batches.forEach(batch => {
        db.run(
            'INSERT INTO crawl_batches (id, data_source_id, status, total_count, success_count, failed_count, started_at, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [batch.id, batch.sourceId, batch.status, batch.successCount + batch.failedCount, batch.successCount, batch.failedCount, yesterday, yesterday, yesterday]
        );
        console.log(`   - 批次 ${batch.id.substring(0, 8)}: ${batch.status}`);
    });

    console.log('\n3. 创建引用片段（包含过期和未过期）...');
    const snippets = [
        { id: uuidv4(), sourceId: source1Id, content: '产品版本发布流程包括：需求评审、开发、测试、灰度发布、正式发布五个阶段。', lastModified: now, freshness: 100, expired: 0 },
        { id: uuidv4(), sourceId: source1Id, content: '用户认证支持三种方式：账号密码、OAuth2.0、单点登录SSO。', lastModified: now, freshness: 95, expired: 0 },
        { id: uuidv4(), sourceId: source1Id, content: '旧版API v1将于2024年6月30日正式停止服务，请尽快迁移至v2版本。', lastModified: lastWeek, freshness: 30, expired: 1 },
        { id: uuidv4(), sourceId: source2Id, content: 'RESTful API设计规范包括：资源命名、HTTP方法使用、状态码规范。', lastModified: now, freshness: 100, expired: 0 },
        { id: uuidv4(), sourceId: source2Id, content: 'API限流策略：每分钟最多100次请求，超出返回429状态码。', lastModified: yesterday, freshness: 85, expired: 0 },
        { id: uuidv4(), sourceId: source2Id, content: '已废弃的接口列表：/v1/users, /v1/orders, /v1/products', lastModified: lastWeek, freshness: 25, expired: 1 },
        { id: uuidv4(), sourceId: source3Id, content: '数据备份策略：每日增量备份，每周全量备份，保留30天。', lastModified: now, freshness: 100, expired: 0 },
        { id: uuidv4(), sourceId: source3Id, content: '已过时的配置参数说明（不建议使用）', lastModified: lastWeek, freshness: 15, expired: 1 }
    ];

    snippets.forEach(snippet => {
        db.run(
            'INSERT INTO snippets (id, data_source_id, content, last_modified_at, freshness_score, is_expired, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [snippet.id, snippet.sourceId, snippet.content, snippet.lastModified, snippet.freshness, snippet.expired, now, now]
        );
        console.log(`   - ${snippet.content.substring(0, 40)}... (新鲜度: ${snippet.freshness}${snippet.expired ? ', 已过期' : ''})`);
    });

    console.log('\n4. 创建刷新任务（各种状态）...');
    const tasks = [
        { id: uuidv4(), snippetId: snippets[2].id, sourceId: source1Id, status: 'pending', retryCount: 0, priority: 'high' },
        { id: uuidv4(), snippetId: snippets[5].id, sourceId: source2Id, status: 'running', retryCount: 1, priority: 'high' },
        { id: uuidv4(), snippetId: snippets[7].id, sourceId: source3Id, status: 'failed', retryCount: 3, priority: 'critical', error: '数据源连接超时，请检查网络配置' },
        { id: uuidv4(), snippetId: snippets[0].id, sourceId: source1Id, status: 'completed', retryCount: 0, priority: 'normal' },
        { id: uuidv4(), snippetId: snippets[1].id, sourceId: source1Id, status: 'completed', retryCount: 0, priority: 'normal', isManualFix: 1, fixedBy: '张三', fixedAt: yesterday, fixNote: '手动更新了文档链接' }
    ];

    tasks.forEach(task => {
        db.run(
            'INSERT INTO refresh_tasks (id, snippet_id, data_source_id, status, priority, retry_count, error_message, is_manual_fix, fixed_by, fixed_at, fix_note, started_at, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [task.id, task.snippetId, task.sourceId, task.status, task.priority, task.retryCount, task.error || null, task.isManualFix || 0, task.fixedBy || null, task.fixedAt || null, task.fixNote || null, task.status !== 'pending' ? yesterday : null, task.status === 'completed' || task.status === 'failed' ? yesterday : null, yesterday, yesterday]
        );
        console.log(`   - 任务 ${task.id.substring(0, 8)}: ${task.status}${task.isManualFix ? ' (人工修复)' : ''}`);
    });

    console.log('\n5. 创建告警记录...');
    const alerts = [
        { id: uuidv4(), type: 'freshness', level: 'high', message: '检测到3个过期文档片段，需要及时更新', resolved: 0 },
        { id: uuidv4(), type: 'crawl', level: 'critical', message: '数据源"知识库V2"抓取失败，连续3次重试均失败', resolved: 0 },
        { id: uuidv4(), type: 'refresh', level: 'medium', message: '刷新任务队列积压超过10个任务', resolved: 1, resolvedBy: '系统', resolvedAt: yesterday, resolveNote: '自动扩容处理节点' },
        { id: uuidv4(), type: 'freshness', level: 'low', message: '部分文档新鲜度低于50%，建议安排更新计划', resolved: 0 }
    ];

    alerts.forEach(alert => {
        db.run(
            'INSERT INTO alerts (id, type, level, message, is_resolved, resolved_by, resolved_at, resolve_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [alert.id, alert.type, alert.level, alert.message, alert.resolved ? 1 : 0, alert.resolvedBy || null, alert.resolvedAt || null, alert.resolveNote || null, yesterday]
        );
        console.log(`   - [${alert.level.toUpperCase()}] ${alert.message.substring(0, 40)}...${alert.resolved ? ' (已解决)' : ''}`);
    });

    console.log('\n6. 创建新鲜度规则...');
    const rules = [
        { id: uuidv4(), name: '文档过期检测', type: 'expiration', condition: 'last_modified_at < NOW() - 30 DAY', action: 'mark_expired', priority: 100 },
        { id: uuidv4(), name: '低新鲜度告警', type: 'alert', condition: 'freshness_score < 50', action: 'create_alert', priority: 80 },
        { id: uuidv4(), name: '自动刷新队列', type: 'refresh', condition: 'is_expired = 1', action: 'create_refresh_task', priority: 90 }
    ];

    rules.forEach(rule => {
        db.run(
            'INSERT INTO freshness_rules (id, name, rule_type, condition, action, priority, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
            [rule.id, rule.name, rule.type, rule.condition, rule.action, rule.priority, now, now]
        );
        console.log(`   - ${rule.name}: ${rule.condition.substring(0, 30)}...`);
    });

    console.log('\n7. 创建引用追踪记录...');
    const references = [
        { id: uuidv4(), snippetId: snippets[0].id, questionId: 'q001', answerId: 'a001', context: '用户问：产品发布流程是什么？' },
        { id: uuidv4(), snippetId: snippets[1].id, questionId: 'q002', answerId: 'a002', context: '用户问：支持哪些登录方式？' },
        { id: uuidv4(), snippetId: snippets[3].id, questionId: 'q003', answerId: 'a003', context: '用户问：API设计有什么规范？' },
        { id: uuidv4(), snippetId: snippets[2].id, questionId: 'q004', answerId: 'a004', context: '用户问：v1 API什么时候停止？' }
    ];

    references.forEach(ref => {
        db.run(
            'INSERT INTO snippet_references (id, snippet_id, question_id, answer_id, reference_context, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [ref.id, ref.snippetId, ref.questionId, ref.answerId, ref.context, yesterday]
        );
        console.log(`   - ${ref.questionId} 引用了片段 ${ref.snippetId.substring(0, 8)}`);
    });

    console.log('\n测试数据填充完成！');
    console.log('\n测试场景说明：');
    console.log('✅ 成功场景：数据源"产品文档库"抓取成功，任务成功完成');
    console.log('❌ 失败场景：数据源"知识库V2"抓取失败，任务执行失败');
    console.log('🔄 重复提交：创建任务时使用相同幂等Key会返回已有结果');
    console.log('🛠️  人工修正：有一个任务标记为人工修复状态');
    console.log('⚠️  过期检测：存在3个已过期的文档片段');
    console.log('📊 新鲜度报告：可以查看各数据源的新鲜度统计');

    db.close();
});
