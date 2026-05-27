#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "== 安装依赖 =="
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt

echo
echo "== 启动服务 =="
rm -rf data
uvicorn app.main:app --host 127.0.0.1 --port 8765 >/tmp/station.log 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT

echo "等待服务启动..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:8765/ >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

BATCH_ID="BATCH-DEMO-$(date +%s)"
echo
echo "== 上传批次 ${BATCH_ID} =="
curl -sS -X POST "http://127.0.0.1:8765/api/batches" \
  -F "batch_id=${BATCH_ID}" \
  -F "packages_file=@samples/packages.csv" \
  -F "sms_file=@samples/sms.json" \
  -F "rules_file=@samples/rules.json" | python3 -m json.tool

echo
echo "== 再次上传同一批，应当直接返回已有记录(不重复生效) =="
curl -sS -X POST "http://127.0.0.1:8765/api/batches" \
  -F "batch_id=${BATCH_ID}" \
  -F "packages_file=@samples/packages.csv" \
  -F "sms_file=@samples/sms.json" \
  -F "rules_file=@samples/rules.json" | python3 -m json.tool

echo
echo "== 获取报告 =="
curl -sS "http://127.0.0.1:8765/api/batches/${BATCH_ID}/report" | python3 -m json.tool

echo
echo "== 逐条明细追踪 =="
curl -sS "http://127.0.0.1:8765/api/batches/${BATCH_ID}/traces" | python3 -m json.tool

echo
echo "== 单条明细 → 最终报告引用 =="
curl -sS "http://127.0.0.1:8765/api/batches/${BATCH_ID}/traces/SF1001000003" | python3 -m json.tool

echo
echo "完成。报告与明细已落盘到 ./data/ 下。"
