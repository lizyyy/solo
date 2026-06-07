#!/bin/bash
# 语义向量聚类命名系统 - 完整演示流程
# 覆盖：首次导入、重复训练检测、策略产品复核、特征版本更新

set -e

echo "=========================================="
echo "  语义向量聚类命名系统 - 完整流程演示"
echo "=========================================="
echo ""

echo "=== 步骤 0: 安装依赖 ==="
pip install -e . 2>/dev/null || pip install -r requirements.txt

echo ""
echo "=== 步骤 1: 生成示例数据 ==="
python generate_sample_data.py

echo ""
echo "=== 步骤 2: 首次导入特征快照 ==="
scn snapshot import sample_snapshot.csv --snapshot-id SNAP2024001 --actor 林姐

echo ""
echo "=== 步骤 3: 查看导入的快照 ==="
scn snapshot list
scn snapshot show SNAP2024001

echo ""
echo "=== 步骤 4: 第一次聚类训练 ==="
scn cluster run SNAP2024001 --n-clusters 4 --actor 林姐

echo ""
echo "=== 步骤 5: 数据科学家林姐查看训练日志曲线 ==="
FIRST_RUN=$(python3 -c "
from semantic_cluster_naming.models import init_db
from semantic_cluster_naming.clustering import ClusteringEngine
Session, _ = init_db()
db = Session()
engine = ClusteringEngine(db)
runs = engine.list_runs('SNAP2024001', limit=1)
print(runs[0]['run_id'])
")
echo "第一次运行ID: $FIRST_RUN"
scn cluster log $FIRST_RUN

echo ""
echo "=== 步骤 6: 查看聚类结果 ==="
scn result show $FIRST_RUN

echo ""
echo "=== 步骤 7: 同一批数据重复训练第二次（触发自检） ==="
echo "（模拟林姐不小心重复点了训练按钮）"
scn cluster run SNAP2024001 --n-clusters 4 --actor 林姐

echo ""
echo "=== 步骤 8: 查看所有训练记录 ==="
scn cluster list --snapshot-id SNAP2024001

echo ""
echo "=== 步骤 9: 查看待策略产品复核列表 ==="
scn review list

echo ""
echo "=== 步骤 10: 策略产品复核通过重复训练 ==="
SECOND_RUN=$(python3 -c "
from semantic_cluster_naming.models import init_db
from semantic_cluster_naming.result_service import ResultService
Session, _ = init_db()
db = Session()
service = ResultService(db)
pending = service.get_pending_reviews()
print(pending[0]['run_id'])
")
echo "待复核运行ID: $SECOND_RUN"
scn review approve $SECOND_RUN --reviewer 策略产品 --comments "确认重复训练正常，结果一致"

echo ""
echo "=== 步骤 11: 人工编辑簇名称 ==="
scn result edit-name $FIRST_RUN 0 "信贷业务簇" --editor 林姐
scn result edit-name $FIRST_RUN 1 "理财业务簇" --editor 林姐
scn result edit-name $FIRST_RUN 2 "支付业务簇" --editor 林姐
scn result edit-name $FIRST_RUN 3 "客户服务簇" --editor 林姐

echo ""
echo "=== 步骤 12: 导出聚类结果（自动校验与页面/API一致） ==="
scn result export $FIRST_RUN ./cluster_results.csv

echo ""
echo "=== 步骤 13: 更新特征版本表 ==="
scn version create SNAP2024001 $FIRST_RUN --change-log "首次聚类，4个业务簇，人工命名" --actor 策略产品

echo ""
echo "=== 步骤 14: 查看审计追踪 ==="
scn audit --snapshot-id SNAP2024001 --limit 20

echo ""
echo "=== 步骤 15: 生成复盘记录（可重跑命令） ==="
scn replay --snapshot-id SNAP2024001

echo ""
echo "=========================================="
echo "  演示完成！"
echo "=========================================="
echo ""
echo "自检覆盖情况："
echo "  ✓ 重复导入检测 - 导入相同文件会标记重复"
echo "  ✓ 同一批数据重复训练两次 - 自动标记待复核"
echo "  ✓ 补录后重算 - 支持 supplement 版本管理"
echo "  ✓ 导出一致 - 导出前自动校验与页面/API同一份数据"
echo ""
echo "数据保留："
echo "  ✓ 特征快照编号原始行号 - original_row_number"
echo "  ✓ 人工改动记录 - audit_log 完整追踪"
echo "  ✓ 当前处理状态 - review_status / training_status"
echo ""
echo "关键流程："
echo "  导入 → 训练 → 林姐看日志 → 重复训练检测 → 策略产品复核 → 版本更新"
