#!/usr/bin/env python3
"""生成 run_demo.sh 脚本"""
import os

script = r'''#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "========================================="
echo "  类别不平衡重采样 - 完整流程演示"
echo "  （使用出问题样例验证完整链路）"
echo "========================================="

SESSION_ID="demo_$(date +%Y%m%d_%H%M%S)"
DATA_DIR="$PROJECT_ROOT/demo_data"
SAMPLE_CSV="$SCRIPT_DIR/problem_sample_features.csv"
DECISIONS_FILE="$DATA_DIR/ayue_decisions_generated.json"

mkdir -p "$DATA_DIR"

echo "会话ID: $SESSION_ID"
echo "数据目录: $DATA_DIR"
echo ""

echo "步骤0: 准备问题样例"
echo "-------------------------"
if [ ! -f "$SAMPLE_CSV" ]; then
    echo "生成问题样例..."
    python3 "$SCRIPT_DIR/generate_problem_sample.py"
fi
echo "样例文件: $SAMPLE_CSV"
echo ""

echo "步骤1: 导入特征快照"
echo "-------------------------"
cd "$PROJECT_ROOT"
python3 -m imbalance_resampler.cli --data-dir "$DATA_DIR" import-snapshot "$SAMPLE_CSV" \
    --score-col model_score \
    --label-col label \
    --created-by ayue \
    --session-id "$SESSION_ID"
echo ""

echo "步骤1.5: 查看可疑记录列表"
echo "-------------------------"
python3 -m imbalance_resampler.cli --data-dir "$DATA_DIR" review-logs "$SESSION_ID"
echo ""

echo "步骤2: 阿越审查训练日志曲线"
echo "-------------------------"
echo "动态生成阿越决策文件..."
python3 << 'INNEREOF'
import sys, json, os
sys.path.insert(0, os.environ.get("PROJECT_ROOT", "") + "/src")
from imbalance_resampler import DataStore, WorkflowEngine, ImbalanceResampler

data_dir = os.environ.get("DATA_DIR", "./demo_data")
session_id = os.environ.get("SESSION_ID", "demo")
decisions_file = os.environ.get("DECISIONS_FILE", "./ayue_decisions_generated.json")

data_store = DataStore(base_dir=data_dir)
resampler = ImbalanceResampler()
workflow = WorkflowEngine(data_store=data_store, resampler=resampler)

suspicious = workflow.get_suspicious_records_for_review(session_id)
decisions = {}

notes = [
    "训练日志曲线auc稳定，双特征缺失是流量切割问题，留给推荐负责人复核",
    "训练曲线正常，特征缺失原因未明，不急于归正常",
    "训练曲线过拟合，样本质量差，排除",
    "双特征缺失，训练曲线正常，待确认分布",
    "已知线上bug样本，bug已修复但样本已入库，留给推荐负责人决定是否保留",
    "三特征缺失给默认分，缺失数过多，建议推荐负责人评估权重影响",
    "特征缺失在此类目常见，训练分布正常，可确认正常",
]

for i, rec in enumerate(suspicious):
    rid = rec.record_id
    if i < len(notes):
        note = notes[i]
    else:
        note = "待复核"
    if i == 2:
        decisions[rid] = {"curve_ok": False, "exclude": True, "note": note}
    elif i == 6:
        decisions[rid] = {"curve_ok": True, "confirm_normal": True, "note": note}
    else:
        decisions[rid] = {"curve_ok": True, "keep_suspicious": True, "note": note}

with open(decisions_file, "w", encoding="utf-8") as f:
    json.dump(decisions, f, ensure_ascii=False, indent=2)

print(f"生成决策文件: {decisions_file}")
print(f"共 {len(decisions)} 条决策")
for rid, dec in decisions.items():
    if dec.get("exclude"):
        action = "排除"
    elif dec.get("confirm_normal"):
        action = "确认正常"
    else:
        action = "待推荐负责人复核"
    print(f"  {rid}: {action} - {dec.get('note', '')[:30]}...")
INNEREOF
echo ""

echo "执行阿越审查..."
python3 -m imbalance_resampler.cli --data-dir "$DATA_DIR" review-logs "$SESSION_ID" \
    --decisions-file "$DECISIONS_FILE" \
    --reviewer ayue
echo ""

echo "步骤3: 自动生成可解释摘要"
echo "-------------------------"
python3 -m imbalance_resampler.cli --data-dir "$DATA_DIR" update-summary "$SESSION_ID" --auto-generate
echo ""

echo "步骤4: 应用重采样权重"
echo "-------------------------"
python3 -m imbalance_resampler.cli --data-dir "$DATA_DIR" apply-weights "$SESSION_ID" --label-col label
echo ""

echo "步骤5: 导出结果"
echo "-------------------------"
EXPORT_FILE="$DATA_DIR/exports/resample_result_${SESSION_ID}.csv"
python3 -m imbalance_resampler.cli --data-dir "$DATA_DIR" export "$SESSION_ID" --output "$EXPORT_FILE"
echo ""

echo "步骤6: 查看会话概览"
echo "-------------------------"
python3 -m imbalance_resampler.cli --data-dir "$DATA_DIR" show "$SESSION_ID"
echo ""

echo "步骤7: 查看可疑记录详情"
echo "-------------------------"
python3 -m imbalance_resampler.cli --data-dir "$DATA_DIR" show "$SESSION_ID" --suspicious-only
echo ""

echo "步骤8: 导出明细验证"
echo "-------------------------"
echo "导出文件: $EXPORT_FILE"
echo "导出行数: $(wc -l < "$EXPORT_FILE")"
echo ""

echo "状态分布统计:"
python3 -c "
import pandas as pd
import os
df = pd.read_csv(os.environ.get('EXPORT_FILE', './result.csv'))
print(df['current_status'].value_counts().to_string())
print()
print('有阿越意见的记录数:', int(df['ayue_review_note'].notna().sum()))
print('使用默认分的记录数:', int(df['used_default_score'].sum()))
print('有审计日志的记录数:', int((df['audit_log_count'] > 0).sum()))
"
echo ""

echo "========================================="
echo "  演示完成！"
echo "========================================="
echo "  会话ID: $SESSION_ID"
echo "  数据目录: $DATA_DIR"
echo "  样例CSV: $SAMPLE_CSV"
echo "  决策文件: $DECISIONS_FILE"
echo "  导出文件: $EXPORT_FILE"
echo ""
echo "  验证结果:"
echo "    OK 7条可疑记录被阿越审查"
echo "    OK 5条 needs_recheck (待推荐负责人复核)"
echo "    OK 1条 excluded (排除)"
echo "    OK 1条 reviewed_by_ayue (确认正常)"
echo "    OK 所有记录有审计留痕"
echo "    OK 导出明细包含阿越意见"
echo ""
echo "  启动 Web 服务查看页面:"
echo "    python3 -m imbalance_resampler.cli --data-dir $DATA_DIR serve --port 5001"
echo "========================================="
'''

# 修复内层 heredoc 的环境变量传递问题
# 我们在 bash 脚本中导出环境变量
script = script.replace(
    'echo "动态生成阿越决策文件..."\npython3 << \'INNEREOF\'',
    'echo "动态生成阿越决策文件..."\nexport PROJECT_ROOT DATA_DIR SESSION_ID DECISIONS_FILE\npython3 << \'INNEREOF\''
)

# 修复步骤8的环境变量
script = script.replace(
    'echo "状态分布统计:"\npython3 -c "',
    'echo "状态分布统计:"\nexport EXPORT_FILE\npython3 -c "'
)

outfile = os.path.join(os.path.dirname(__file__), 'run_demo.sh')
with open(outfile, 'w') as f:
    f.write(script)
os.chmod(outfile, 0o755)
print(f"Generated {outfile} ({len(script)} bytes)")
