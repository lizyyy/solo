const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const loadJSON = (filename) => {
    const filepath = path.join(DATA_DIR, filename);
    if (fs.existsSync(filepath)) {
        return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
    return [];
};

const saveJSON = (filename, data) => {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
};

app.get('/api/data', (req, res) => {
    res.json({
        pickupOrders: loadJSON('pickup-orders.json'),
        careProcesses: loadJSON('care-processes.json'),
        reviewRecords: loadJSON('review-records.json'),
        expressAppointments: loadJSON('express-appointments.json'),
        recheckResults: loadJSON('recheck-results.json'),
        overrides: loadJSON('overrides.json'),
        notes: loadJSON('notes.json')
    });
});

app.post('/api/data/pickup-orders', (req, res) => {
    const data = req.body;
    saveJSON('pickup-orders.json', data);
    res.json({ success: true, message: '取件单数据已保存' });
});

app.post('/api/data/care-processes', (req, res) => {
    const data = req.body;
    saveJSON('care-processes.json', data);
    res.json({ success: true, message: '护理工序数据已保存' });
});

app.post('/api/data/review-records', (req, res) => {
    const data = req.body;
    saveJSON('review-records.json', data);
    res.json({ success: true, message: '复查记录数据已保存' });
});

app.post('/api/data/express-appointments', (req, res) => {
    const data = req.body;
    saveJSON('express-appointments.json', data);
    res.json({ success: true, message: '快递预约数据已保存' });
});

app.post('/api/data/recheck-results', (req, res) => {
    const data = req.body;
    saveJSON('recheck-results.json', data);
    res.json({ success: true, message: '复核结果已保存' });
});

app.post('/api/data/overrides', (req, res) => {
    const data = req.body;
    saveJSON('overrides.json', data);
    res.json({ success: true, message: '人工改判已保存' });
});

app.post('/api/data/notes', (req, res) => {
    const data = req.body;
    saveJSON('notes.json', data);
    res.json({ success: true, message: '备注已保存' });
});

app.post('/api/recheck', (req, res) => {
    const { pickupOrders, careProcesses, reviewRecords, expressAppointments } = req.body;
    const results = [];

    pickupOrders.forEach(order => {
        const issues = [];
        const orderProcesses = careProcesses.filter(p => p.orderId === order.id);
        const hasProcesses = orderProcesses.length > 0;
        const allProcessesCompleted = orderProcesses.every(p => p.status === 'completed');
        
        if (!hasProcesses) {
            issues.push({ type: 'missing_care', message: '未找到护理工序记录', severity: 'error' });
        } else if (!allProcessesCompleted) {
            const incomplete = orderProcesses.filter(p => p.status !== 'completed');
            issues.push({ 
                type: 'incomplete_care', 
                message: `有 ${incomplete.length} 道护理工序未完成`, 
                severity: 'error',
                details: incomplete.map(p => p.name)
            });
        }

        const orderReviews = reviewRecords.filter(r => r.orderId === order.id);
        const failedReviews = orderReviews.filter(r => r.passed === false);
        
        if (failedReviews.length > 0) {
            issues.push({ 
                type: 'review_failed', 
                message: `有 ${failedReviews.length} 条复查记录未通过`, 
                severity: 'error',
                details: failedReviews.map(r => r.description)
            });
        }

        const expressAppt = expressAppointments.find(a => a.orderId === order.id);
        
        if (order.deliveryType === 'express') {
            if (!expressAppt) {
                issues.push({ 
                    type: 'missing_express', 
                    message: '快递信息缺失', 
                    severity: 'error' 
                });
            } else {
                if (expressAppt.pickupTime && order.pickupTime) {
                    const exprDate = new Date(expressAppt.pickupTime);
                    const orderDate = new Date(order.pickupTime);
                    const timeDiff = Math.abs(exprDate - orderDate) / (1000 * 60 * 60);
                    
                    if (timeDiff < 2) {
                        issues.push({ 
                            type: 'time_conflict', 
                            message: '取件时间与快递预约时间冲突（间隔小于2小时）', 
                            severity: 'warning',
                            details: {
                                orderPickupTime: order.pickupTime,
                                expressPickupTime: expressAppt.pickupTime
                            }
                        });
                    }
                }
            }
        }

        results.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            clothingType: order.clothingType,
            status: issues.length > 0 ? 'issues' : 'ok',
            issues: issues,
            pickupTime: order.pickupTime,
            deliveryType: order.deliveryType
        });
    });

    res.json(results);
});

