#!/bin/bash

# 城中村门牌归并重跑脚本
# 会话ID: TEST-REPLAY
# 生成时间: 2026-06-20 13:13:44

# 使用方法:
#   chmod +x 重跑命令_*.sh
#   ./重跑命令_*.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  城中村门牌归并 - 重跑流程"
echo "============================================================"
echo "  会话ID: TEST-REPLAY"
echo "  会话名称: 归并重放测试"
echo "============================================================"

python3 main.py import --session TEST-REPLAY --data all
echo "  [Step1] 导入完成: 新增 3 条, 跳过重复 0 条"
python3 main.py review-photos --session TEST-REPLAY --data all --reviewer 周姐
echo "  [Step2] 照片审核完成: 更新 3 条, 跳过 0 条"
python3 main.py update-points --session TEST-REPLAY
echo "  [Step3] 点位更新完成: 正常归并 1 条, 临时改道待复核 1 条, 旧口径补录 1 条, 冲突待确认 0 条"
python3 main.py import --session TEST-REPLAY --data all
echo "  [Step1] 导入完成: 新增 0 条, 跳过重复 3 条"
python3 main.py review-photos --session TEST-REPLAY --data all --reviewer 周姐
echo "  [Step2] 照片审核完成: 更新 0 条, 跳过 3 条"
python3 main.py update-points --session TEST-REPLAY
echo "  [Step3] 点位更新完成: 正常归并 0 条, 临时改道待复核 0 条, 旧口径补录 0 条, 冲突待确认 0 条"
python3 main.py import --session TEST-REPLAY --data all
echo "  [Step1] 导入完成: 新增 0 条, 跳过重复 3 条"
python3 main.py review-photos --session TEST-REPLAY --data all --reviewer 周姐
echo "  [Step2] 照片审核完成: 更新 0 条, 跳过 3 条"
python3 main.py update-points --session TEST-REPLAY
echo "  [Step3] 点位更新完成: 正常归并 0 条, 临时改道待复核 0 条, 旧口径补录 0 条, 冲突待确认 0 条"
python3 main.py review-photos --session TEST-REPLAY --data all --reviewer 周姐
echo "  [Step2] 照片审核完成: 更新 0 条, 跳过 3 条"
python3 main.py update-points --session TEST-REPLAY
echo "  [Step3] 点位更新完成: 正常归并 0 条, 临时改道待复核 0 条, 旧口径补录 0 条, 冲突待确认 0 条"
python3 main.py import --session TEST-REPLAY --data all
echo "  [Step1] 导入完成: 新增 0 条, 跳过重复 3 条"
python3 main.py review-photos --session TEST-REPLAY --data all --reviewer 周姐
echo "  [Step2] 照片审核完成: 更新 0 条, 跳过 3 条"
python3 main.py update-points --session TEST-REPLAY
echo "  [Step3] 点位更新完成: 正常归并 0 条, 临时改道待复核 0 条, 旧口径补录 0 条, 冲突待确认 0 条"

python3 main.py generate-report --session TEST-REPLAY

echo "  归并流程重跑完成！结果统计（来自实际会话数据）："
echo "------------------------------------------------------------"
python3 main.py summary --session TEST-REPLAY