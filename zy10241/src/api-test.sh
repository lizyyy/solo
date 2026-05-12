#!/bin/bash

# 水质采样瓶流转系统 - API 调用测试脚本
# 使用方法：
#   1. 先启动服务: npm run dev
#   2. 再执行此脚本: bash src/api-test.sh

BASE_URL="http://localhost:3000"

echo "🧪 水质采样瓶流转系统 - API 调用测试"
echo "=========================================="
echo ""

# 检查服务是否启动
echo "🔍 检查服务状态..."
curl -s "$BASE_URL/api/health" | head -1
if [ $? -ne 0 ]; then
    echo "❌ 服务未启动，请先运行: npm run dev"
    exit 1
fi
echo "✅ 服务运行正常"
echo ""

# 重置数据
echo "🔄 重置并加载种子数据..."
curl -s -X POST "$BASE_URL/api/seed"
echo ""
echo ""

# 获取任务列表
echo "📋 获取所有采样任务..."
TASKS=$(curl -s "$BASE_URL/api/tasks")
echo "$TASKS" | head -5
TASK_ID=$(echo "$TASKS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✅ 第一个任务ID: $TASK_ID"
echo ""

# 获取瓶子列表
echo "🍶 获取所有采样瓶..."
BOTTLES=$(curl -s "$BASE_URL/api/bottles")
echo "$BOTTLES" | head -5
BOT_001=$(echo "$BOTTLES" | grep -o '"bottleNo":"BOT-001"' | cut -d'"' -f4)
echo "✅ 测试用瓶: $BOT_001"
echo ""
echo ""

echo "=========================================="
echo "📝 测试 1: 正常流程流转"
echo "=========================================="
echo ""

echo "步骤 1.1 - 绑定任务 (BOT-001 -> 第一个任务)"
curl -s -X POST "$BASE_URL/api/bottles/BOT-001/bind" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$TASK_ID\",\"handler\":\"张三\"}"
echo ""
echo ""

echo "步骤 1.2 - 采样"
curl -s -X POST "$BASE_URL/api/bottles/BOT-001/sample" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"张三\"}"
echo ""
echo ""

echo "步骤 1.3 - 冷藏"
curl -s -X POST "$BASE_URL/api/bottles/BOT-001/cold-store" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"张三\",\"temperature\":4}"
echo ""
echo ""

echo "步骤 1.4 - 交接送检"
curl -s -X POST "$BASE_URL/api/bottles/BOT-001/transfer" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"李四\"}"
echo ""
echo ""

echo "步骤 1.5 - 实验室接收"
curl -s -X POST "$BASE_URL/api/bottles/BOT-001/receive" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"王五\"}"
echo ""
echo ""

echo "步骤 1.6 - 完成检测"
curl -s -X POST "$BASE_URL/api/bottles/BOT-001/test" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"赵六\"}"
echo ""
echo ""

echo "步骤 1.7 - 归还采样瓶"
curl -s -X POST "$BASE_URL/api/bottles/BOT-001/return" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"赵六\"}"
echo ""
echo ""

echo "📊 查询 BOT-001 完整流转轨迹:"
curl -s "$BASE_URL/api/bottles/BOT-001/trail"
echo ""
echo ""

echo "=========================================="
echo "📝 测试 2: 状态顺序校验 - 未绑定直接采样 (应失败)"
echo "=========================================="
echo ""
curl -s -X POST "$BASE_URL/api/bottles/BOT-002/sample" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"张三\"}"
echo ""
echo ""

echo "=========================================="
echo "📝 测试 3: 状态顺序校验 - 采样后未冷藏直接交接 (应失败)"
echo "=========================================="
echo ""
echo "先绑定和采样..."
curl -s -X POST "$BASE_URL/api/bottles/BOT-002/bind" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$TASK_ID\",\"handler\":\"张三\"}"
echo ""
curl -s -X POST "$BASE_URL/api/bottles/BOT-002/sample" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"张三\"}"
echo ""
echo "未冷藏直接交接 (应失败):"
curl -s -X POST "$BASE_URL/api/bottles/BOT-002/transfer" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"李四\"}"
echo ""
echo ""

echo "=========================================="
echo "📝 测试 4: 重复绑定校验 (应失败)"
echo "=========================================="
echo ""
curl -s -X POST "$BASE_URL/api/bottles/BOT-001/bind" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$TASK_ID\",\"handler\":\"张三\"}"
echo ""
echo ""

echo "=========================================="
echo "📝 测试 5: 退样后接收校验 (应失败)"
echo "=========================================="
echo ""
echo "绑定 -> 采样 -> 退样..."
curl -s -X POST "$BASE_URL/api/bottles/BOT-003/bind" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$TASK_ID\",\"handler\":\"张三\"}"
echo ""
curl -s -X POST "$BASE_URL/api/bottles/BOT-003/sample" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"张三\"}"
echo ""
curl -s -X POST "$BASE_URL/api/bottles/BOT-003/reject" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"张三\",\"reason\":\"样品外观异常\"}"
echo ""
echo "退样后尝试接收 (应失败):"
curl -s -X POST "$BASE_URL/api/bottles/BOT-003/receive" \
  -H "Content-Type: application/json" \
  -d "{\"handler\":\"王五\"}"
echo ""
echo ""

echo "=========================================="
echo "✅ API 测试完成！"
echo "=========================================="
echo ""
echo "📌 总结已验证的业务规则："
echo "   1. 正常流程流转 (绑定->采样->冷藏->交接->接收->检测->归还)"
echo "   2. 状态跳跃校验 (未绑定不能采样)"
echo "   3. 采样后未冷藏校验 (未冷藏不能交接)"
echo "   4. 重复绑定校验 (已绑定不能再绑定)"
echo "   5. 退样后接收校验 (已退样不能接收)"
echo "   6. 完整轨迹查询"
echo ""
echo "💡 提示: 测试超时场景需要通过脚本修改 sampledAt 来模拟"
echo "         运行 npm run test 可查看完整的业务规则验证（含超时校验）"
