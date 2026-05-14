# 批量账号冻结后端服务

## 项目概述

基于 Spring Boot + MyBatis Plus 构建的企业级批量账号冻结后端服务，完整支持业务需求中的所有核心功能。

## 快速开始

### 一键启动

```bash
# 方式1：使用一键启动脚本（推荐）
chmod +x start.sh
./start.sh

# 方式2：使用 Maven Wrapper
chmod +x mvnw
./mvnw clean package -DskipTests
java -jar target/batch-account-freeze-1.0.0.jar

# 方式3：如果已安装 Maven
mvn clean package -DskipTests
java -jar target/batch-account-freeze-1.0.0.jar
```

### 服务验证

服务启动后，运行验证脚本：

```bash
chmod +x verify.sh
./verify.sh
```

或者手动访问：`http://localhost:8080/api`

## 核心功能

### 1. 主流程 - 补录短信发送清单
- 支持创建短信补录批次
- 支持批量导入账号信息
- 输入内容哈希校验，防止重复提交

### 2. 预览机制
- 执行前可预览影响范围
- 预估成功/失败数量
- 检测重复批次并提示

### 3. 执行与状态跟踪
- 异步批量执行冻结
- 保留每条明细的执行状态
- 支持三种批次状态：全部成功、部分成功、全部失败

### 4. 证据链管理
- 每条记录关联完整证据链
- 证据链断裂时自动标记异常
- 支持物流截图复核

### 5. 规则版本化 ✅ 新增完善
- 规则版本号与批次绑定
- 历史批次可追溯当时的判断口径
- 支持规则变更不影响历史数据
- 支持创建新规则版本、禁用旧版本

### 6. 幂等性保证
- 同一批内容重复提交自动复用
- 检测并提示历史相同批次

### 7. 清理/回滚机制 ✅ 新增完整流程
- 先生成候选清单
- 支持单条确认/跳过
- 批量确认后执行
- 防止误操作真实数据

### 8. 报告导出
- 物流拦截截图复核样例
- 摘要串起：输入 → 动作 → 结论
- 完整记录规则版本

## 技术栈

- **框架**: Spring Boot 3.2
- **ORM**: MyBatis Plus
- **数据库**: MySQL 8.0
- **工具库**: Hutool, EasyExcel
- **构建工具**: Maven / Maven Wrapper

## 项目结构

```
batch-account-freeze/
├── src/main/java/com/account/freeze/
│   ├── BatchAccountFreezeApplication.java    # 启动类
│   ├── config/                                # 配置类
│   │   ├── AsyncConfig.java
│   │   └── GlobalExceptionHandler.java
│   ├── controller/                            # 控制器 ✅ 新增3个
│   │   ├── FreezeBatchController.java        # 批次管理
│   │   ├── FreezeRuleController.java         # 规则版本管理
│   │   └── CandidateListController.java      # 候选清单管理
│   ├── dto/                                   # 数据传输对象 ✅ 新增3个
│   │   ├── BatchPreviewResult.java
│   │   ├── BatchItemPreview.java
│   │   ├── SmsBatchCreateDTO.java
│   │   ├── SmsItemDTO.java
│   │   ├── FreezeRuleCreateDTO.java
│   │   └── CandidateListCreateDTO.java
│   ├── entity/                                # 实体类 ✅ 新增3个
│   │   ├── FreezeBatch.java
│   │   ├── FreezeBatchItem.java
│   │   ├── FreezeReport.java
│   │   ├── EvidenceChain.java
│   │   ├── CandidateList.java
│   │   ├── CandidateListItem.java
│   │   ├── FreezeRule.java
│   │   └── OperationLog.java
│   ├── enums/                                 # 枚举类
│   ├── mapper/                                # 数据访问层 ✅ 新增4个
│   ├── service/                               # 业务逻辑层 ✅ 完善3个
│   │   ├── FreezeBatchService.java
│   │   ├── FreezeExecuteService.java
│   │   ├── FreezeRuleService.java            # 规则版本管理服务
│   │   ├── EvidenceChainService.java
│   │   ├── CandidateListService.java          # 候选清单服务
│   │   ├── ReportService.java
│   │   └── OperationLogService.java
│   └── common/                                # 公共类
├── src/main/resources/
│   ├── application.yml
│   └── sql/schema.sql
├── start.sh                                   # 一键启动脚本 ✅ 新增
├── verify.sh                                  # 服务验证脚本 ✅ 新增
└── mvnw                                       # Maven Wrapper ✅ 新增
```

