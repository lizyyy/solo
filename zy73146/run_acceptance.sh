#!/usr/bin/env bash
set -u
cd /Users/maca/pro/solo/workspaces/zy73146
rm -rf acc_import acc_crit60 acc_crit80
PY="python3 -m harbor_warning"

run() {
  echo "$ $*"
  "$@"
  echo "[exit=$?]"
  echo
}

echo "############ 1. 正常导入（字段名不统一的中英混合批次） ############"
run $PY --data-dir acc_import import --input sample_data/buoy_batch_1.json

echo "############ 2. 重复导入（幂等：不翻倍） ############"
run $PY --data-dir acc_import import --input sample_data/buoy_batch_1.json

echo "############ 3a. critical 分级：--sediment-critical-cm 60 判 70cm ############"
run $PY --data-dir acc_crit60 import --input sample_data/sample_70cm.json
run $PY --data-dir acc_crit60 pipeline --sediment-warning-cm 30 --sediment-critical-cm 60 --drift-threshold 100
run $PY --data-dir acc_crit60 list --kind warnings

echo "############ 3b. critical 改 80：同一条 70cm 不再 critical ############"
run $PY --data-dir acc_crit80 import --input sample_data/sample_70cm.json
run $PY --data-dir acc_crit80 pipeline --sediment-warning-cm 30 --sediment-critical-cm 80 --drift-threshold 100
run $PY --data-dir acc_crit80 list --kind warnings

echo "############ 4. 非法 --new-level（程序返回稳定错误码，非 argparse 英文） ############"
WID=$($PY --data-dir acc_crit60 list --kind warnings | python3 -c "import sys,json;print(json.load(sys.stdin)['warnings'][0]['warning_id'])")
echo "取到 warning_id=$WID"
run $PY --data-dir acc_crit60 revise --warning-id "$WID" --new-level bad --reason "测试非法值"

echo "############ 5. 缺失输入文件（稳定文件错误码，非裸 FileNotFoundError） ############"
run $PY --data-dir acc_import import --input /tmp/不存在的文件.json

echo "############ 收尾：从浮标日志追到历史时间线（老何接班） ############"
run $PY --data-dir acc_crit60 timeline --buoy-id B-ACC --format text
