# DNS切换预演 API

一个本地可运行的DNS域名切换预演系统，帮助团队在正式切换前检查记录差异和TTL风险。

## 技术栈

- Java 8+
- Spring Boot 2.7.x
- H2 Database (本地持久化)
- Maven

## 核心功能

### 数据模型
- **DNS记录**: 域名、记录类型、旧目标、新目标、TTL、TTL策略
- **预演会话**: 名称、描述、状态、整体风险等级、结论、回滚记录
- **差异结果**: 记录差异对比、TTL风险评估

### 核心规则
- 记录差异自动计算
- TTL风险等级判定 (LOW/MEDIUM/HIGH/CRITICAL)
- 状态流转控制
- 异常路径保留原始输入和处理结论
- 人工修正后支持重新计算
- 导出详细预演报告

## 快速开始

### 1. 构建项目

```bash
mvn clean package
```

### 2. 运行应用

```bash
mvn spring-boot:run
```

或直接运行jar:

```bash
java -jar target/dns-preplay-api-1.0.0.jar
```

应用启动后访问: http://localhost:8080/api

### 3. 访问H2控制台

数据库管理界面: http://localhost:8080/api/h2-console

- JDBC URL: `jdbc:h2:file:./data/dns-preplay`
- 用户名: `sa`
- 密码: (空)

## API 接口文档

### 基础路径

所有API的基础路径: `http://localhost:8080/api/preplays`

### 1. 创建预演

**POST** `/`

```json
{
  "preplayName": "生产环境域名切换",
  "description": "api.example.com 迁移到新服务器",
  "createdBy": "admin",
  "records": [
    {
      "domainName": "api.example.com",
      "recordType": "A",
      "oldTarget": "192.168.1.100",
      "newTarget": "10.0.0.50",
      "ttl": 3600,
      "expectedTtl": 300,
      "ttlStrategy": "切换前降低到300秒"
    }
  ]
}
```

### 2. 查询预演

- **GET** `/{id}` - 按ID查询单个预演
- **GET** `/name/{name}` - 按名称查询
- **GET** `/` - 查询所有预演

### 3. 计算记录差异

**POST** `/{id}/diff`

计算所有DNS记录的新旧目标差异。

### 4. TTL风险检查

**POST** `/{id}/ttl-check`

评估TTL配置风险，生成整体风险等级和结论。

### 5. 更新状态

**PUT** `/{id}/status`

```json
{
  "targetStatus": "READY_FOR_SWITCH",
  "comment": "所有检查已通过"
}
```

**状态流转图**:

```
CREATED → DIFF_CALCULATED → TTL_CHECKED → READY_FOR_SWITCH → SWITCH_CONFIRMED → ROLLBACK_RECORDED → COMPLETED
                          ↓                 ↓                    ↓
                        FAILED            FAILED               FAILED
```

### 6. 人工修正

**PUT** `/{id}/correction`

```json
{
  "correctionReason": "修正了错误的旧IP地址",
  "correctedRecords": [
    {
      "domainName": "api.example.com",
      "recordType": "A",
      "oldTarget": "192.168.1.200",
      "newTarget": "10.0.0.50",
      "ttl": 300,
      "expectedTtl": 300
    }
  ]
}
```

### 7. 导出预演报告

**GET** `/{id}/report`

导出文本格式的详细预演报告。

### 8. 删除预演

**DELETE** `/{id}`

## 状态枚举

| 状态 | 说明 |
|------|------|
| CREATED | 已创建 |
| DIFF_CALCULATED | 差异计算完成 |
| TTL_CHECKED | TTL风险检查完成 |
| READY_FOR_SWITCH | 准备切换 |
| SWITCH_CONFIRMED | 切换已确认 |
| ROLLBACK_RECORDED | 回滚已记录 |
| COMPLETED | 已完成 |
| FAILED | 失败 |

## 风险等级

- **LOW**: TTL配置合理，可以安全切换
- **MEDIUM**: TTL较高（>10分钟），建议降低
- **HIGH**: TTL很高（>1小时），必须先降低TTL后再切换
- **CRITICAL**: 极高风险（保留扩展）

## 运行测试

```bash
# 运行所有单元测试
mvn test

# 运行单个测试类
mvn test -Dtest=DnsPreplayServiceTest
```

测试覆盖场景:
- ✅ 正常完整流程
- ✅ 脏数据验证
- ✅ 重复创建（重名检测）
- ✅ 查询不存在的资源
- ✅ 无效状态转换
- ✅ 人工修正后重新计算
- ✅ TTL高风险场景验证
- ✅ 报告导出功能
- ✅ 回滚信息记录

## 自检脚本 (curl)

```bash
# 1. 创建预演
curl -X POST http://localhost:8080/api/preplays \
  -H "Content-Type: application/json" \
  -d '{
    "preplayName": "API自检预演",
    "description": "curl自动测试",
    "createdBy": "auto-test",
    "records": [
      {
        "domainName": "test.example.com",
        "recordType": "A",
        "oldTarget": "1.1.1.1",
        "newTarget": "2.2.2.2",
        "ttl": 3600,
        "expectedTtl": 300
      }
    ]
  }'

# 2. 计算差异
curl -X POST http://localhost:8080/api/preplays/1/diff

# 3. 检查TTL风险
curl -X POST http://localhost:8080/api/preplays/1/ttl-check

# 4. 推进状态
curl -X PUT http://localhost:8080/api/preplays/1/status \
  -H "Content-Type: application/json" \
  -d '{"targetStatus": "READY_FOR_SWITCH"}'

# 5. 查询详情
curl http://localhost:8080/api/preplays/1

# 6. 导出报告
curl http://localhost:8080/api/preplays/1/report
```

## 项目结构

```
src/
├── main/
│   ├── java/com/dns/preplay/
│   │   ├── DnsPreplayApplication.java      # 启动类
│   │   ├── config/
│   │   │   └── DataInitializer.java        # 样例数据初始化
│   │   ├── controller/
│   │   │   └── DnsPreplayController.java   # REST接口
│   │   ├── exception/
│   │   │   ├── GlobalExceptionHandler.java # 全局异常处理
│   │   │   └── *Exception.java             # 自定义异常
│   │   ├── model/
│   │   │   ├── entity/                     # JPA实体
│   │   │   ├── dto/                        # 请求/响应DTO
│   │   │   └── enums/                      # 枚举类型
│   │   ├── repository/                     # 数据访问层
│   │   ├── service/                        # 业务逻辑层
│   │   └── util/                           # 工具类
│   └── resources/
│       └── application.yml                  # 配置文件
└── test/
    └── java/com/dns/preplay/
        └── DnsPreplayServiceTest.java       # 单元测试
```

## 样例数据

应用启动时会自动创建2个样例预演:
1. 生产环境域名切换预演
2. 测试环境DNS更新

可以通过 `/api/preplays` 接口查询。