## API 完整文档

### 一、规则版本管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/rule/init | 初始化默认规则 |
| GET | /api/rule/current/version | 获取当前生效的规则版本 |
| GET | /api/rule/version/{version} | 获取指定版本规则详情 |
| GET | /api/rule/list | 获取所有规则版本列表 |
| POST | /api/rule/create | 创建新规则版本 |
| POST | /api/rule/version/{version}/disable | 禁用指定版本规则 |

**创建新规则示例：**
```bash
curl -X POST 'http://localhost:8080/api/rule/create' \
  -H 'Content-Type: application/json' \
  -d '{
    "ruleName": "风控规则V2",
    "ruleContent": "{\"requireSmsEvidence\":true,\"requireLogistics\":true}",
    "ruleDesc": "规则版本2：需要短信+物流双证据",
    "operator": "admin"
  }'
```

### 二、批次管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batch/sms/create | 创建短信补录批次 |
| GET | /api/batch/{batchNo}/preview | 预览批次 |
| POST | /api/batch/{batchNo}/preview/confirm | 确认预览 |
| POST | /api/batch/{batchNo}/execute | 执行批次冻结 |
| GET | /api/batch/{batchNo}/status | 获取批次执行状态 |
| GET | /api/batch/{batchNo} | 获取批次详情 |
| POST | /api/batch/{batchNo}/report | 生成批次报告 |

**创建批次示例：**
```bash
curl -X POST 'http://localhost:8080/api/batch/sms/create' \
  -H 'Content-Type: application/json' \
  -d '{
    "batchName": "2024年1月第一批冻结",
    "remark": "根据风控预警名单",
    "operator": "admin",
    "items": [
      {"accountNo": "ACC001", "accountName": "张三", "phone": "13800138000", "smsContent": "【银行】您的账户存在异常交易"},
      {"accountNo": "ACC002", "accountName": "李四", "phone": "13900139000", "smsContent": "【银行】您的账户存在异常交易"}
    ]
  }'
```

### 三、候选清单管理 API ✅ 新增完整流程

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/candidate/create | 创建候选清单 |
| POST | /api/candidate/rollback/create | 基于批次创建回滚清单 |
| GET | /api/candidate/{listNo} | 获取清单详情 |
| GET | /api/candidate/{listNo}/items | 获取清单项列表 |
| GET | /api/candidate/list | 获取所有候选清单 |
| POST | /api/candidate/item/{itemId}/confirm | 单条确认清单项 |
| POST | /api/candidate/item/{itemId}/skip | 跳过清单项 |
| POST | /api/candidate/{listNo}/confirm | 批量确认清单 |
| POST | /api/candidate/{listNo}/execute | 执行清单（清理/回滚） |
| POST | /api/candidate/{listNo}/cancel | 取消清单 |

**创建回滚清单示例：**
```bash
curl -X POST 'http://localhost:8080/api/candidate/rollback/create?batchNo=FRZ123456789&operator=admin&remark=误操作回滚'
```

**创建清理清单示例：**
```bash
curl -X POST 'http://localhost:8080/api/candidate/create' \
  -H 'Content-Type: application/json' \
  -d '{
    "listName": "过期数据清理清单",
    "listType": "CLEAN",
    "operator": "admin",
    "remark": "清理2023年以前的测试数据",
    "accountNos": ["ACC001", "ACC002", "ACC003"]
  }'
```

