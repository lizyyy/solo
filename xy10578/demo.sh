#!/bin/bash



echo "========================================="
echo "  销售线索归因 CLI 演示脚本"
echo "========================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "[1/7] 安装依赖..."
pip install -e . -q
echo ""

echo "[2/7] 初始化数据库 (清除旧数据)..."
lead init --force
echo ""

echo "[3/7] 查看初始状态..."
lead status
echo ""

echo "[4/7] 添加黑名单测试..."
lead blacklist spam@example.com --type email --reason "垃圾邮箱，多次无效咨询" --operator "admin"
echo ""

echo "[5/7] 导入广告点击数据..."
lead import ads sample_data/ad_clicks.json
echo ""

echo "[6/7] 导入活动签到数据..."
lead import events sample_data/events.json
echo ""

echo "[7/7] 导入转介绍数据..."
lead import referrals sample_data/referrals.json
echo ""

echo "[8/8] 导入成交订单数据..."
lead import deals sample_data/deals.json
echo ""

echo "========================================="
echo "  数据一致性检查"
echo "========================================="
lead check
echo ""

echo "========================================="
echo "  运行归因计算"
echo "========================================="
python3 -c "
from lead_attribution.database import DatabaseManager
from lead_attribution.attribution_engine import AttributionEngine

db = DatabaseManager()
engine = AttributionEngine(db)
result = engine.run_attribution_for_all_deals()
print(f'处理了 {result[\"total_deals_processed\"]} 个订单')
for d in result['deals']:
    print(f'  - {d[\"deal_name\"]} ({d[\"customer\"]}): ¥{d[\"amount\"]:,.0f}')
"
echo ""

echo "========================================="
echo "  查看系统状态"
echo "========================================="
lead status
echo ""

echo "========================================="
echo "  归因报告"
echo "========================================="
lead report
echo ""

echo "========================================="
echo "  获取第一个订单ID进行详情查看"
echo "========================================="
FIRST_DEAL_ID=$(python3 -c "
import sqlite3
import os
db_path = os.path.join(os.getcwd(), '.lead_attribution', 'database.sqlite')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute('SELECT id FROM deals LIMIT 1')
row = cursor.fetchone()
print(row[0] if row else '')
conn.close()
")

if [ -n "$FIRST_DEAL_ID" ]; then
    echo "订单ID: $FIRST_DEAL_ID"
    echo ""
    lead detail "$FIRST_DEAL_ID"
    echo ""
fi

echo "========================================="
echo "  查看操作历史"
echo "========================================="
lead history --limit 10
echo ""

echo "========================================="
echo "  演示人工调整归因"
echo "========================================="
if [ -n "$FIRST_DEAL_ID" ]; then
    lead adjust "$FIRST_DEAL_ID" \
        --attr-type last_touch \
        --source referral:60 \
        --source ad:40 \
        --operator "销售经理" \
        --reason "根据实际业务情况，该订单主要来自转介绍"
    echo ""
fi

echo "========================================="
echo "  查看调整后的报告"
echo "========================================="
lead report --type last
echo ""

echo "========================================="
echo "  失败案例演示"
echo "========================================="
echo "1. 测试重复导入（应该显示重复记录）"
lead import ads sample_data/ad_clicks.json
echo ""

echo "2. 测试导入包含黑名单的数据"
lead import ads sample_data/failure_case.json
echo ""

echo "========================================="
echo "  演示完成！"
echo "========================================="
echo ""
echo "可用命令："
echo "  lead status          - 查看系统状态"
echo "  lead check           - 检查数据一致性"
echo "  lead report          - 查看归因报告"
echo "  lead detail <id>     - 查看订单详情"
echo "  lead history         - 查看操作历史"
echo "  lead adjust          - 人工调整归因"
echo "  lead blacklist       - 添加黑名单"
