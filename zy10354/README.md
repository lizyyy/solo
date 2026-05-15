# 接口迁移双写比对 API

系统迁移数据一致性验证服务，支持研发和支持团队按同一套记录排查问题。

---

## 🎯 两个版本

### ✅ 推荐：零依赖独立版本（Java 8+）

**无需 Maven、无需任何外部依赖、一键启动**

```bash
# 直接启动（只需要 Java 8+ JDK）
./start-standalone.sh
```

**特性:**
- 只需要 Java 8 JDK 或更高版本
- 使用 JDK 内置 HttpServer，零外部依赖
- 自动编译源码
- 文件持久化，重启数据不丢失

---

### Spring Boot 版本（可选）

需要 Maven 和 Java 8+

```bash
./start.sh
```

---

## 🚀 快速验证步骤

### 1. 启动服务

```bash
./start-standalone.sh
```

看到以下输出说明启动成功：
```
✓ Java 版本: 1.8.0_xxx (主版本: 8)
✓ 编译成功
✓ Class 文件就绪
服务地址: http://localhost:8080
健康检查: http://localhost:8080/actuator/health
```

### 2. 运行完整测试

新开一个终端：

```bash
# 等待服务启动后运行
./run-test.sh
```

该脚本会完整验证：
- ✅ 服务健康检查
- ✅ 创建迁移任务
- ✅ 幂等性验证（重复创建返回同一任务）
- ✅ 执行双写
- ✅ 字段比对
- ✅ 生成切换结论
- ✅ 历史查询（查询所有任务）
- ✅ JSON 导出
- ✅ CSV 导出
- ✅ 比对报告生成
- ✅ 文件持久化验证（检查 `./data` 目录）

### 3. 验证文件持久化

```bash
# 检查持久化文件
ls -la ./data/

# 停止服务（Ctrl+C），重新启动，再次查询历史任务，数据应该保留
```

---

## 📋 API 接口清单

### 核心流程

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/migration/tasks/full-flow` | 一键执行完整流程（推荐） |
| POST | `/api/migration/tasks` | 创建迁移任务 |
| POST | `/api/migration/tasks/{taskId}/validate` | 校验任务配置 |
| POST | `/api/migration/tasks/{taskId}/dual-write` | 执行双写操作 |
| POST | `/api/migration/tasks/{taskId}/compare` | 执行字段比对 |
| POST | `/api/migration/tasks/{taskId}/conclusion` | 生成切换结论 |
| POST | `/api/migration/tasks/{taskId}/switch` | 执行切换 |
| POST | `/api/migration/tasks/{taskId}/rollback` | 执行回滚 |

### 查询接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/migration/tasks` | 查询所有任务 |
| GET | `/api/migration/tasks/{taskId}` | 查询单个任务详情 |
| GET | `/actuator/health` | 服务健康检查 |

### 导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/migration/tasks/{taskId}/export/json` | 导出任务为 JSON |
| GET | `/api/migration/tasks/{taskId}/export/csv` | 导出任务为 CSV |
| GET | `/api/migration/tasks/{taskId}/report` | 生成比对报告 |

---

## 💻 手动调用示例

### 创建任务

```bash
curl -X POST http://localhost:8080/api/migration/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "interfaceName": "user_order_create",
    "businessKey": "order_2024_001",
    "createdBy": "tester",
    "oldDataSource": { "type": "mysql", "tableName": "t_order_old" },
    "newDataSource": { "type": "mysql", "tableName": "t_order_new" },
    "fields": [
      { "fieldName": "order_id", "primaryKey": true, "compareEnable": true },
      { "fieldName": "amount", "precisionThreshold": 0.01, "compareEnable": true }
    ],
    "writeData": { "order_id": "ORD001", "amount": 99.99, "status": 1 }
  }'
```

### 一键完整流程

```bash
curl -X POST http://localhost:8080/api/migration/tasks/full-flow \
  -H "Content-Type: application/json" \
  -d '{ ... 同上请求体 ... }'
```

### 导出任务

```bash
# JSON 导出
curl -O http://localhost:8080/api/migration/tasks/{taskId}/export/json

# CSV 导出
curl -O http://localhost:8080/api/migration/tasks/{taskId}/export/csv
```

---

## 📁 项目结构

```
dual-write-compare-api/
├── standalone/                           # 零依赖独立版本
│   └── src/main/java/com/migration/dualwrite/
│       ├── StandaloneServer.java        # 服务器启动入口
│       ├── TaskHandler.java             # API 处理器
│       ├── TaskStorage.java             # 文件持久化存储
│       ├── HealthHandler.java           # 健康检查处理器
│       └── JsonUtil.java                # JSON 工具（零依赖）
├── src/                                 # Spring Boot 版本（可选）
│   └── main/java/com/migration/dualwrite/
├── data/                                # 持久化数据目录（自动生成）
├── start-standalone.sh                  # 独立版本启动脚本 ✅
├── start.sh                             # Spring Boot 版本启动脚本
├── run-test.sh                          # 完整测试脚本
├── pom.xml                              # Spring Boot Maven 配置
└── README.md                            # 本文档
```

---

## ✅ 验收标准

| 检查项 | 验证方法 | 期望结果 |
|--------|----------|----------|
| Java 版本识别 | 启动脚本输出 | 正确识别 1.8.x 为 Java 8 |
| 服务启动 | 访问健康检查 | 返回 UP，端口 8080 监听 |
| 任务创建 | 调用创建接口 | 返回 200，有 taskId |
| 幂等性 | 重复创建相同任务 | 返回已有任务，idempotent=true |
| 双写执行 | 调用双写接口 | 有 oldWriteResult/newWriteResult |
| 字段比对 | 调用比对接口 | diffCount=0，diffPassed=true |
| 历史查询 | 重启服务后查询 | 历史任务数据保留 |
| JSON 导出 | 调用导出接口 | 可下载 JSON 文件 |
| CSV 导出 | 调用导出接口 | 可下载 CSV 文件 |
| 文件持久化 | 检查 ./data 目录 | 有 task_*.json 文件 |

---

## 🎯 核心特性总结

1. ✅ **Java 8 兼容** - 支持 1.8.x 及以上版本
2. ✅ **零依赖运行** - 独立版本无需任何外部依赖
3. ✅ **文件持久化** - 重启数据不丢失
4. ✅ **完整 API** - 创建、双写、比对、导出全流程
5. ✅ **幂等性保障** - 重复请求不产生脏数据
6. ✅ **多格式导出** - JSON、CSV、文本报告
7. ✅ **全链路测试** - 一键运行所有验证点