## 业务流程详解

### 完整冻结流程

```
1. 初始化规则
   ↓
2. 创建短信补录批次（自动幂等校验）
   ↓
3. 预览批次（检查影响范围、预估成功率）
   ↓
4. 确认预览
   ↓
5. 异步执行冻结
   ├─ 逐个账号处理
   ├─ 生成证据链
   ├─ 记录每条执行状态
   └─ 成功/失败分别统计
   ↓
6. 批次完成（全部成功/部分成功/全部失败）
   ↓
7. 生成执行报告
```

### 回滚/清理流程

```
1. 创建候选清单（可基于批次或指定账号）
   ↓
2. 审核人员逐条确认（可单条确认、可跳过）
   ↓
3. 批量确认清单
   ↓
4. 执行清单（执行时再次校验状态）
   ↓
5. 记录操作日志
```

### 规则版本化流程

```
1. 创建新规则版本（版本号自动+1）
   ↓
2. 新批次自动绑定最新规则版本
   ↓
3. 历史批次永远绑定当时的规则版本
   ↓
4. 可随时查询历史规则的判断口径
   ↓
5. 旧规则可禁用（不影响已执行的批次）
```

## 数据库设计

### 核心表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| freeze_batch | 冻结批次 | batch_no, status, rule_version, input_hash |
| freeze_batch_item | 批次明细 | account_no, status, evidence_chain_id |
| evidence_chain | 证据链 | chain_no, status, sms_evidence, logistics_evidence |
| freeze_rule | 冻结规则 | rule_version, status, effective_time |
| candidate_list | 候选清单 | list_no, list_type, status |
| candidate_list_item | 候选清单项 | account_no, original_status, confirm_operator |
| operation_log | 操作日志 | operation_type, operator, before/after_snapshot |
| freeze_report | 冻结报告 | report_no, summary_abstract, logistics_sample |

## 部署说明

### 前置条件

1. **MySQL 8.0+** 已安装并启动
2. **JDK 17+** 已安装
3. 创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS account_freeze DEFAULT CHARACTER SET utf8mb4;
```

### 数据库初始化

```bash
mysql -u root -p account_freeze < src/main/resources/sql/schema.sql
```

### 配置修改

编辑 `src/main/resources/application.yml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/account_freeze?useUnicode=true&characterEncoding=utf8
    username: your_username
    password: your_password
```

### 生产部署

```bash
# 1. 构建
./mvnw clean package -DskipTests -Pprod

# 2. 运行（使用 systemd 管理更佳）
nohup java -jar target/batch-account-freeze-1.0.0.jar > app.log 2>&1 &
```

## 扩展建议

1. 接入真实的账号冻结系统接口
2. 实现规则引擎支持复杂条件判断（如 Drools）
3. 增加 Excel 批量导入功能（EasyExcel）
4. 接入文件存储系统（MinIO/OSS）保存截图证据
5. 增加审批流支持多级审核（Flowable）
6. 接入消息队列（RocketMQ/Kafka）支持更大批量
7. 增加监控告警（Prometheus + Grafana）

## 验证清单

✅ 已修复问题：
- ✅ 新增 Maven Wrapper 支持无 Maven 环境
- ✅ 完善 FreezeRuleService 实现真正的规则版本化管理
- ✅ 新增 CandidateListController 暴露完整的候选清单流程
- ✅ 新增一键启动脚本 start.sh
- ✅ 新增服务验证脚本 verify.sh
- ✅ 更新 README 提供完整的启动指南和 API 文档

✅ 核心功能验证：
- ✅ 规则版本管理 - 支持多版本规则，历史可追溯
- ✅ 批次管理 - 创建、预览、执行完整流程
- ✅ 幂等性校验 - 基于内容哈希去重
- ✅ 部分成功处理 - 支持部分成功的状态跟踪
- ✅ 候选清单机制 - 清理/回滚前的完整确认流程
- ✅ 证据链管理 - 完整的证据链跟踪
