# 接口迁移双写比对 API

基于 Spring Boot 2.x + Java 8 构建的接口迁移双写比对服务，用于系统迁移过程中的数据一致性验证。

---

## 技术栈

- **框架**: Spring Boot 2.7.18
- **JDK**: Java 8+
- **数据存储**: 文件持久化 (JSON)
- **导出格式**: JSON / CSV / 文本报告

---

## 核心功能

### 1. 任务生命周期管理
- 创建迁移任务
- 配置校验
- 状态流转跟踪
- 任务查询

### 2. 双写与比对
- 模拟旧库/新库双写
- 字段级精细比对
- 支持精度阈值配置
- 差异归因分析

### 3. 幂等性保障
- 基于请求哈希的幂等键生成
- 重复请求返回已有结果
- 缓存自动清理

### 4. 数据持久化
- 文件系统持久化 (./data 目录)
- 服务重启数据不丢失
- 实时写入与加载

### 5. 导出与报告
- 单任务/全任务 JSON 导出
- 单任务/全任务 CSV 导出
- 差异比对文本报告
- 下载支持

### 6. 切换与回滚
- 切换结论生成
- 阻塞问题检测
- 切换操作执行
- 回滚记录跟踪

---

## 快速开始

### 方式一：一键启动

```bash
./start.sh
```

### 方式二：手动编译运行

```bash
# 编译
mvn clean package -DskipTests

# 运行
java -jar target/dual-write-compare-api-1.0.0.jar
```

### 运行测试

```bash
# 先启动服务，然后运行完整测试
./run-test.sh
```

---

## API 接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/migration/tasks` | 创建迁移任务 |
| POST | `/api/migration/tasks/{taskId}/validate` | 校验任务配置 |
| POST | `/api/migration/tasks/{taskId}/dual-write` | 执行双写操作 |
| POST | `/api/migration/tasks/{taskId}/compare` | 执行字段比对 |
| POST | `/api/migration/tasks/{taskId}/conclusion` | 生成切换结论 |
| POST | `/api/migration/tasks/{taskId}/switch` | 执行切换 |
| POST | `/api/migration/tasks/{taskId}/rollback` | 执行回滚 |
| POST | `/api/migration/tasks/full-flow` | 一键执行完整流程 |
| GET | `/api/migration/tasks/{taskId}` | 查询任务详情 |
| GET | `/api/migration/tasks` | 查询所有任务 |
| GET | `/api/migration/tasks/interface/{interfaceName}` | 按接口名查询 |
| GET | `/api/migration/tasks/{taskId}/export/json` | 导出单任务 JSON |
| GET | `/api/migration/tasks/{taskId}/export/csv` | 导出单任务 CSV |
| GET | `/api/migration/tasks/export/json` | 导出所有任务 JSON |
| GET | `/api/migration/tasks/export/csv` | 导出所有任务 CSV |
| GET | `/api/migration/tasks/{taskId}/report` | 生成比对报告 |
| GET | `/api/migration/tasks/{taskId}/report/download` | 下载比对报告 |
| DELETE | `/api/migration/cache` | 清空幂等缓存 |

---

## 任务状态流转

```
CREATED (已创建)
    ↓
VALIDATING → VALIDATED (校验通过)
    ↓
DUAL_WRITING → DUAL_WRITE_COMPLETED (双写完成)
    ↓
COMPARING → COMPARE_COMPLETED (比对完成)
    ↓
SWITCH_READY (可切换) → SWITCHED (已切换)
    ↓
ROLLBACKED (已回滚)

任何阶段失败 → FAILED (失败)
```

---

## 配置说明

`application.yml` 核心配置:

```yaml
server:
  port: 8080

storage:
  data-dir: ./data          # 数据持久化目录

dualwrite:
  simulate-delay-ms: 50     # 模拟写入延迟
  old-failure-rate: 0       # 旧库失败率 0-1
  new-failure-rate: 0       # 新库失败率 0-1
```

---

## 使用示例

### 创建任务

```bash
curl -X POST http://localhost:8080/api/migration/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "interfaceName": "user_order_create",
    "businessKey": "order_001",
    "createdBy": "developer",
    "oldDataSource": { "type": "mysql", "tableName": "t_order_old" },
    "newDataSource": { "type": "mysql", "tableName": "t_order_new" },
    "fields": [
      { "fieldName": "order_id", "primaryKey": true, "compareEnable": true },
      { "fieldName": "amount", "precisionThreshold": 0.01, "compareEnable": true }
    ],
    "writeData": { "order_id": "ORD001", "amount": 99.99 }
  }'
```

### 执行完整流程

```bash
curl -X POST http://localhost:8080/api/migration/tasks/full-flow \
  -H "Content-Type: application/json" \
  -d '{...}'  # 同上请求体
```

### 导出任务

```bash
# 导出单任务为 JSON
curl -O http://localhost:8080/api/migration/tasks/{taskId}/export/json

# 导出所有任务为 CSV
curl -O http://localhost:8080/api/migration/tasks/export/csv
```

---

## 目录结构

```
dual-write-compare-api/
├── src/main/java/com/migration/dualwrite/
│   ├── DualWriteCompareApplication.java    # 启动类
│   ├── constant/                            # 常量定义
│   ├── controller/                          # REST API
│   ├── dto/                                 # 数据传输对象
│   ├── enums/                               # 枚举
│   ├── exception/                           # 异常处理
│   └── service/                             # 业务逻辑
├── src/main/resources/
│   └── application.yml                      # 配置文件
├── data/                                    # 持久化数据 (自动生成)
├── test-output/                             # 测试输出 (自动生成)
├── pom.xml
├── start.sh                                 # 启动脚本
├── run-test.sh                              # 测试脚本
└── README.md
```

---

## 健康检查

- 服务状态: `http://localhost:8080/actuator/health`
- 服务信息: `http://localhost:8080/actuator/info`

---

## 验证要点

1. **幂等性**: 重复提交相同请求，返回同一任务
2. **持久化**: 重启服务后，任务数据依然存在
3. **导出一致性**: JSON/CSV 导出数据与查询结果一致
4. **状态流转**: 任务状态按预期流转
5. **错误处理**: 非法请求返回友好错误信息

---

## License

MIT
