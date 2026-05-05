#!/bin/bash

# Go 微服务框架 - curl 示例脚本
# 本脚本展示如何使用 HTTP API 操作微服务框架

GATEWAY="http://localhost:8080"
REGISTRY="http://localhost:8081"

echo "=========================================="
echo "Go 微服务框架 - curl 示例"
echo "=========================================="
echo ""

# ==========================================
# 1. 服务注册与发现
# ==========================================

echo "【1. 服务注册与发现】"
echo ""

# 注册 user 服务实例
echo "1.1 注册 user 服务实例 (端口 8091):"
curl -s -X POST "$REGISTRY/api/registry/services" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "user",
    "address": "localhost",
    "port": 8091,
    "metadata": {
      "version": "1.0.0",
      "region": "local"
    }
  }' | python3 -m json.tool
echo ""

# 注册 order 服务实例
echo "1.2 注册 order 服务实例 (端口 8092):"
curl -s -X POST "$REGISTRY/api/registry/services" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "order",
    "address": "localhost",
    "port": 8092,
    "metadata": {
      "version": "1.0.0",
      "region": "local"
    }
  }' | python3 -m json.tool
echo ""

# 查看所有服务
echo "1.3 查看所有已注册服务:"
curl -s "$REGISTRY/api/registry/services" | python3 -m json.tool
echo ""

# 查看特定服务详情
echo "1.4 查看 user 服务详情:"
curl -s "$REGISTRY/api/registry/services/user" | python3 -m json.tool
echo ""

# ==========================================
# 2. 通过网关发送请求
# ==========================================

echo "【2. 通过网关发送请求】"
echo ""

# 获取所有用户 (通过网关路由到 user 服务)
echo "2.1 获取所有用户 (GET /api/users):"
curl -s "$GATEWAY/api/users" | python3 -m json.tool
echo ""

# 获取单个用户
echo "2.2 获取用户 ID=1 (GET /api/users/1):"
curl -s "$GATEWAY/api/users/1" | python3 -m json.tool
echo ""

# 创建新用户
echo "2.3 创建新用户 (POST /api/users):"
curl -s -X POST "$GATEWAY/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jane_smith",
    "email": "jane@example.com",
    "name": "Jane Smith"
  }' | python3 -m json.tool
echo ""

# 获取所有订单
echo "2.4 获取所有订单 (GET /api/orders):"
curl -s "$GATEWAY/api/orders" | python3 -m json.tool
echo ""

# 获取用户的订单
echo "2.5 获取用户 ID=1 的所有订单 (GET /api/orders/user/1):"
curl -s "$GATEWAY/api/orders/user/1" | python3 -m json.tool
echo ""

# ==========================================
# 3. 带 trace_id 的请求
# ==========================================

echo "【3. 带 trace_id 的请求 (用于链路追踪)】"
echo ""

echo "3.1 指定 trace_id 发起请求:"
curl -s "$GATEWAY/api/users" \
  -H "X-Trace-ID: my-custom-trace-001" \
  -i
echo ""

# ==========================================
# 4. 配置管理
# ==========================================

echo "【4. 配置管理】"
echo ""

# 获取当前配置
echo "4.1 获取当前配置:"
curl -s "$REGISTRY/api/config" | python3 -m json.tool
echo ""

# 更新配置 (触发热加载)
echo "4.2 更新限流配置:"
curl -s -X PUT "$REGISTRY/api/config" \
  -H "Content-Type: application/json" \
  -d '{
    "ratelimit.limit": 200,
    "ratelimit.window": 120
  }' | python3 -m json.tool
echo ""

# 查看配置历史
echo "4.3 查看配置历史:"
curl -s "$REGISTRY/api/config/history" | python3 -m json.tool
echo ""

# ==========================================
# 5. 网关管理
# ==========================================

echo "【5. 网关管理】"
echo ""

# 查看路由配置
echo "5.1 查看网关路由配置:"
curl -s "$GATEWAY/api/gateway/routes" | python3 -m json.tool
echo ""

# 查看路由决策日志
echo "5.2 查看路由决策:"
curl -s "$GATEWAY/api/gateway/decisions" | python3 -m json.tool
echo ""

# 查看熔断器状态
echo "5.3 查看熔断器状态:"
curl -s "$GATEWAY/api/gateway/circuit-breakers" | python3 -m json.tool
echo ""

# ==========================================
# 6. 服务健康管理
# ==========================================

echo "【6. 服务健康管理】"
echo ""

# 标记实例为不健康
echo "6.1 标记 user 服务实例为不健康:"
curl -s -X PUT "$REGISTRY/api/registry/services/user/user-localhost-8091/health" \
  -H "Content-Type: application/json" \
  -d '{"healthy": false}' | python3 -m json.tool
echo ""

# 验证服务状态 (此时网关应拒绝路由到不健康实例)
echo "6.2 验证服务状态变更:"
curl -s "$REGISTRY/api/registry/services/user" | python3 -m json.tool
echo ""

# 恢复健康状态
echo "6.3 恢复实例健康状态:"
curl -s -X PUT "$REGISTRY/api/registry/services/user/user-localhost-8091/health" \
  -H "Content-Type: application/json" \
  -d '{"healthy": true}' | python3 -m json.tool
echo ""

# ==========================================
# 7. 服务下线
# ==========================================

echo "【7. 服务下线】"
echo ""

# 查看请求日志
echo "7.1 查看请求日志:"
curl -s "$REGISTRY/api/logs/requests" | python3 -m json.tool
echo ""

# 下线实例 (先注释掉，避免影响后续测试)
# echo "7.2 下线 user 服务实例:"
# curl -s -X DELETE "$REGISTRY/api/registry/services/user/user-localhost-8091" | python3 -m json.tool
# echo ""

# ==========================================
# 8. 健康检查
# ==========================================

echo "【8. 健康检查】"
echo ""

echo "8.1 网关健康检查:"
curl -s "$GATEWAY/health" | python3 -m json.tool
echo ""

echo "8.2 注册表健康检查:"
curl -s "$REGISTRY/health" | python3 -m json.tool
echo ""

echo "8.3 User 服务健康检查:"
curl -s "http://localhost:8091/api/users/health" | python3 -m json.tool
echo ""

echo "8.4 Order 服务健康检查:"
curl -s "http://localhost:8092/api/orders/health" | python3 -m json.tool
echo ""

echo "=========================================="
echo "示例执行完成!"
echo "=========================================="
