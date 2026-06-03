#!/bin/bash
echo "========================================"
echo "线性回归残差复盘 - 演示脚本"
echo "========================================"

echo ""
echo "[1/3] 安装依赖..."
pip install -q -r requirements.txt

echo ""
echo "[2/3] 运行阿岚工作流程（模拟删除第5行）..."
python cli.py run sample_data.csv --delete-line 5

echo ""
echo "[3/3] 查看复盘记录列表..."
python cli.py list-records

echo ""
echo "========================================"
echo "演示完成！"
echo ""
echo "可用命令："
echo "  python cli.py show <导入ID>    - 查看复盘详情"
echo "  python cli.py export <导入ID>  - 导出复盘记录"
echo "  python cli.py supplement <导入ID> - 补录断档行"
echo "  python cli.py --help           - 查看所有命令"
echo "========================================"
