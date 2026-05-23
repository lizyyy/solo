#!/bin/bash
# 物业抄表CLI工具运行脚本

echo "物业水电抄表 CLI 工具"
echo "======================"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "错误: 请先安装 Python 3"
    exit 1
fi

# 检查依赖
echo "检查依赖..."
python3 -c "import click, pandas, openpyxl, rich" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "安装依赖中..."
    pip3 install click pandas openpyxl rich -q
fi

echo ""
echo "可用命令:"
echo "  1. 生成示例数据: python3 -m property_meter.cli example"
echo "  2. 处理干净数据: python3 -m property_meter.cli process test_clean.csv"
echo "  3. 处理脏数据  : python3 -m property_meter.cli process test_dirty.csv -t 1.5"
echo "  4. 带缺表检测  : python3 -m property_meter.cli process test_clean.csv -r test_reference.csv"
echo "  5. 运行测试    : python3 test_cli.py"
echo "  6. 查看帮助    : python3 -m property_meter.cli --help"
echo ""

# 运行测试
read -p "是否运行完整测试? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    python3 test_cli.py
fi
