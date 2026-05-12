#!/bin/bash

echo "=========================================="
echo "  模型训练数据剔除 CLI 工具 - 演示脚本"
echo "=========================================="
echo ""

# 设置工作目录
WORKSPACE=$(pwd)
echo "工作目录: $WORKSPACE"
echo ""

# 安装依赖
echo "1. 安装依赖..."
pip install -q click json5 tabulate
echo "✓ 依赖安装完成"
echo ""

# 初始化工作空间
echo "2. 初始化工作空间..."
python3 purge.py init
echo ""

# 导入文本数据集
echo "3. 导入文本数据集（文本样本+标签）..."
python3 purge.py import dataset text_dataset \
    --description "文本训练数据集" \
    --sample-index examples/text_samples.json \
    --labels examples/text_labels.json \
    --version v1.0.0 \
    --source crawled_news \
    --operator demo_user
echo ""

# 导入图片数据集（已发布版本）
echo "4. 导入图片数据集（已发布版本，包含增强样本）..."
python3 purge.py import dataset image_dataset \
    --description "图片训练数据集（已发布）" \
    --sample-index examples/image_samples.json \
    --labels examples/image_labels.json \
    --version v1.0.0 \
    --source crawled_flickr \
    --published \
    --operator demo_user
echo ""

# 导入敏感样本清单
echo "5. 导入敏感样本清单..."
SENSITIVE_RESULT=$(python3 purge.py --json import sensitive examples/sensitive_samples.json \
    --reason "合规审查发现" \
    --operator compliance_20240601)
SENSITIVE_OP_ID=$(echo "$SENSITIVE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('operation_id',''))")
echo "✓ 敏感样本操作ID: $SENSITIVE_OP_ID"
echo ""

# 检查敏感样本分布
echo "6. 检查敏感样本在数据集中的分布..."
CHECK_RESULT=$(python3 purge.py --json check "$SENSITIVE_OP_ID" --operator demo_user)
CHECK_OP_ID=$(echo "$CHECK_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('operation_id',''))")
echo "✓ 检查操作ID: $CHECK_OP_ID"
echo ""

# 显示检查结果
echo "检查结果概要:"
echo "$CHECK_RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
result = d.get('result', {})
affected = result.get('affected_datasets', {})
print(f'  敏感样本数: {result.get(\"sensitive_sample_count\", 0)}')
print(f'  受影响数据集: {len(affected)}')
for ds_name, ds_info in affected.items():
    for v in ds_info.get('versions', []):
        print(f'    - {ds_name} {v.get(\"version\")}: {v.get(\"matched_count\")} 个样本匹配')
"
echo ""

# 查看所有操作历史
echo "7. 查看操作历史..."
python3 purge.py detail --all
echo ""

# 执行文本数据集剔除
echo "8. 执行文本数据集剔除（v1.0.0）..."
python3 purge.py execute "$CHECK_OP_ID" text_dataset v1.0.0 \
    --operator purger_001 \
    --reason "剔除包含隐私信息的样本"
echo ""

# 执行图片数据集剔除（已发布版本，需要补丁版本）
echo "9. 执行图片数据集剔除（已发布版本，使用补丁版本 v1.0.1）..."
PURGE_RESULT=$(python3 purge.py --json execute "$CHECK_OP_ID" image_dataset v1.0.0 \
    --patch-version v1.0.1 \
    --operator purger_001 \
    --reason "剔除包含敏感GPS信息的样本")
PURGE_OP_ID=$(echo "$PURGE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('operation_id',''))")
echo "✓ 剔除操作ID: $PURGE_OP_ID"
echo ""

# 测试幂等性 - 再次执行剔除
echo "10. 测试幂等性 - 再次执行相同剔除操作..."
python3 purge.py execute "$CHECK_OP_ID" text_dataset v1.0.0 \
    --operator purger_001 \
    --reason "重复测试"
echo ""

# 生成汇总报告
echo "11. 生成汇总报告..."
python3 purge.py report
echo ""

# 生成剔除详情报告
echo "12. 生成剔除详情报告..."
python3 purge.py report --purge-id "$PURGE_OP_ID"
echo ""

echo "=========================================="
echo "  演示完成！"
echo "=========================================="
echo ""
echo "数据存储位置: $WORKSPACE/.purge_data/"
echo ""
echo "常用命令:"
echo "  查看所有操作: python3 purge.py detail --all"
echo "  查看数据集详情: python3 purge.py detail --dataset text_dataset"
echo "  查看敏感样本: python3 purge.py detail --sensitive-id $SENSITIVE_OP_ID"
echo "  JSON格式输出: python3 purge.py --json <命令>"
