#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# 艺术品运输路径优化 — 快速入门
#
# 第一步：跑样例
#   bash run_sample.sh
#   → 输出完整 JSON 到 stdout（含公式细节和中间量）
#
# 第二步：只看关键结论（不含公式/中间量）
#   bash run_sample.sh --output result.json
#   → 结果写入文件，默认不含公式和中间量
#
# 第三步：看哪里
#   1. summary → 总批次/总保额/警告数/需特殊处理批次
#   2. warnings → 每条警告标注了 affected_batch_ids / affected_artwork_ids
#   3. path_results → 每批次的 composite_risk_score、requires_special_handling
#   4. formula_detail → 加 --show-formulas 可看每个分数的计算公式和输入
#   5. temp_violations / insurance_exposures → 加 --show-intermediates 可看温控违规和保险暴露
#
# 替换数据：编辑 sample_data/ 下的 JSON 即可
# ──────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

python3 -m art_transport.cli \
  --artworks sample_data/artworks.json \
  --cities sample_data/cities.json \
  --routes sample_data/routes.json \
  --constraints sample_data/constraints.json \
  --source-name "gallery_sample" \
  --source-version "1.0" \
  --show-formulas \
  --show-intermediates \
  "$@"
