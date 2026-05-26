#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -q -r requirements.txt
python app.py &
APP_PID=$!
cleanup() { kill "$APP_PID" 2>/dev/null || true; }
trap cleanup EXIT
sleep 2
echo "=== 首次审计 ==="
curl -s -X POST http://127.0.0.1:5001/audit \
  -F "nodes_csv=@sample_data/nodes.csv" \
  -F "photos_json=@sample_data/photos.json" \
  -F "rectifications=@sample_data/rectifications.json" \
  | python3 -m json.tool
echo
echo "=== 重置状态后再次提交（演示重复批次会被跳过） ==="
curl -s -X POST http://127.0.0.1:5001/state/reset >/dev/null
curl -s -X POST http://127.0.0.1:5001/audit \
  -F "nodes_csv=@sample_data/nodes.csv" \
  -F "photos_json=@sample_data/photos.json" \
  -F "rectifications=@sample_data/rectifications.json" \
  | python3 -m json.tool
echo
echo "=== 重复提交同批次（应被跳过） ==="
curl -s -X POST http://127.0.0.1:5001/audit \
  -F "nodes_csv=@sample_data/nodes.csv" \
  -F "photos_json=@sample_data/photos.json" \
  -F "rectifications=@sample_data/rectifications.json" \
  | python3 -m json.tool
