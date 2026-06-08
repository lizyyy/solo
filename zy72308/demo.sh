#!/bin/bash
echo "========================================"
echo " 线性回归残差复盘 v2.0 - 演示脚本"
echo " 重点: 展示/接口/导出同源 + 补录后重算"
echo "========================================"

echo ""
echo "[1/4] 安装依赖 (含Excel支持 openpyxl)..."
pip3 install -q -r requirements.txt

echo ""
echo "[2/4] 清理旧测试数据..."
rm -rf data/

echo ""
echo "[3/4] 运行完整流程: 导入→删除行5→补录行5(4.9,9.8)→教研组复核→批注→参数更新"
python3 cli.py run sample_data.csv \
  --delete-line 5 \
  --supplement-line 5 \
  --supplement-x 4.9 \
  --supplement-y 9.8

echo ""
echo "[4/4] 查看最新记录详情 + 变更历史"
IMP_ID=$(python3 -c "
from residual_review.storage import StorageManager
s = StorageManager()
ids = s.list_records()
print(ids[0] if ids else '')
")
if [ -n "$IMP_ID" ]; then
  echo "  最新导入ID: $IMP_ID"
  echo ""
  echo "  --- show 详情 ---"
  python3 cli.py show "$IMP_ID"
  echo ""
  echo "  --- 变更历史 ---"
  python3 cli.py history "$IMP_ID"
  echo ""
  echo "  --- 导出 4 份同源文件 ---"
  python3 cli.py export "$IMP_ID"
fi

echo ""
echo "========================================"
echo "演示完成！"
echo ""
echo "核心命令速查:"
echo "  python3 cli.py run <文件> --delete-line N --supplement-line M --supplement-x X --supplement-y Y"
echo "  python3 cli.py import <文件>                  # 步骤1: 多源导入(CSV/Excel)"
echo "  python3 cli.py delete <导入ID> <行号>          # 人工删除→断档标记"
echo "  python3 cli.py supplement <导入ID> <行号> X Y  # 补录→自动重算→待复核"
echo "  python3 cli.py review <导入ID> <行号> --approve/--reject  # 教研组复核"
echo "  python3 cli.py annotate <导入ID> <行号> <批注>  # 步骤2: 添加批注"
echo "  python3 cli.py recalc <导入ID>                  # 步骤3: 参数更新+重算"
echo "  python3 cli.py show <导入ID> --with-history    # 同源详情+历史"
echo "  python3 cli.py history <导入ID> --line N       # 变更历史"
echo "  python3 cli.py list                             # 记录列表"
echo "  python3 cli.py export <导入ID>                  # 导出4份同源"
echo "========================================"
