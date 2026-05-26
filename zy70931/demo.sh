#!/usr/bin/env bash
# 一键跑通脚本：创建批次 → 上传 sample.csv → 拆分 → 查询 → 下载报告
# 使用方法:  python app.py &  (先启动服务)
#           bash demo.sh

set -e
BASE=${BASE:-http://127.0.0.1:8000}

echo "==> 1. 健康检查"
curl -s "$BASE/health"; echo

echo "==> 2. 创建批次"
CREATE=$(curl -s -X POST "$BASE/batches" \
  -H 'Content-Type: application/json' \
  -d '{"store_id":"S001","operator":"店长-李伟","remark":"demo 批次"}')
echo "$CREATE"
BATCH=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['batch_no'])")
echo "    batch_no = $BATCH"

echo "==> 3. 上传 sample.csv"
curl -s -X POST "$BASE/batches/$BATCH/upload" \
  -F 'file=@sample.csv;type=text/csv'; echo

echo "==> 4. 触发拆分"
curl -s -X POST "$BASE/batches/$BATCH/split"; echo

echo "==> 5. 批次概览"
curl -s "$BASE/batches/$BATCH"; echo

echo "==> 6. 已拦截明细"
curl -s "$BASE/batches/$BATCH/items?category=blocked" | python3 -m json.tool | head -60

echo "==> 7. 读取第一条明细的处理轨迹"
FIRST_ID=$(curl -s "$BASE/batches/$BATCH/items" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['item_id'])")
curl -s "$BASE/items/$FIRST_ID/history" | python3 -m json.tool

echo "==> 8. 下载 CSV 报告"
curl -s "$BASE/batches/$BATCH/report?fmt=csv" -o "$BATCH.csv"
echo "    -> $BATCH.csv"
head -n 5 "$BATCH.csv"

echo "==> 9. 下载 JSON 报告"
curl -s "$BASE/batches/$BATCH/report?fmt=json" -o "$BATCH.json"
echo "    -> $BATCH.json"

echo "✅ 完成。batch_no = $BATCH"
