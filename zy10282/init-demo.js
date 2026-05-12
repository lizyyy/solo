const db = require('./database');

const orders = [
    {
        id: 'demo_normal_001',
        order_no: 'AZ20240501001',
        customer_name: '张先生',
        customer_phone: '13800138001',
        customer_address: '北京市朝阳区望京街道123号',
        product_name: '智能马桶盖',
        installer_name: '李师傅',
        install_date: '2024-05-01',
        status: 'closed',
        created_at: '2024-05-01T09:00:00.000Z',
        updated_at: '2024-05-03T16:00:00.000Z'
    },
    {
        id: 'demo_rework_002',
        order_no: 'AZ20240502002',
        customer_name: '王女士',
        customer_phone: '13800138002',
        customer_address: '上海市浦东新区张江路456号',
        product_name: '净水器',
        installer_name: '赵师傅',
        install_date: '2024-05-02',
        status: 'closed',
        created_at: '2024-05-02T10:00:00.000Z',
        updated_at: '2024-05-06T14:00:00.000Z'
    }
];

const visits = [
    {
        id: 'v1',
        order_id: 'demo_normal_001',
        visitor_name: '客服小王',
        visit_date: '2024-05-02T14:00:00.000Z',
        satisfaction: 5,
        feedback: '安装师傅服务很好，讲解清楚',
        issues: null,
        created_at: '2024-05-02T14:00:00.000Z'
    },
    {
        id: 'v2',
        order_id: 'demo_rework_002',
        visitor_name: '客服小李',
        visit_date: '2024-05-03T15:30:00.000Z',
        satisfaction: 2,
        feedback: '客户反映安装后还有漏水问题',
        issues: '排水管缺失,漏水',
        created_at: '2024-05-03T15:30:00.000Z'
    }
];

const parts = [
    {
        id: 'p1',
        order_id: 'demo_rework_002',
        part_name: '排水管',
        quantity: 1,
        status: 'sent',
        sender: '仓库小张',
        send_date: '2024-05-04T10:00:00.000Z',
        created_at: '2024-05-03T16:00:00.000Z'
    }
];

const reworks = [
    {
        id: 'r1',
        order_id: 'demo_rework_002',
        reason: '安装漏水,缺少排水管',
        reworker_name: '赵师傅',
        rework_date: '2024-05-05T09:00:00.000Z',
        status: 'completed',
        satisfaction_after: 5,
        created_at: '2024-05-03T17:00:00.000Z'
    }
];

const settlements = [
    {
        id: 's1',
        order_id: 'demo_normal_001',
        base_amount: 100,
        deduction: 0,
        bonus: 20,
        final_amount: 120,
        settled_by: '财务小陈',
        settle_date: '2024-05-03T16:00:00.000Z',
        remarks: '客户好评,发奖金',
        created_at: '2024-05-03T16:00:00.000Z'
    },
    {
        id: 's2',
        order_id: 'demo_rework_002',
        base_amount: 100,
        deduction: 30,
        bonus: 0,
        final_amount: 70,
        settled_by: '财务小陈',
        settle_date: '2024-05-06T14:00:00.000Z',
        remarks: '返工扣款30元',
        created_at: '2024-05-06T14:00:00.000Z'
    }
];

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function init() {
    try {
        for (const o of orders) {
            await dbRun(`
                INSERT OR IGNORE INTO installation_orders 
                (id, order_no, customer_name, customer_phone, customer_address, product_name, installer_name, install_date, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [o.id, o.order_no, o.customer_name, o.customer_phone, o.customer_address, o.product_name, o.installer_name, o.install_date, o.status, o.created_at, o.updated_at]);
        }
        
        for (const v of visits) {
            await dbRun(`
                INSERT OR IGNORE INTO visits 
                (id, order_id, visitor_name, visit_date, satisfaction, feedback, issues, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [v.id, v.order_id, v.visitor_name, v.visit_date, v.satisfaction, v.feedback, v.issues, v.created_at]);
        }
        
        for (const p of parts) {
            await dbRun(`
                INSERT OR IGNORE INTO parts 
                (id, order_id, part_name, quantity, status, sender, send_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [p.id, p.order_id, p.part_name, p.quantity, p.status, p.sender, p.send_date, p.created_at]);
        }
        
        for (const r of reworks) {
            await dbRun(`
                INSERT OR IGNORE INTO reworks 
                (id, order_id, reason, reworker_name, rework_date, status, satisfaction_after, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [r.id, r.order_id, r.reason, r.reworker_name, r.rework_date, r.status, r.satisfaction_after, r.created_at]);
        }
        
        for (const s of settlements) {
            await dbRun(`
                INSERT OR IGNORE INTO settlements 
                (id, order_id, base_amount, deduction, bonus, final_amount, settled_by, settle_date, remarks, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [s.id, s.order_id, s.base_amount, s.deduction, s.bonus, s.final_amount, s.settled_by, s.settle_date, s.remarks, s.created_at]);
        }
        
        console.log('演示数据已初始化完成！');
        console.log('包含两条演示链路：');
        console.log('1. 正常安装 - 张先生 智能马桶盖 - 满意度5分 - 奖金20元');
        console.log('2. 返工安装 - 王女士 净水器 - 缺排水管返工 - 扣款30元 - 返工后满意度5分');
    } catch (err) {
        console.error('初始化失败:', err);
    }
    process.exit(0);
}

init();
