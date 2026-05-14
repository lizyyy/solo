#!/bin/bash

echo "========================================="
echo "    接口限流账本 - 快速启动脚本"
echo "========================================="
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js，请先安装 Node.js"
    exit 1
fi

echo "✅ Node.js 已检测"
echo ""

# 安装后端依赖
echo "📦 安装后端依赖..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
fi
echo ""

# 检查数据库是否存在，不存在则初始化示例数据
if [ ! -f "data/rate-limit-ledger.db" ]; then
    echo "🗄️  初始化示例数据..."
    node -e "
    const db = require('./src/models/database');
    const { v4: uuidv4 } = require('uuid');

    setTimeout(() => {
        const group1Id = uuidv4();
        const group2Id = uuidv4();
        db.run('INSERT INTO api_groups (id, name, description) VALUES (?, ?, ?)', [group1Id, '支付接口', '支付相关API接口']);
        db.run('INSERT INTO api_groups (id, name, description) VALUES (?, ?, ?)', [group2Id, '用户接口', '用户管理相关API']);

        const tenant1Id = uuidv4();
        const tenant2Id = uuidv4();
        db.run('INSERT INTO tenants (id, name, contact_email, status) VALUES (?, ?, ?, ?)', [tenant1Id, '客户A科技有限公司', 'contact@companya.com', 'active']);
        db.run('INSERT INTO tenants (id, name, contact_email, status) VALUES (?, ?, ?, ?)', [tenant2Id, '客户B电商平台', 'admin@companyb.com', 'active']);

        const quota1Id = uuidv4();
        const quota2Id = uuidv4();
        db.run('INSERT INTO tenant_quotas (id, tenant_id, api_group_id, daily_quota, monthly_quota, remaining_daily, remaining_monthly) VALUES (?, ?, ?, ?, ?, ?, ?)', [quota1Id, tenant1Id, group1Id, 10, 300, 10, 300]);
        db.run('INSERT INTO tenant_quotas (id, tenant_id, api_group_id, daily_quota, monthly_quota, remaining_daily, remaining_monthly) VALUES (?, ?, ?, ?, ?, ?, ?)', [quota2Id, tenant2Id, group1Id, 5, 150, 5, 150]);

        console.log('');
        console.log('📋 示例数据创建成功!');
        console.log('   租户ID:', tenant1Id, 'and', tenant2Id);
        console.log('   接口分组ID:', group1Id, 'and', group2Id);
        console.log('');
        
        setTimeout(() => process.exit(0), 500);
    }, 200);
    "
fi
echo ""

# 启动后端服务
echo "🚀 启动后端服务 (端口 3001)..."
echo ""

if command -v open &> /dev/null; then
    (sleep 2 && open "../frontend/index.html") &
fi

npm start
