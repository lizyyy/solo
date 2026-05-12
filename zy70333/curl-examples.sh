#!/bin/bash

# 低代码表单版本 API - curl 示例
# 演示完整的工作流：创建表单 -> 发布版本 -> 提交数据 -> 版本迭代 -> 历史查询 -> 导出

BASE_URL="http://localhost:3000"

echo "====================================="
echo "步骤 1: 创建报名表"
echo "====================================="
CREATE_FORM_RESPONSE=$(curl -s -X POST "$BASE_URL/api/forms" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024活动报名表",
    "description": "年度活动参与者报名表单"
  }')
echo "响应: $CREATE_FORM_RESPONSE"
FORM_ID=$(echo $CREATE_FORM_RESPONSE | sed 's/.*"formId":"\([^"]*\)".*/\1/')
echo "表单ID: $FORM_ID"
echo ""

echo "====================================="
echo "步骤 2: 为 v1 添加字段（姓名、邮箱、年龄）"
echo "====================================="
curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/fields" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "name",
    "type": "text",
    "label": "姓名",
    "required": true,
    "validation": {
      "minLength": 2,
      "maxLength": 50
    }
  }'
echo ""

curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/fields" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "email",
    "type": "email",
    "label": "电子邮箱",
    "required": true
  }'
echo ""

curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/fields" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "age",
    "type": "number",
    "label": "年龄",
    "required": false,
    "validation": {
      "min": 18,
      "max": 120
    }
  }'
echo ""

echo "====================================="
echo "步骤 3: 发布 v1"
echo "====================================="
curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/versions/1/publish"
echo ""
echo ""

echo "====================================="
echo "步骤 4: 使用 v1 提交数据"
echo "====================================="
SUBMIT_V1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/submissions/$FORM_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submissionKey": "user_001_v1",
    "data": {
      "name": "张三",
      "email": "zhangsan@example.com",
      "age": 28
    }
  }')
echo "提交响应: $SUBMIT_V1_RESPONSE"
SUBMISSION_ID_1=$(echo $SUBMIT_V1_RESPONSE | sed 's/.*"submissionId":"\([^"]*\)".*/\1/')
echo "提交ID: $SUBMISSION_ID_1"
echo ""

echo "====================================="
echo "步骤 5: 再次提交相同 submissionKey（幂等性演示）"
echo "====================================="
curl -s -X POST "$BASE_URL/api/submissions/$FORM_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submissionKey": "user_001_v1",
    "data": {
      "name": "张三",
      "email": "zhangsan_updated@example.com",
      "age": 29
    }
  }'
echo ""
echo ""

echo "====================================="
echo "步骤 6: 创建 v2（新增电话号码字段，设为必填）"
echo "====================================="
curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/versions" \
  -H "Content-Type: application/json" \
  -d '{
    "changeLog": "新增电话号码字段，用于活动通知"
  }'
echo ""
echo ""

echo "====================================="
echo "步骤 7: 为 v2 添加字段"
echo "====================================="
curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/fields" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "phone",
    "type": "text",
    "label": "电话号码",
    "required": true,
    "validation": {
      "pattern": "^1[3-9]\\d{9}$"
    }
  }'
echo ""
echo ""

echo "====================================="
echo "步骤 8: 发布 v2"
echo "====================================="
curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/versions/2/publish"
echo ""
echo ""

echo "====================================="
echo "步骤 9: 使用 v2 提交数据（包含必填字段 phone）"
echo "====================================="
SUBMIT_V2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/submissions/$FORM_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submissionKey": "user_002_v2",
    "version": 2,
    "data": {
      "name": "李四",
      "email": "lisi@example.com",
      "age": 35,
      "phone": "13800138000"
    }
  }')
echo "提交响应: $SUBMIT_V2_RESPONSE"
SUBMISSION_ID_2=$(echo $SUBMIT_V2_RESPONSE | sed 's/.*"submissionId":"\([^"]*\)".*/\1/')
echo "提交ID: $SUBMISSION_ID_2"
echo ""

echo "====================================="
echo "步骤 10: 查询旧数据（v1 提交的），验证不影响旧数据"
echo "====================================="
echo "查询提交详情:"
curl -s "$BASE_URL/api/submissions/$SUBMISSION_ID_1"
echo ""
echo ""
echo "查询带版本上下文（展示字段差异）:"
curl -s "$BASE_URL/api/submissions/$SUBMISSION_ID_1/context"
echo ""
echo ""

echo "====================================="
echo "步骤 11: 创建 v3，删除 age 字段（带迁移说明）"
echo "====================================="
curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/versions" \
  -H "Content-Type: application/json" \
  -d '{
    "changeLog": "删除年龄字段，改用出生日期"
  }'
echo ""
echo ""

curl -s -X DELETE "$BASE_URL/api/forms/$FORM_ID/fields/age" \
  -H "Content-Type: application/json" \
  -d '{
    "migrationNote": "age 字段已废弃，历史数据保留。如需年龄信息，可从后续新增的 birthday 字段推算。"
  }'
echo ""
echo ""

echo "====================================="
echo "步骤 12: 添加 birthday 字段并发布 v3"
echo "====================================="
curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/fields" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "birthday",
    "type": "date",
    "label": "出生日期",
    "required": true
  }'
echo ""
echo ""

curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/versions/3/publish"
echo ""
echo ""

echo "====================================="
echo "步骤 13: 冻结 v1（防止历史版本被误用）"
echo "====================================="
curl -s -X POST "$BASE_URL/api/forms/$FORM_ID/versions/1/freeze"
echo ""
echo ""

echo "====================================="
echo "步骤 14: 导出报告 - 按原始版本"
echo "====================================="
curl -s -X POST "$BASE_URL/api/export/$FORM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "original"
  }'
echo ""
echo ""

echo "====================================="
echo "步骤 15: 导出报告 - 按最新版本映射（展示字段差异和缺口）"
echo "====================================="
curl -s -X POST "$BASE_URL/api/export/$FORM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "latest"
  }'
echo ""
echo ""

echo "====================================="
echo "步骤 16: 对比导出 - 查看新旧字段映射差异"
echo "====================================="
curl -s -X POST "$BASE_URL/api/export/$FORM_ID/compare" \
  -H "Content-Type: application/json"
echo ""
echo ""

echo "====================================="
echo "完整流程演示结束！"
echo "====================================="