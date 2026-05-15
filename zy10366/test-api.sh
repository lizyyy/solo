#!/bin/bash

BASE_URL="http://localhost:8080/api/repair"

echo "======================================"
echo "附件元数据修复API - 测试脚本"
echo "======================================"
echo ""

echo "【测试场景1: 成功流 - 完整修复流程】"
echo "--------------------------------------"
echo ""

echo "1. 创建修复批次 (成功流)"
curl -s -X POST "$BASE_URL/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH-001-SUCCESS",
    "batchName": "2024年Q1附件元数据修复",
    "operator": "admin",
    "description": "第一季度财务系统附件元数据批量修复",
    "attachments": [
      {"fileId": "FILE-001", "fileName": "2024财务预算.xlsx", "businessNo": "FIN-2024-001", "sourceSystem": "FINANCE"},
      {"fileId": "FILE-002", "fileName": "人事档案.pdf", "businessNo": "HR-2024-001", "sourceSystem": "EHR"},
      {"fileId": "FILE-003", "fileName": "客户合同.docx", "businessNo": "CRM-2024-001", "sourceSystem": "CRM"},
      {"fileId": "FILE-004", "fileName": "采购订单.pdf", "businessNo": "PO-2024-001", "sourceSystem": "ERP"},
      {"fileId": "FILE-005", "fileName": "会议纪要.doc", "businessNo": "OA-2024-001", "sourceSystem": "OA"}
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "2. 校验批次"
curl -s -X POST "$BASE_URL/batch/BATCH-001-SUCCESS/validate?operator=张三" | python3 -m json.tool
echo ""
echo ""

echo "3. 开始修复处理"
curl -s -X POST "$BASE_URL/batch/BATCH-001-SUCCESS/start?operator=张三" | python3 -m json.tool
echo ""
echo ""

echo "4. 查询批次状态"
curl -s "$BASE_URL/batch/BATCH-001-SUCCESS/status" | python3 -m json.tool
echo ""
echo ""

echo "5. 查询修复报告"
curl -s "$BASE_URL/batch/BATCH-001-SUCCESS/report" | python3 -m json.tool
echo ""
echo ""

echo "6. 查询历史记录"
curl -s "$BASE_URL/batch/BATCH-001-SUCCESS/history" | python3 -m json.tool
echo ""
echo ""

echo "======================================"
echo "【测试场景2: 问题流 - 包含异常的修复】"
echo "--------------------------------------"
echo ""

echo "1. 创建修复批次 (问题流)"
curl -s -X POST "$BASE_URL/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH-002-PROBLEM",
    "batchName": "问题附件修复批次",
    "operator": "admin",
    "description": "包含缺失元数据附件的修复",
    "attachments": [
      {"fileId": "FILE-101", "businessNo": "TEST-001"},
      {"fileId": "FILE-102", "fileName": "无后缀文件", "businessNo": "TEST-002"},
      {"fileId": "FILE-103", "fileName": "salary_report.pdf", "businessNo": "TEST-003"}
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "2. 校验批次"
curl -s -X POST "$BASE_URL/batch/BATCH-002-PROBLEM/validate?operator=李四" | python3 -m json.tool
echo ""
echo ""

echo "3. 开始修复处理"
curl -s -X POST "$BASE_URL/batch/BATCH-002-PROBLEM/start?operator=李四" | python3 -m json.tool
echo ""
echo ""

echo "4. 查询异常清单"
curl -s "$BASE_URL/batch/BATCH-002-PROBLEM/exceptions" | python3 -m json.tool
echo ""
echo ""

echo "======================================"
echo "【测试场景3: 幂等性 - 重复提交测试】"
echo "--------------------------------------"
echo ""

echo "重复创建相同批次号 (应该返回已有数据)"
curl -s -X POST "$BASE_URL/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH-001-SUCCESS",
    "batchName": "重复提交测试",
    "operator": "test",
    "attachments": [
      {"fileId": "FILE-999", "fileName": "test.txt"}
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "======================================"
echo "【测试场景4: 查询所有批次】"
echo "--------------------------------------"
echo ""
curl -s "$BASE_URL/batches" | python3 -m json.tool
echo ""
echo ""

echo "======================================"
echo "测试完成! 请查看以上输出结果验证API功能"
echo "======================================"
