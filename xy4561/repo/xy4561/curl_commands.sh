#!/bin/bash

# 书目上架坏数据追踪器 - 完整验证链
# 确保服务已启动: python run.py

BASE_URL="http://localhost:5000/api"
SAMPLE_DATA_DIR="./sample_data"
OUTPUT_DIR="./test_outputs"

mkdir -p "$OUTPUT_DIR"

echo "========================================"
echo "书目上架坏数据追踪器 - 验证链开始"
echo "========================================"
echo ""

# ====================
# 1. 健康检查
# ====================
echo "[步骤 1] 健康检查"
echo "------------------------"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""
echo ""

# ====================
# 2. 导入书目主数据
# ====================
echo "[步骤 2] 导入书目主数据 (包含坏数据: ISBN重复、无效ISBN、缺失ISBN、缺失标题)"
echo "------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/import" \
  -F "file=@$SAMPLE_DATA_DIR/bibliography_sample.csv" \
  -F "file_type=auto")
echo "$RESPONSE" | python3 -m json.tool
SESSION_ID_1=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',''))")
echo "导入会话ID: $SESSION_ID_1"
echo ""
echo ""

# ====================
# 3. 导入印次价格表
# ====================
echo "[步骤 3] 导入印次价格表 (包含坏数据: 无效币种、无效价格、缺失ISBN)"
echo "------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/import" \
  -F "file=@$SAMPLE_DATA_DIR/price_list_sample.csv" \
  -F "file_type=auto")
echo "$RESPONSE" | python3 -m json.tool
SESSION_ID_2=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',''))")
echo "导入会话ID: $SESSION_ID_2"
echo ""
echo ""

# ====================
# 4. 导入渠道上架数据
# ====================
echo "[步骤 4] 导入渠道上架数据 (包含坏数据: 缺失渠道分类、缺失渠道名称、无效ISBN)"
echo "------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/import" \
  -F "file=@$SAMPLE_DATA_DIR/channel_listing_sample.json" \
  -F "file_type=auto")
echo "$RESPONSE" | python3 -m json.tool
SESSION_ID_3=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',''))")
echo "导入会话ID: $SESSION_ID_3"
echo ""
echo ""

# ====================
# 5. 导入人工修正表
# ====================
echo "[步骤 5] 导入人工修正表 (包含坏数据: 缺失ISBN、无效ISBN)"
echo "------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/import" \
  -F "file=@$SAMPLE_DATA_DIR/manual_correction_sample.csv" \
  -F "file_type=auto")
echo "$RESPONSE" | python3 -m json.tool
SESSION_ID_4=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',''))")
echo "导入会话ID: $SESSION_ID_4"
echo ""
echo ""

# ====================
# 6. 查询导入会话列表
# ====================
echo "[步骤 6] 查询所有导入会话"
echo "------------------------"
curl -s "$BASE_URL/sessions" | python3 -m json.tool
echo ""
echo ""

# ====================
# 7. 查询书目数据
# ====================
echo "[步骤 7] 查询干净的书目数据"
echo "------------------------"
curl -s "$BASE_URL/bibliography" | python3 -m json.tool
echo ""
echo ""

# ====================
# 8. 查询价格表
# ====================
echo "[步骤 8] 查询干净的价格表数据"
echo "------------------------"
curl -s "$BASE_URL/price-lists" | python3 -m json.tool
echo ""
echo ""

# ====================
# 9. 查询渠道上架
# ====================
echo "[步骤 9] 查询干净的渠道上架数据"
echo "------------------------"
curl -s "$BASE_URL/channel-listings" | python3 -m json.tool
echo ""
echo ""

# ====================
# 10. 查询所有坏数据
# ====================
echo "[步骤 10] 查询所有坏数据"
echo "------------------------"
BAD_DATA_RESPONSE=$(curl -s "$BASE_URL/bad-data")
echo "$BAD_DATA_RESPONSE" | python3 -m json.tool
echo ""
echo ""

