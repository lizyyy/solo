#!/usr/bin/env bash
# 一键复跑：启动服务 -> 上传示例数据 -> 查看结果 -> 追溯配件批次
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON_BIN="${PYTHON_BIN:-python3}"
export PYTHONPATH="$ROOT/src${PYTHONPATH:+:$PYTHONPATH}"

PORT="${PORT:-8765}"
BATCH_KEY="BATCH-$(date +%Y%m%d%H%M%S)"

echo "==> 安装依赖"
$PYTHON_BIN -m pip install -q -e .

echo "==> 启动服务 (port $PORT)"
$PYTHON_BIN -m uvicorn auto_chain_reconcile.main:app --host 127.0.0.1 --port "$PORT" >/tmp/acr_server.log 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:$PORT/" >/dev/null; then break; fi
  sleep 1
done

echo "==> 提交批次 $BATCH_KEY"
curl -sS -X POST "http://127.0.0.1:$PORT/api/v1/reconcile/multipart" \
  -F "batch_key=$BATCH_KEY" \
  -F "store_id=ST01" \
  -F "packages_file=@examples/packages.csv;type=text/csv" \
  -F "work_orders_file=@examples/work_orders.json;type=application/json" \
  -F "inventory_file=@examples/inventory.csv;type=text/csv" \
  | $PYTHON_BIN -m json.tool

echo
echo "==> 追溯配件 OIL_0W20 的历史批次"
curl -sS "http://127.0.0.1:$PORT/api/v1/trace/part/OIL_0W20?store_id=ST01" \
  | $PYTHON_BIN -m json.tool

echo
echo "==> 查看工单 WO1002"
curl -sS "http://127.0.0.1:$PORT/api/v1/trace/order/WO1002" \
  | $PYTHON_BIN -m json.tool

echo
echo "==> 再次用同一批次号提交（幂等，直接返回历史结果）"
curl -sS -X POST "http://127.0.0.1:$PORT/api/v1/reconcile/multipart" \
  -F "batch_key=$BATCH_KEY" \
  -F "store_id=ST01" \
  -F "packages_file=@examples/packages.csv;type=text/csv" \
  -F "work_orders_file=@examples/work_orders.json;type=application/json" \
  -F "inventory_file=@examples/inventory.csv;type=text/csv" \
  | $PYTHON_BIN -m json.tool

echo
echo "已完成。服务日志见 /tmp/acr_server.log；数据文件在 $ROOT/data/reconcile.db"
