#!/bin/bash

set -e

echo "========================================"
echo "  消息重放审批服务 - 演示脚本"
echo "========================================"
echo ""

# 检查 Python 版本
if ! command -v python3 &> /dev/null; then
    echo "错误: 请先安装 Python 3.8+"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Python 版本: $PYTHON_VERSION"
echo ""

# 创建虚拟环境
if [ ! -d ".venv" ]; then
    echo "步骤 1: 创建虚拟环境..."
    python3 -m venv .venv
else
    echo "步骤 1: 虚拟环境已存在，跳过"
fi
echo ""

# 激活虚拟环境
echo "步骤 2: 激活虚拟环境并安装依赖..."
source .venv/bin/activate
pip install -e ".[dev]" -q
echo "依赖安装完成"
echo ""

# 初始化数据库
echo "步骤 3: 初始化数据库..."
mrs init database
echo ""

# 生成示例数据
echo "步骤 4: 生成示例消息数据..."
mrs init sample-data --count 20
echo ""

# 查看消息列表
echo "步骤 5: 查看消息列表..."
mrs message list --limit 10
echo ""

# 定位消息
echo "步骤 6: 定位消息（按业务类型）..."
mrs message locate \
    --scope-type business_ids \
    --scope-value '{"business_type": "order", "business_ids": ["BUS-000001", "BUS-000005", "BUS-000009"]}'
echo ""

# 创建重放请求
echo "步骤 7: 创建重放请求..."
REQUEST_OUTPUT=$(mrs request create \
    --requester "张三" \
    --reason "订单数据修复，需要重新处理这3条消息" \
    --scope-type business_ids \
    --scope-value '{"business_type": "order", "business_ids": ["BUS-000001", "BUS-000005", "BUS-000009"]}' \
    --target-env prod \
    --rate-sec 5)

# 提取请求ID（实际中需要更复杂的解析）
echo ""
echo "请从上面的输出中复制 Request ID，然后继续执行以下步骤："
echo ""
echo "步骤 8: 审批重放请求"
echo "  mrs request approve <REQUEST_ID> --approver 李四 --comment '同意重放'"
echo ""
echo "步骤 9: 执行重放（试运行）"
echo "  mrs request execute <REQUEST_ID> --executor 王五 --dry-run"
echo ""
echo "步骤 10: 执行重放（正式执行）"
echo "  mrs request execute <REQUEST_ID> --executor 王五"
echo ""
echo "步骤 11: 查看报告"
echo "  mrs report show <REPORT_ID>"
echo ""
echo "步骤 12: 导出报告"
echo "  mrs report export <REPORT_ID> --format json --output ./report.json"
echo "  mrs report export <REPORT_ID> --format csv --output ./report.csv"
echo ""
echo "========================================"
echo "  演示脚本执行完毕"
echo "========================================"
