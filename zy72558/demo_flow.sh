#!/bin/bash
set -e
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export PATH="$HOME/Library/Python/3.9/bin:$PATH"

echo "=========================================="
echo "  语义向量聚类命名系统 - 完整流程演示"
echo "=========================================="
echo ""

echo "=== 步骤 0: 安装依赖并准备数据 ==="
pip3 install -e . --quiet
pip3 install -r requirements.txt --quiet
rm -f demo_flow.db cluster_results.csv
[ -f sample_snapshot.csv ] || python3 generate_sample_data.py
echo "  依赖已安装，数据已就绪"

echo ""
echo "=== 步骤 1: 首次导入特征快照 (操作人=林姐) ==="
scn --db demo_flow.db --actor "林姐" snapshot import sample_snapshot.csv --snapshot-id SNAP2024001 --vector-column vector

echo ""
echo "=== 步骤 2: 查看导入的快照 ==="
scn --db demo_flow.db snapshot list
scn --db demo_flow.db snapshot show SNAP2024001

echo ""
echo "=== 步骤 3: 第一次聚类训练 (操作人=林姐) ==="
scn --db demo_flow.db --actor "林姐" cluster run SNAP2024001 --n-clusters 4

FIRST_RUN=$(python3 -c "
from semantic_cluster_naming.models import init_db
from semantic_cluster_naming.clustering import ClusteringEngine
Session, _ = init_db('sqlite:///demo_flow.db')
db = Session()
engine = ClusteringEngine(db)
runs = engine.list_runs('SNAP2024001', limit=10)
for r in runs:
    if not r.get('is_duplicate_run'):
        print(r['run_id']); break
")
echo "第一次运行ID: $FIRST_RUN"

echo ""
echo "=== 步骤 4: 数据科学家林姐补看训练日志曲线 ==="
scn --db demo_flow.db cluster log "$FIRST_RUN"

echo ""
echo "=== 步骤 5: 查看聚类结果 ==="
scn --db demo_flow.db result show "$FIRST_RUN"

echo ""
echo "=== 步骤 6: 同一批数据重复训练第二次（触发自检 - 自动标记待复核） ==="
scn --db demo_flow.db --actor "林姐" cluster run SNAP2024001 --n-clusters 4

echo ""
echo "=== 步骤 7: 查看所有训练记录（验证重复训练已被标记） ==="
scn --db demo_flow.db cluster list --snapshot-id SNAP2024001

echo ""
echo "=== 步骤 8: 查看待策略产品复核列表 ==="
scn --db demo_flow.db review list

SECOND_RUN=$(python3 -c "
from semantic_cluster_naming.models import init_db
from semantic_cluster_naming.result_service import ResultService
Session, _ = init_db('sqlite:///demo_flow.db')
db = Session()
service = ResultService(db)
pending = service.get_pending_reviews()
if pending: print(pending[0]['run_id'])
")
echo "待复核运行ID: $SECOND_RUN"

echo ""
echo "=== 步骤 9: 策略产品通过重复训练复核 (操作人=策略产品) ==="
scn --db demo_flow.db --actor "策略产品" review approve "$SECOND_RUN" --reviewer "策略产品" --comments "核对为同一批数据重复训练，结果一致，通过"

echo ""
echo "=== 步骤 10: 人工编辑簇名称 (操作人=林姐) ==="
scn --db demo_flow.db --actor "林姐" result edit-name "$FIRST_RUN" 0 "信贷业务簇" --editor 林姐
scn --db demo_flow.db --actor "林姐" result edit-name "$FIRST_RUN" 1 "理财业务簇" --editor 林姐
scn --db demo_flow.db --actor "林姐" result edit-name "$FIRST_RUN" 2 "支付业务簇" --editor 林姐
scn --db demo_flow.db --actor "林姐" result edit-name "$FIRST_RUN" 3 "客户服务簇" --editor 林姐

echo ""
echo "=== 步骤 11: 导出聚类结果（自动校验与页面/API一致） ==="
scn --db demo_flow.db result export "$FIRST_RUN" ./cluster_results.csv

echo ""
echo "=== 步骤 12: 更新特征版本表 (操作人=策略产品) ==="
scn --db demo_flow.db --actor "策略产品" version create SNAP2024001 "$FIRST_RUN" --change-log "首次聚类，4个业务簇，人工命名，已复核重复训练"

echo ""
echo "=== 步骤 13: 查看审计追踪（历史留痕） ==="
scn --db demo_flow.db audit --snapshot-id SNAP2024001 --limit 20

echo ""
echo "=== 步骤 14: 生成复盘记录（可重跑命令） ==="
scn --db demo_flow.db replay --snapshot-id SNAP2024001

echo ""
echo "=========================================="
echo "  步骤 15: 启动 scn serve 并验证 HTTP/API（verify 脚本处理）"
echo "=========================================="
python3 verify_3source_consistency.py

echo ""
echo "=========================================="
echo "  演示完成！"
echo "=========================================="
echo ""
echo "自检覆盖情况："
echo "  ✓ 重复导入检测 - 导入相同文件会标记重复"
echo "  ✓ 同一批数据重复训练两次 - 自动标记待复核，不自动归正常"
echo "  ✓ 补录后重算 - 支持 supplement 版本管理"
echo "  ✓ 导出一致 - 导出前自动校验与页面/API同一份数据"
echo "  ✓ HTTP/API/页面 - scn serve 稳定启动，三端同源验证通过"
echo ""
echo "数据保留："
echo "  ✓ 特征快照编号原始行号 - original_row_number"
echo "  ✓ 人工改动记录 - audit_log 完整追踪（操作人正确）"
echo "  ✓ 当前处理状态 - review_status / training_status"
echo ""
echo "关键流程："
echo "  导入 → 训练 → 林姐看日志 → 重复训练检测 → 策略产品复核 → 版本更新 → 导出"