# ====================
# 11. 查询特定错误类型的坏数据
# ====================
echo "[步骤 11] 查询ISBN重复相关的坏数据"
echo "------------------------"
curl -s "$BASE_URL/bad-data?error_code=ISBN_DUPLICATE" | python3 -m json.tool
echo ""
echo ""

# ====================
# 12. 查询特定会话的坏数据
# ====================
if [ -n "$SESSION_ID_1" ]; then
  echo "[步骤 12] 查询会话 $SESSION_ID_1 的坏数据"
  echo "------------------------"
  curl -s "$BASE_URL/bad-data?session_id=$SESSION_ID_1" | python3 -m json.tool
  echo ""
  echo ""
fi

# ====================
# 13. 标记坏数据为已修复
# ====================
echo "[步骤 13] 标记第一条坏数据为已修复"
echo "------------------------"
FIRST_BAD_DATA_ID=$(echo "$BAD_DATA_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('bad_data',[]); print(items[0]['id'] if items else '')")
if [ -n "$FIRST_BAD_DATA_ID" ]; then
  curl -s -X PUT "$BASE_URL/bad-data/$FIRST_BAD_DATA_ID/fix" \
    -H "Content-Type: application/json" \
    -d '{
      "fix_status": "fixed",
      "fix_note": "已手动修正ISBN格式错误",
      "fixed_by": "发行助理-张三"
    }' | python3 -m json.tool
else
  echo "没有坏数据可标记"
fi
echo ""
echo ""

# ====================
# 14. 批量标记坏数据
# ====================
echo "[步骤 14] 批量标记坏数据 (如果有多个)"
echo "------------------------"
BAD_DATA_IDS=$(echo "$BAD_DATA_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('bad_data',[]); print(','.join([str(i['id']) for i in items[:3]]))")
if [ -n "$BAD_DATA_IDS" ]; then
  IDS_ARRAY="[$(echo "$BAD_DATA_IDS" | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/')]"
  curl -s -X PUT "$BASE_URL/bad-data/batch-fix" \
    -H "Content-Type: application/json" \
    -d '{
      "ids": ['"$BAD_DATA_IDS"'],
      "fix_status": "ignored",
      "fix_note": "批量标记为可忽略",
      "fixed_by": "系统"
    }' | python3 -m json.tool
else
  echo "没有坏数据可批量标记"
fi
echo ""
echo ""

# ====================
# 15. 应用人工修正
# ====================
echo "[步骤 15] 应用新的人工修正"
echo "------------------------"
curl -s -X POST "$BASE_URL/manual-corrections" \
  -H "Content-Type: application/json" \
  -d '{
    "isbn": "9787111213826",
    "field_name": "publisher",
    "new_value": "机械工业出版社（北京分社）",
    "correction_reason": "出版社名称更新",
    "corrector": "李四"
  }' | python3 -m json.tool
echo ""
echo ""

# ====================
# 16. 查询人工修正记录
# ====================
echo "[步骤 16] 查询人工修正记录"
echo "------------------------"
curl -s "$BASE_URL/manual-corrections" | python3 -m json.tool
echo ""
echo ""

# ====================
# 17. 查看统计信息
# ====================
echo "[步骤 17] 查看系统统计信息"
echo "------------------------"
curl -s "$BASE_URL/stats" | python3 -m json.tool
echo ""
echo ""

# ====================
# 18. 重算
# ====================
echo "[步骤 18] 执行重算"
echo "------------------------"
curl -s -X POST "$BASE_URL/recalculate" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
echo ""
echo ""

# ====================
# 19. 导出干净书目数据
# ====================
echo "[步骤 19] 导出干净书目数据 (CSV)"
echo "------------------------"
curl -s "$BASE_URL/export/clean/bibliography" -o "$OUTPUT_DIR/clean_bibliography.csv"
echo "文件已保存到: $OUTPUT_DIR/clean_bibliography.csv"
echo ""
echo ""

