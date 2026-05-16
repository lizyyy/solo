# 查询计划回归分析 API

基于 Spring Boot 的数据库查询计划回归分析服务，用于对比数据库升级前后的执行计划变化，识别性能风险。

## 技术栈

- Spring Boot 3.2.0
- Spring Data JPA
- H2 Database (嵌入式)
- Lombok
- Apache Commons CSV

## 核心特性

### 数据模型

- **查询模板 (QueryTemplate)**: SQL模板管理
- **参数集合 (QueryParameter)**: 查询参数归一化存储
- **执行计划 (ExecutionPlan)**: 旧/新计划的结构化解析
- **回归记录 (RegressionRecord)**: 主记录，关联状态、风险、结论
- **计划差异 (PlanDifference)**: 详细差异对比

### 状态机

```
CREATED → COMPARING → ANALYZED → CONFIRMED
              ↓           ↓
            ERROR      ERROR
```

### 风险分级

- **LOW**: 无显著变化或轻微改进
- **MEDIUM**: 中度变化，需关注
- **HIGH**: 显著退化，建议优化
- **CRITICAL**: 严重性能风险，需立即处理

### 结论类型

- NO_CHANGE: 无变化
- IMPROVED: 性能改进
- REGRESSED: 性能退化
- NEEDS_ATTENTION: 需要关注
- MANUALLY_CONFIRMED: 人工确认

## API 接口

### 回归记录管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/regression` | 创建回归分析 |
| GET | `/api/regression` | 查询所有回归记录 |
| GET | `/api/regression/{id}` | 查询回归详情 |
| GET | `/api/regression/status/{status}` | 按状态查询 |
| POST | `/api/regression/{id}/confirm` | 确认结论 |
| POST | `/api/regression/{id}/retry` | 重试分析（ERROR状态） |
| POST | `/api/regression/{id}/correct` | 人工修正 |

### 导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/regression/export/csv` | 导出全部记录CSV |
| GET | `/api/regression/{id}/export/markdown` | 导出单条Markdown报告 |

### 模板管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/templates` | 创建查询模板 |
| GET | `/api/templates` | 查询所有模板 |
| GET | `/api/templates/{id}` | 查询模板详情 |
| PUT | `/api/templates/{id}` | 更新模板 |
| DELETE | `/api/templates/{id}` | 删除模板 |

### 监控与管理

- H2 Console: `/h2-console` (JDBC: `jdbc:h2:file:./data/query_plan_regression`)

## 请求示例

### 创建回归分析

```bash
curl -X POST http://localhost:8080/api/regression \
  -H "Content-Type: application/json" \
  -d '{
    "queryName": "订单查询优化",
    "templateId": 1,
    "parameters": {"user_id": 123, "status": "PAID"},
    "oldPlan": "Index Scan (cost=100.0 rows=1000)",
    "newPlan": "Seq Scan (cost=500.0 rows=1000)",
    "createdBy": "dba_team"
  }'
```

### 确认结论

```bash
curl -X POST http://localhost:8080/api/regression/1/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "conclusion": "REGRESSED",
    "conclusionNotes": "丢失索引idx_user_status，需紧急修复",
    "confirmedBy": "tech_lead"
  }'
```

## 快速启动

```bash
# 构建
mvn clean package -DskipTests

# 运行
java -jar target/query-plan-regression-1.0.0-SNAPSHOT.jar

# 访问
curl http://localhost:8080/api/regression
```

## 异常追踪

系统保留完整的异常链路：
- rawInput: 原始请求输入
- errorMessage: 错误信息
- stackTrace: 堆栈信息
- 状态机边界校验确保操作合法性

## 目录结构

```
src/main/java/com/query/regression/
├── QueryPlanRegressionApplication.java  # 启动类
├── config/                              # 配置类
│   ├── DataInitializer.java             # 示例数据初始化
│   └── GlobalExceptionHandler.java      # 全局异常处理
├── controller/                          # REST控制器
│   ├── RegressionController.java
│   └── TemplateController.java
├── dto/                                 # 数据传输对象
├── entity/                              # JPA实体
├── enums/                               # 枚举定义
├── exception/                           # 自定义异常
├── repository/                          # 数据访问层
└── service/                             # 业务逻辑层
    ├── RegressionService.java           # 回归分析服务
    ├── PlanComparisonService.java       # 计划对比服务
    ├── StatusMachineService.java        # 状态机服务
    └── ExportService.java               # 导出服务
```