app.post('/api/export/markdown', (req, res) => {
    const { recheckResults, overrides, notes, pickupOrders, careProcesses, reviewRecords, expressAppointments } = req.body;
    
    let markdown = '# 婚纱礼服交付复核清单\n\n';
    markdown += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    markdown += '---\n\n';

    const issueOrders = recheckResults.filter(r => {
        const override = overrides.find(o => o.orderId === r.orderId);
        if (override && override.newStatus === 'ok') return false;
        return r.status === 'issues';
    });

    const okOrders = recheckResults.filter(r => {
        const override = overrides.find(o => o.orderId === r.orderId);
        if (override && override.newStatus === 'ok') return true;
        return r.status === 'ok';
    });

    if (issueOrders.length > 0) {
        markdown += `## ⚠️ 存在问题的订单 (${issueOrders.length})\n\n`;
        
        issueOrders.forEach((result, index) => {
            const orderNote = notes.find(n => n.orderId === result.orderId);
            const order = pickupOrders.find(o => o.id === result.orderId);
            const override = overrides.find(o => o.orderId === result.orderId);

            markdown += `### ${index + 1}. 订单编号: ${result.orderNumber}\n\n`;
            markdown += `- **客户姓名**: ${result.customerName}\n`;
            markdown += `- **衣物类型**: ${result.clothingType}\n`;
            markdown += `- **取件时间**: ${result.pickupTime || '未安排'}\n`;
            markdown += `- **交付方式**: ${result.deliveryType === 'express' ? '快递' : '自取'}\n`;
            
            if (override) {
                markdown += `- **人工改判**: ${override.newStatus === 'ok' ? '已放行' : '标记问题'}\n`;
                markdown += `- **改判原因**: ${override.reason || '未填写'}\n`;
            }

            markdown += `\n**问题列表**:\n\n`;
            result.issues.forEach(issue => {
                const icon = issue.severity === 'error' ? '🔴' : '🟡';
                markdown += `${icon} **${issue.type}**: ${issue.message}\n`;
                if (issue.details && Array.isArray(issue.details)) {
                    issue.details.forEach(d => markdown += `  - ${d}\n`);
                }
                markdown += '\n';
            });

            if (orderNote) {
                markdown += `**备注**: ${orderNote.content}\n\n`;
            }

            markdown += '---\n\n';
        });
    }

    if (okOrders.length > 0) {
        markdown += `## ✅ 可放行的订单 (${okOrders.length})\n\n`;
        
        markdown += '| 序号 | 订单编号 | 客户姓名 | 衣物类型 | 取件时间 | 交付方式 | 备注 |\n';
        markdown += '|------|----------|----------|----------|----------|----------|------|\n';
        
        okOrders.forEach((result, index) => {
            const orderNote = notes.find(n => n.orderId === result.orderId);
            const override = overrides.find(o => o.orderId === result.orderId);
            
            let remark = orderNote ? orderNote.content : '';
            if (override && override.newStatus === 'ok') {
                remark = remark ? remark + ' (人工放行)' : '(人工放行)';
            }

            markdown += `| ${index + 1} | ${result.orderNumber} | ${result.customerName} | ${result.clothingType} | ${result.pickupTime || '未安排'} | ${result.deliveryType === 'express' ? '快递' : '自取'} | ${remark} |\n`;
        });
        
        markdown += '\n';
    }

    markdown += '---\n\n';
    markdown += '## 统计信息\n\n';
    markdown += `- 总订单数: ${recheckResults.length}\n`;
    markdown += `- 可放行: ${okOrders.length}\n`;
    markdown += `- 存在问题: ${issueOrders.length}\n`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=复核清单_${new Date().toISOString().split('T')[0]}.md`);
    res.send(markdown);
});

app.post('/api/export/json', (req, res) => {
    const data = req.body;
    const exportData = {
        exportTime: new Date().toISOString(),
        orders: data.pickupOrders.map(order => {
            const result = data.recheckResults.find(r => r.orderId === order.id);
            const override = data.overrides.find(o => o.orderId === order.id);
            const note = data.notes.find(n => n.orderId === order.id);
            const processes = data.careProcesses.filter(p => p.orderId === order.id);
            const reviews = data.reviewRecords.filter(r => r.orderId === order.id);
            const express = data.expressAppointments.find(a => a.orderId === order.id);

            return {
                orderId: order.id,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                clothingType: order.clothingType,
                pickupTime: order.pickupTime,
                deliveryType: order.deliveryType,
                finalStatus: override ? override.newStatus : (result ? result.status : 'unknown'),
                originalStatus: result ? result.status : 'unknown',
                issues: result ? result.issues : [],
                override: override || null,
                note: note ? note.content : null,
                careProcesses: processes,
                reviewRecords: reviews,
                expressAppointment: express || null
            };
        })
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=复核明细_${new Date().toISOString().split('T')[0]}.json`);
    res.send(JSON.stringify(exportData, null, 2));
});

app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  婚纱礼服交付复核工具已启动`);
    console.log(`  访问地址: http://localhost:${PORT}`);
    console.log(`========================================\n`);
});
