#!/bin/bash
set -e

echo "=============================================="
echo "  宠物寄养加餐用药 CLI - 完整演示"
echo "=============================================="
echo ""

cd "$(dirname "$0")"

[ -f pet_boarding.db ] && rm pet_boarding.db

echo "--- 步骤 1: 安装依赖 ---"
python3 -m pip install click -q
echo "✓ click 已安装"
echo ""

echo "--- 步骤 2: 添加主人和宠物 ---"
python3 pet_cli.py owner add --name "张小明" --phone "13800138001"
python3 pet_cli.py pet add --name "旺财" --owner-phone "13800138001" --species "狗" --breed "金毛" --age 3 --allergies "阿莫西林"
echo ""

echo "--- 步骤 3: 办理入住 (5月11日入住, 计划5晚) ---"
python3 pet_cli.py check-in \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --check-in "2026-05-11" \
    --nights 5 \
    --room-type "豪华间" \
    --daily-rate 200
echo ""

echo "--- 步骤 4: 验证重复入住 (应该失败) ---"
python3 pet_cli.py check-in \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --check-in "2026-05-11" \
    --nights 5
echo ""

echo "--- 步骤 5: 入住时加一份加餐 ---"
python3 pet_cli.py service add-meal \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --meal-type "进口牛肉罐头" \
    --quantity 1 \
    --price 50 \
    --service-date "2026-05-11"
echo ""

echo "--- 步骤 6: 重复添加同一加餐 (应该提示已存在) ---"
python3 pet_cli.py service add-meal \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --meal-type "进口牛肉罐头" \
    --quantity 1 \
    --price 50 \
    --service-date "2026-05-11"
echo ""

echo "--- 步骤 7: 主人半夜微信追加用药 (过敏警告场景) ---"
echo "⚠️  注意: 旺财对阿莫西林过敏，但主人没注意..."
python3 pet_cli.py add-medication \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --name "阿莫西林" \
    --dosage "0.5g" \
    --frequency "bid" \
    --start-date "2026-05-12"
echo ""

echo "--- 步骤 7b: 验证重复提交同一过敏用药 (应该提示已存在，且不新增过敏提醒) ---"
python3 pet_cli.py add-medication \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --name "阿莫西林" \
    --dosage "0.5g" \
    --frequency "bid" \
    --start-date "2026-05-12"
echo ""

echo "--- 验证: 过敏提醒表记录数应该是 1 条 ---"
allergy_count=$(python3 -c "
import sqlite3
conn = sqlite3.connect('pet_boarding.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM allergy_alerts')
print(cursor.fetchone()[0])
conn.close()
")
echo "  allergy_alerts 记录数: $allergy_count (预期: 1)"
if [ "$allergy_count" -eq 1 ]; then
    echo "  ✓ 验证通过: 重复提交没有新增过敏提醒"
else
    echo "  ✗ 验证失败: 预期 1 条，实际 $allergy_count 条"
fi
echo ""

echo "--- 步骤 8: 正确的用药 (无过敏) ---"
python3 pet_cli.py add-medication \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --name "益生菌" \
    --dosage "1袋" \
    --frequency "qd" \
    --start-date "2026-05-11" \
    --price 8
echo ""

echo "--- 步骤 9: 添加洗护服务 ---"
python3 pet_cli.py service add-grooming \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --grooming-type "洗澡+修剪" \
    --price 120 \
    --service-date "2026-05-14"
echo ""

echo "--- 步骤 10: 主人中途又追加另一份加餐 ---"
python3 pet_cli.py service add-meal \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --meal-type "磨牙棒" \
    --quantity 2 \
    --price 15 \
    --service-date "2026-05-13"
echo ""

echo "--- 步骤 11: 查看异常提醒 (有过敏警告) ---"
python3 pet_cli.py alerts << EOF
n
EOF
echo ""

echo "--- 步骤 12: 假设今天是5月13日, 用药打卡 (模拟) ---"
echo "注意: check-med 是交互式的, 实际使用时需要输入序号"
echo "这里演示流程, 不真正执行打卡..."
echo ""

echo "--- 步骤 13: 主人提前接走 (提前2天) ---"
echo "  预期账单验证：房费5晚=1000，退款2晚=400，实际房费=600，服务=348，总应付=948"
python3 pet_cli.py check-out \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --check-out-date "2026-05-14"
echo ""

echo "--- 验证: 账单数据正确性 ---"
python3 << 'EOF'
import sqlite3
conn = sqlite3.connect('pet_boarding.db')
cursor = conn.cursor()
cursor.execute('SELECT base_cost, services_cost, total_refunds, grand_total FROM bills')
row = cursor.fetchone()
base_cost, services_cost, total_refunds, grand_total = row

print(f"  base_cost:     ¥{base_cost:.2f} (预期: ¥1000.00)")
print(f"  services_cost: ¥{services_cost:.2f} (预期: ¥348.00)")
print(f"  total_refunds: -¥{total_refunds:.2f} (预期: -¥400.00)")
print(f"  grand_total:   ¥{grand_total:.2f} (预期: ¥948.00)")

all_pass = True
if base_cost == 1000.0:
    print("  ✓ base_cost 正确")
else:
    print("  ✗ base_cost 错误")
    all_pass = False

if services_cost == 348.0:
    print("  ✓ services_cost 正确")
else:
    print("  ✗ services_cost 错误")
    all_pass = False

if total_refunds == 400.0:
    print("  ✓ total_refunds 正确")
else:
    print("  ✗ total_refunds 错误")
    all_pass = False

if grand_total == 948.0:
    print("  ✓ grand_total 正确")
else:
    print("  ✗ grand_total 错误")
    all_pass = False

if all_pass:
    print("\n  ✓✓✓ 所有验证通过! ✓✓✓")
else:
    print("\n  ✗✗✗ 存在验证失败 ✗✗✗")

conn.close()
EOF
echo ""

echo "--- 步骤 14: 验证重复结账 (应该失败) ---"
python3 pet_cli.py check-out \
    --owner-phone "13800138001" \
    --pet-name "旺财" \
    --check-out-date "2026-05-14"
echo ""

echo "--- 步骤 15: 清理并重新演示完整流程 (重复执行数据稳定) ---"
echo "再次执行同样的命令..."
[ -f pet_boarding.db ] && rm pet_boarding.db

python3 pet_cli.py owner add --name "张小明" --phone "13800138001"
python3 pet_cli.py pet add --name "旺财" --owner-phone "13800138001" --species "狗" --breed "金毛" --age 3 --allergies "阿莫西林"
python3 pet_cli.py check-in --owner-phone "13800138001" --pet-name "旺财" --check-in "2026-05-11" --nights 5 --room-type "豪华间" --daily-rate 200

echo ""
echo "=============================================="
echo "  演示完成!"
echo "=============================================="
echo ""
echo "可用命令:"
echo "  python3 pet_cli.py --help          查看所有命令"
echo "  python3 pet_cli.py owner --help    主人管理"
echo "  python3 pet_cli.py pet --help      宠物管理"
echo "  python3 pet_cli.py check-in        办理入住"
echo "  python3 pet_cli.py service --help  加餐/洗护服务"
echo "  python3 pet_cli.py add-medication  添加用药计划"
echo "  python3 pet_cli.py check-med       用药打卡"
echo "  python3 pet_cli.py alerts          异常提醒"
echo "  python3 pet_cli.py check-out       结账离店"
echo ""
