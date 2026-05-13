# API 响应缓存审判台

一个Go语言实现的单体后端服务，用于管理API响应缓存，包含策略判定、参数归一、命中解释、主动失效、旁路审计等核心功能。

## 项目结构

```
api-cache-tribunal/
├── models/          # 数据模型定义
├── storage/         # 存储层（内存存储）
├── service/         # 业务逻辑层
├── handlers/        # REST API处理器
├── cmd/             # 主程序和示例脚本
└── test/            # 测试用例
```

## 核心数据对象

- **CacheStrategy**: 缓存策略，定义接口路径、方法、TTL和关键参数
- **CacheRecord**: 缓存记录，包含响应数据、状态、命中计数
- **InvalidationEvent**: 失效事件，记录缓存失效历史
- **BypassRecord**: 旁路记录，用于临时绕过缓存
- **AuditLog**: 审计日志

## 状态流转

```
Pending → Active → Expired → Active
                  → Invalid (终态)
                  → Bypassed → Active
```

## 核心API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /strategies | 创建缓存策略 |
| GET | /strategies | 列出所有策略 |
| POST | /cache/check | 检查缓存命中 |
| POST | /cache/records | 创建缓存记录 |
| GET | /cache/records | 列出缓存记录 |
| POST | /cache/records/status | 更新记录状态 |
| POST | /cache/invalidate | 主动失效缓存 |
| POST | /cache/bypass | 创建旁路规则 |
| GET | /cache/history | 查询记录历史 |
| GET | /cache/export | 导出缓存记录 |
| GET | /audit/logs | 查看审计日志 |

## 启动服务

```bash
cd cmd
go run main.go
```

服务将在 `http://localhost:8080` 启动。

## 运行示例

```bash
# 先启动服务，然后运行示例脚本
chmod +x cmd/example.sh
./cmd/example.sh
```

## 运行测试

```bash
go test -v ./test/...
```

## 测试覆盖场景

1. **重复调用**: 重复创建相同参数的缓存记录不会产生脏数据
2. **脏数据**: 额外参数不会影响缓存key（参数归一化）
3. **状态不允许跳转**: 状态机严格控制状态流转

## 幂等性保证

- 重复创建相同策略会返回错误
- 重复创建相同参数的缓存记录会返回已有记录
- 状态流转有严格的前置条件检查
