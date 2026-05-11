#!/bin/bash

set -e

echo "========================================"
echo "  相机镜头出租押金管理 CLI 演示"
echo "  完整流程: 登记 → 出库 → 归还 → 赔付 → 导出"
echo "========================================"
echo ""

echo "【准备工作】清理旧数据..."
rm -rf data/ exports/

echo ""
echo "===== 第1步: 添加器材 ====="
echo ""
echo "添加镜头: 索尼 FE 24-70mm F2.8"
./lensrent add-equipment --name "索尼 FE 24-70mm F2.8 GM" --type 镜头 --deposit 5000 --rate 200 --accessories "镜头盖,遮光罩,UV镜"

echo ""
echo "===== 第2步: 添加租客 ====="
echo ""
./lensrent add-renter --name "张三" --phone "13800138000"

echo ""
echo "===== 获取器材ID和租客ID ====="
EQ_ID=$(cat data/lensrent_db.yaml | grep -A1 "equipments:" | grep "id:" | head -1 | awk '{print $2}')
RT_ID=$(cat data/lensrent_db.yaml | grep -A1 "renters:" | grep "id:" | head -1 | awk '{print $2}')
echo "器材ID: $EQ_ID"
echo "租客ID: $RT_ID"

echo ""
echo "===== 第3步: 借出登记 (带出库验机) ====="
echo ""
echo "租期: 2026-05-01 → 2026-05-05 (4天)"
echo "押金: ¥5000 | 日租: ¥200"
echo "配件: 镜头盖,遮光罩,UV镜"
./lensrent rent-out --equipment-id "$EQ_ID" --renter-id "$RT_ID" \
    --start "2026-05-01" --end "2026-05-05" \
    --accessories "镜头盖,遮光罩,UV镜" \
    --check "外观完好" --check "功能正常" --check "配件齐全" \
    --yes

echo ""
echo "===== 获取订单ID ====="
RN_ID=$(cat data/lensrent_db.yaml | grep -A1 "rentals:" | grep "id:" | head -1 | awk '{print $2}')
echo "订单ID: $RN_ID"

echo ""
echo "===== 第4步: 归还登记 (逾期1天 + 配件缺失) ====="
echo ""
echo "实际归还: 2026-05-06 (逾期1天)"
echo "归还配件: 只有镜头盖 (遮光罩和UV镜缺失)"
./lensrent rent-in --id "$RN_ID" \
    --return-date "2026-05-06" \
    --accessories "镜头盖" \
    --check "外观完好" --check "功能正常" \
    --yes

echo ""
echo "===== 查看订单详情 ====="
echo ""
./lensrent show --id "$RN_ID"

echo ""
echo "===== 第5步: 赔付处理 (镜头有划痕) ====="
echo ""
echo "赔付金额: ¥500 (镜头镀膜划伤需维修)"
./lensrent compensate --id "$RN_ID" --amount 500 --note "镜头镀膜划伤需维修" --yes

echo ""
echo "===== 查看赔付后订单详情 ====="
echo ""
./lensrent show --id "$RN_ID"

echo ""
echo "===== 第6步: 导出数据 ====="
echo ""
echo "导出订单数据..."
./lensrent export-rentals

echo ""
echo "导出争议记录..."
./lensrent export-disputes

echo ""
echo "导出争议汇总报告..."
./lensrent export-dispute-summary

echo ""
echo "导出订单详情..."
./lensrent export-detail --id "$RN_ID"

echo ""
echo "========================================"
echo "  演示完成!"
echo ""
echo "  数据文件: data/lensrent_db.yaml"
echo "  导出文件: exports/"
echo ""
echo "  结算明细:"
echo "    押金: ¥5000"
echo "    逾期1天: ¥200 × 1.5 = ¥300"
echo "    缺失配件2件: ¥50 × 2 = ¥100"
echo "    赔付: ¥500"
echo "    扣款合计: ¥900"
echo "    应退押金: ¥5000 - ¥900 = ¥4100"
echo "========================================"
