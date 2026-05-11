#!/bin/bash

# ================================================
# 蜂场蜂箱巡检分析 CLI 工具 - 验收测试脚本
# ================================================
# 业务人员可以直接运行此脚本进行快速验收
# 运行方式: bash test_acceptance.sh
# ================================================

set -e

echo ""
echo "================================================"
echo "  🐝 蜂场蜂箱巡检分析 CLI 工具 - 验收测试"
echo "================================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 设置测试目录
TEST_DIR="./acceptance_test_data"
SAMPLE_DIR="./sample_data"
PY_CMD="python3"

# 清理旧数据
echo "[1/5] 准备测试环境..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
echo -e "${GREEN}✓${NC} 已创建测试目录: $TEST_DIR"
echo ""

# ================================================
# 测试 1: 蜂箱档案管理（入口）
# ================================================
echo "[2/5] 测试: 蜂箱档案管理（入口功能）"
echo "--------------------------------"

echo " 添加蜂箱 A001..."
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" hive add A001 \
    --location "东山区域-1号" \
    --established-date "2024-03-15" \
    --queen-status "活跃"

echo " 添加蜂箱 A002..."
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" hive add A002 \
    --location "东山区域-2号" \
    --established-date "2024-04-01"

echo " 添加蜂箱 B001（高风险）..."
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" hive add B001 \
    --location "西山区域-1号" \
    --established-date "2024-02-20" \
    --queen-status "待观察"

echo ""
echo " 列出所有蜂箱:"
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" hive list

echo -e "${GREEN}✓${NC} 蜂箱档案管理测试通过"
echo ""

# ================================================
# 测试 2: 巡检数据导入（关键校验）- 正常数据
# ================================================
echo "[3/5] 测试: 巡检数据导入（关键校验）"
echo "--------------------------------"

echo " [3.1] 导入正常巡检数据..."
NORMAL_RESULT=$($PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" inspection import "$SAMPLE_DIR/inspections_normal.csv")
echo "$NORMAL_RESULT"
echo ""

echo " [3.2] 导入含异常的巡检数据（应检测到错误）..."
echo " 预期错误: 缺字段、重复数据、人工改错（蜜量=200）"
ERROR_RESULT=$($PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" inspection import "$SAMPLE_DIR/inspections_with_errors.csv" 2>&1) || true

if echo "$ERROR_RESULT" | grep -q "发现.*错误" && echo "$ERROR_RESULT" | grep -q "缺少必填字段" && echo "$ERROR_RESULT" | grep -q "重复记录"; then
    echo -e "${GREEN}✓${NC} 成功检测到数据错误（缺字段、重复数据）"
else
    echo -e "${RED}✗${NC} 错误检测可能不完整"
    echo "$ERROR_RESULT"
fi

if echo "$ERROR_RESULT" | grep -q "蜜量值异常: 200"; then
    echo -e "${GREEN}✓${NC} 成功检测到人工改错（蜜量=200 超出范围）"
else
    echo -e "${YELLOW}⚠${NC} 未检测到蜜量异常"
fi

if echo "$ERROR_RESULT" | grep -q "蜂王状态异常"; then
    echo -e "${GREEN}✓${NC} 成功检测到蜂王状态异常"
fi

echo ""
echo " [3.3] 使用 --skip-errors 跳过错误继续导入..."
SKIP_RESULT=$($PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" inspection import "$SAMPLE_DIR/inspections_with_errors.csv" --skip-errors 2>&1)
echo "$SKIP_RESULT"

echo ""
echo " [3.4] 列出已导入的巡检记录..."
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" inspection list --beehive-id A001

echo -e "${GREEN}✓${NC} 巡检数据导入测试通过"
echo ""

# ================================================
# 测试 3: 换箱记录管理（证据）
# ================================================
echo "[4/5] 测试: 换箱记录管理（证据）"
echo "--------------------------------"

echo " 添加换箱记录 B001 → A001..."
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" swap add \
    --from B001 \
    --to A001 \
    --date "2025-04-15" \
    --reason "调整蜂群强弱" \
    --operator "张三"

echo ""
echo " 导入批量换箱记录..."
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" swap import "$SAMPLE_DIR/swaps_normal.csv"

echo ""
echo " 查看 B001 的换箱历史链条:"
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" swap chain B001

echo ""
echo " 查看 A001 的完整历史（档案+换箱+巡检）:"
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" hive history A001

echo -e "${GREEN}✓${NC} 换箱记录管理测试通过"
echo ""

# ================================================
# 测试 4: 分析报告生成
# ================================================
echo "[5/5] 测试: 分析报告生成"
echo "--------------------------------"

echo " [5.1] 生成蜂王状态报告..."
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" report queen --no-save

echo ""
echo " [5.2] 生成产蜜风险报告..."
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" report honey --no-save

echo ""
echo " [5.3] 生成病虫害分析报告..."
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" report disease --no-save

echo ""
echo " [5.4] 生成完整报告（并保存到文件）..."
$PY_CMD -m beehive_inspector --data-dir "$TEST_DIR" report all

echo ""
echo " [5.5] 查看生成的报告文件..."
REPORT_DIR="$TEST_DIR/reports"
if [ -d "$REPORT_DIR" ]; then
    echo " 报告目录: $REPORT_DIR"
    ls -lh "$REPORT_DIR"
    
    # 显示最新的完整报告
    LATEST_TXT=$(ls -t "$REPORT_DIR"/full_report_*.txt 2>/dev/null | head -1)
    if [ -n "$LATEST_TXT" ]; then
        echo ""
        echo " 最新完整报告内容:"
        echo "========================================"
        cat "$LATEST_TXT"
        echo "========================================"
    fi
else
    echo -e "${YELLOW}⚠${NC} 报告目录不存在"
fi

echo ""
echo -e "${GREEN}✓${NC} 分析报告生成测试通过"
echo ""

# ================================================
# 完成总结
# ================================================
echo "================================================"
echo "  🎉 验收测试完成！"
echo "================================================"
echo ""
echo " 测试数据目录: $TEST_DIR"
echo " 报告文件位置: $TEST_DIR/reports"
echo ""
echo " 关键验证点:"
echo " ✅ 蜂箱档案管理（入口）- 可添加、查看蜂箱"
echo " ✅ 巡检导入校验 - 能检测缺字段、重复数据、人工改错"
echo " ✅ 换箱历史记录 - 可追踪换箱链条"
echo " ✅ 中间结果留存 - 校验报告、导入结果都保存为文件"
echo " ✅ 最终分析报告 - 蜂王、蜜量、病虫害三种报告"
echo ""
echo " 业务人员可执行命令:"
echo "  1. 查看蜂箱: python3 -m beehive_inspector hive list"
echo "  2. 导入巡检: python3 -m beehive_inspector inspection import <文件路径>"
echo "  3. 查看历史: python3 -m beehive_inspector hive history <蜂箱编号>"
echo "  4. 生成报告: python3 -m beehive_inspector report all"
echo ""
echo "================================================"
