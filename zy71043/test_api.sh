#!/bin/bash

CURL_OPTS="--noproxy localhost,127.0.0.1"
BASE_URL="http://127.0.0.1:8080/api/v1"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "=========================================="
echo "烟花仓库湿度 API - 边界样例测试"
echo "=========================================="
echo ""

echo "【1】基础查询 - 获取库区列表"
curl -s $CURL_OPTS "$BASE_URL/areas" | python3 -m json.tool
echo ""

echo "=========================================="
echo "【2】湿度窗口检测 - 正常湿度采样"
echo "=========================================="
curl -s -X POST "$BASE_URL/samples" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "SAMPLE-001-NORMAL",
    "area_code": "A-01",
    "humidity": 55.0,
    "temperature": 25.5,
    "sampled_at": "'"$TIMESTAMP"'",
    "sampled_by": "张三"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【3】湿度窗口检测 - 超限湿度采样（低风险）"
echo "=========================================="
curl -s -X POST "$BASE_URL/samples" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "SAMPLE-002-OVERLIMIT-LOW",
    "area_code": "A-01",
    "humidity": 72.0,
    "temperature": 26.0,
    "sampled_at": "'"$TIMESTAMP"'",
    "sampled_by": "张三"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【4】湿度窗口检测 - 超限湿度采样（中风险）"
echo "=========================================="
curl -s -X POST "$BASE_URL/samples" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "SAMPLE-003-OVERLIMIT-MED",
    "area_code": "A-01",
    "humidity": 78.0,
    "temperature": 26.5,
    "sampled_at": "'"$TIMESTAMP"'",
    "sampled_by": "张三"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【5】湿度窗口检测 - 超限湿度采样（高风险）"
echo "=========================================="
curl -s -X POST "$BASE_URL/samples" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "SAMPLE-004-OVERLIMIT-HIGH",
    "area_code": "A-01",
    "humidity": 85.0,
    "temperature": 27.0,
    "sampled_at": "'"$TIMESTAMP"'",
    "sampled_by": "张三"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【6】幂等性测试 - 重复请求（返回相同结果）"
echo "=========================================="
curl -s -X POST "$BASE_URL/samples" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "SAMPLE-001-NORMAL",
    "area_code": "A-01",
    "humidity": 55.0,
    "temperature": 25.5,
    "sampled_at": "'"$TIMESTAMP"'",
    "sampled_by": "张三"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【7】错误分类 - 缺材料（库区不存在）"
echo "=========================================="
curl -s -X POST "$BASE_URL/samples" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "SAMPLE-ERR-AREA",
    "area_code": "Z-99",
    "humidity": 55.0,
    "sampled_at": "'"$TIMESTAMP"'",
    "sampled_by": "张三"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【8】处置状态机 - 启动通风"
echo "=========================================="
curl -s -X POST "$BASE_URL/ventilations/start" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "VENT-START-001",
    "sample_id": 2,
    "operator": "李四",
    "started_at": "'"$TIMESTAMP"'",
    "remark": "梅雨季除湿通风"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【9】错误分类 - 状态不允许（对正常样本启动通风）"
echo "=========================================="
curl -s -X POST "$BASE_URL/ventilations/start" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "VENT-START-ERR",
    "sample_id": 1,
    "operator": "李四",
    "started_at": "'"$TIMESTAMP"'",
    "remark": "测试错误"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【10】处置状态机 - 完成通风"
echo "=========================================="
END_TIME=$(date -u -v+30M +"%Y-%m-%dT%H:%M:%SZ")
curl -s -X POST "$BASE_URL/ventilations/complete" \
  -H "Content-Type: application/json" \
  -d '{
    "ventilation_id": 1,
    "ended_at": "'"$END_TIME"'",
    "after_humidity": 58.0
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【11】批次追踪 - 转仓记录"
echo "=========================================="
curl -s -X POST "$BASE_URL/transfers" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "TRANSFER-001",
    "batch_no": "FH202405001",
    "to_area_code": "A-02",
    "quantity": 500,
    "operator": "王五",
    "transferred_at": "'"$TIMESTAMP"'",
    "remark": "A区库位调整"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【12】错误分类 - 数量不足"
echo "=========================================="
curl -s -X POST "$BASE_URL/transfers" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "TRANSFER-ERR-QTY",
    "batch_no": "FH202405002",
    "to_area_code": "A-02",
    "quantity": 9999,
    "operator": "王五",
    "transferred_at": "'"$TIMESTAMP"'",
    "remark": "测试数量不足"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【13】批次追踪 - 撤销转仓"
echo "=========================================="
curl -s -X POST "$BASE_URL/transfers/undo" \
  -H "Content-Type: application/json" \
  -d '{
    "transfer_id": 1,
    "operator": "管理员"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【14】抽检留痕 - 创建抽检记录"
echo "=========================================="
curl -s -X POST "$BASE_URL/inspections" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "INSPECT-001",
    "batch_no": "FH202405002",
    "area_code": "A-01",
    "inspected_at": "'"$TIMESTAMP"'",
    "inspector": "赵六",
    "package_check": "完好",
    "humidity_check": "正常",
    "quality_status": "合格",
    "photos": ["photo1.jpg", "photo2.jpg"],
    "remark": "梅雨季例行抽检"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【15】待复核列表"
echo "=========================================="
curl -s $CURL_OPTS "$BASE_URL/reviews/pending" | python3 -m json.tool
echo ""

echo "=========================================="
echo "【16】复核 - 复核超限样本"
echo "=========================================="
curl -s -X POST "$BASE_URL/reviews" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_type": "sample",
    "resource_id": 2,
    "reviewed_by": "主管"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【17】错误分类 - 需要复核（已复核记录转仓撤销）"
echo "=========================================="
curl -s -X POST "$BASE_URL/reviews" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_type": "transfer",
    "resource_id": 1,
    "reviewed_by": "主管"
  }' | python3 -m json.tool
echo ""

echo "=========================================="
echo "【18】批次追踪 - 查询批次全链路"
echo "=========================================="
curl -s $CURL_OPTS "$BASE_URL/batches/FH202405001/trace" | python3 -m json.tool
echo ""

echo "=========================================="
echo "【19】报告生成 - 生成风险报告"
echo "=========================================="
PERIOD_START=$(date -u -v-7d +"%Y-%m-%dT00:00:00Z")
PERIOD_END=$(date -u +"%Y-%m-%dT23:59:59Z")
REPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/reports" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "weekly",
    "period_start": "'"$PERIOD_START"'",
    "period_end": "'"$PERIOD_END"'",
    "generated_by": "系统管理员"
  }')
echo "$REPORT_RESPONSE" | python3 -m json.tool
echo ""

REPORT_NO=$(echo "$REPORT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('report_no',''))")

echo "=========================================="
echo "【20】报告导出 - JSON格式"
echo "=========================================="
curl -s $CURL_OPTS "$BASE_URL/reports/$REPORT_NO/export?format=json" | python3 -m json.tool
echo ""

echo "=========================================="
echo "【21】报告导出 - YAML格式"
echo "=========================================="
curl -s $CURL_OPTS "$BASE_URL/reports/$REPORT_NO/export?format=yaml"
echo ""

echo "=========================================="
echo "【22】报告导出 - CSV格式"
echo "=========================================="
curl -s $CURL_OPTS "$BASE_URL/reports/$REPORT_NO/export?format=csv"
echo ""

echo "=========================================="
echo "测试完成！"
echo "=========================================="