# ====================
# 20. 导出干净价格表
# ====================
echo "[步骤 20] 导出干净价格表 (CSV)"
echo "------------------------"
curl -s "$BASE_URL/export/clean/price-list" -o "$OUTPUT_DIR/clean_price_list.csv"
echo "文件已保存到: $OUTPUT_DIR/clean_price_list.csv"
echo ""
echo ""

# ====================
# 21. 导出干净渠道上架数据
# ====================
echo "[步骤 21] 导出干净渠道上架数据 (CSV)"
echo "------------------------"
curl -s "$BASE_URL/export/clean/channel-listing" -o "$OUTPUT_DIR/clean_channel_listing.csv"
echo "文件已保存到: $OUTPUT_DIR/clean_channel_listing.csv"
echo ""
echo ""

# ====================
# 22. 导出坏数据 JSON
# ====================
echo "[步骤 22] 导出坏数据 (JSON)"
echo "------------------------"
curl -s "$BASE_URL/export/bad-data" -o "$OUTPUT_DIR/bad_data.json"
echo "文件已保存到: $OUTPUT_DIR/bad_data.json"
echo ""
echo ""

# ====================
# 23. 导出 Markdown 报告
# ====================
echo "[步骤 23] 导出 Markdown 交付报告"
echo "------------------------"
curl -s "$BASE_URL/export/report" -o "$OUTPUT_DIR/bad_data_report.md"
echo "文件已保存到: $OUTPUT_DIR/bad_data_report.md"
echo ""
echo ""

# ====================
# 24. 导出所有干净数据
# ====================
echo "[步骤 24] 导出所有干净数据 (批量导出)"
echo "------------------------"
curl -s "$BASE_URL/export/all-clean" | python3 -m json.tool
echo ""
echo ""

# ====================
# 25. 验证查询特定ISBN
# ====================
echo "[步骤 25] 查询特定ISBN的书目"
echo "------------------------"
curl -s "$BASE_URL/bibliography?isbn=9787111213826" | python3 -m json.tool
echo ""
echo ""

# ====================
# 26. 验证查询特定错误代码
# ====================
echo "[步骤 26] 查询币种错误相关的坏数据"
echo "------------------------"
curl -s "$BASE_URL/bad-data?error_code=CURRENCY_INVALID" | python3 -m json.tool
echo ""
echo ""

# ====================
# 27. 验证查询待处理的坏数据
# ====================
echo "[步骤 27] 查询待处理的坏数据"
echo "------------------------"
curl -s "$BASE_URL/bad-data?fix_status=pending" | python3 -m json.tool
echo ""
echo ""

# ====================
# 28. 最终统计
# ====================
echo "[步骤 28] 最终统计信息"
echo "------------------------"
curl -s "$BASE_URL/stats" | python3 -m json.tool
echo ""
echo ""

# ====================
# 验证完成
# ====================
echo "========================================"
echo "验证链执行完成！"
echo "========================================"
echo ""
echo "导出文件位置:"
echo "  - 干净书目数据: $OUTPUT_DIR/clean_bibliography.csv"
echo "  - 干净价格表:   $OUTPUT_DIR/clean_price_list.csv"
echo "  - 干净渠道数据: $OUTPUT_DIR/clean_channel_listing.csv"
echo "  - 坏数据JSON:   $OUTPUT_DIR/bad_data.json"
echo "  - Markdown报告: $OUTPUT_DIR/bad_data_report.md"
echo ""
echo "检测到的坏数据类型包括:"
echo "  - ISBN_DUPLICATE: ISBN重复"
echo "  - ISBN_INVALID: ISBN格式无效"
echo "  - TITLE_MISSING: 书名缺失"
echo "  - CURRENCY_INVALID: 币种无效"
echo "  - PRICE_INVALID: 价格无效"
echo "  - CHANNEL_CATEGORY_MISSING: 渠道分类缺失"
echo "  - CHANNEL_NAME_MISSING: 渠道名称缺失"
echo "  - FIELD_NAME_MISSING: 字段名缺失"
echo "  - BIBLIOGRAPHY_NOT_FOUND: 书目不存在"
echo ""
