#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "========================================="
echo "文档切片策略台 - API 测试脚本"
echo "========================================="
echo ""

echo "1. 测试创建文档 - 成功案例"
echo "-----------------------------------------"
curl -X POST "$BASE_URL/documents" \
  -H "Content-Type: application/json" \
  -H "X-Responsibility-Node: knowledge-team" \
  -d '{
    "title": "产品使用手册",
    "content": "# 第一章 产品介绍\n\n## 1.1 核心功能\n\n本产品提供以下核心功能：\n\n1. 智能问答 - 基于知识库的自然语言问答\n2. 文档管理 - 支持多种格式的文档上传和解析\n3. 切片优化 - 可配置的文档切片策略\n\n## 1.2 技术架构\n\n系统采用微服务架构，包含以下模块：\n\n- 文档解析模块\n- 向量存储模块\n- 检索匹配模块\n- 答案生成模块\n\n# 第二章 快速开始\n\n## 2.1 安装部署\n\n按照以下步骤进行安装...",
    "file_type": "markdown",
    "responsibility_node": "knowledge-team"
  }'
echo -e "\n"

echo "2. 测试创建切片规则 - 成功案例"
echo "-----------------------------------------"
curl -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -H "X-Responsibility-Node: algorithm-team" \
  -d '{
    "name": "标准切片规则_v1",
    "description": "知识库文档标准切片策略，支持标题继承和表格保留",
    "max_chunk_length": 500,
    "min_chunk_length": 100,
    "overlap_size": 50,
    "heading_hierarchy_level": 3,
    "inherit_headers": 1,
    "preserve_tables": 1,
    "effect_remark": "初始版本，待测试效果"
  }'
echo -e "\n"

echo "3. 测试查询文档列表"
echo "-----------------------------------------"
curl "$BASE_URL/documents?limit=10"
echo -e "\n"

echo "4. 测试查询规则列表"
echo "-----------------------------------------"
curl "$BASE_URL/rules?limit=10"
echo -e "\n"

echo "========================================="
echo "故意失败的测试案例"
echo "========================================="
echo ""

echo "5. 测试创建文档 - 缺少必填字段 (失败)"
echo "-----------------------------------------"
curl -X POST "$BASE_URL/documents" \
  -H "Content-Type: application/json" \
  -d '{"title": "测试文档"}'
echo -e "\n"

echo "6. 测试查询不存在的文档 (失败)"
echo "-----------------------------------------"
curl "$BASE_URL/documents/99999"
echo -e "\n"

echo "7. 测试更新规则使用无效状态 (失败)"
echo "-----------------------------------------"
curl -X PUT "$BASE_URL/rules/1/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid_status"}'
echo -e "\n"

echo "8. 测试生成预览使用不存在的ID (失败)"
echo "-----------------------------------------"
curl -X POST "$BASE_URL/previews/generate" \
  -H "Content-Type: application/json" \
  -d '{"document_id": 99999, "rule_id": 99999}'
echo -e "\n"

echo "========================================="
echo "测试完成！"
echo "========================================="
echo "提示："
echo "  - 请先使用 npm start 启动服务"
echo "  - 访问 http://localhost:3000 查看前端控制台"
echo "  - 查看请求日志可在前端日志面板查看"
echo ""
