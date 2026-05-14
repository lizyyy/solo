# 批量账号冻结后端服务

## 项目概述

基于Spring Boot + MyBatis Plus构建的企业级批量账号冻结后端服务，完整支持业务需求中的所有核心功能。

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

### 5. 规则版本化
- 规则版本号与批次绑定
- 历史批次可追溯当时的判断口径
- 支持规则变更不影响历史数据

### 6. 幂等性保证
- 同一批内容重复提交自动复用
- 检测并提示历史相同批次

### 7. 清理/回滚机制
- 先生成候选清单
- 双人复核确认后执行
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
- **构建工具**: Maven

## 项目结构

```
batch-account-freeze/
├── src/main/java/com/account/freeze/
│   ├── BatchAccountFreezeApplication.java    # 启动类
│   ├── config/                                # 配置类
│   │   ├── AsyncConfig.java
│   │   └── GlobalExceptionHandler.java
│   ├── controller/                            # 控制器
│   │   └── FreezeBatchController.java
│   ├── dto/                                   # 数据传输对象
│   │   ├── BatchPreviewResult.java
│   │   ├── BatchItemPreview.java
│   │   ├── SmsBatchCreateDTO.java
│   │   └── SmsItemDTO.java
│   ├── entity/                                # 实体类
│   │   ├── FreezeBatch.java
│   │   ├── FreezeBatchItem.java
│   │   ├── FreezeReport.java
│   │   ├── EvidenceChain.java
│   │   ├── CandidateList.java
│   │   └── OperationLog.java
│   ├── enums/                                 # 枚举类
│   │   ├── BatchStatus.java
│   │   ├── BatchItemStatus.java
│   │   ├── BatchType.java
│   │   └── EvidenceChainStatus.java
│   ├── mapper/                                # 数据访问层
│   ├── service/                               # 业务逻辑层
│   └── common/                                # 公共类
└── src/main/resources/
    ├── application.yml
    └── sql/schema.sql
```

## 数据库设计

### 核心表结构
1. **freeze_batch** - 冻结批次表
2. **freeze_batch_item** - 批次明细表
3. **evidence_chain** - 证据链表
4. **freeze_rule** - 冻结规则表
5. **candidate_list** - 候选清单表
6. **operation_log** - 操作日志表
7. **freeze_report** - 冻结报告表

## API接口

### 1. 创建短信补录批次
```http
POST /api/batch/sms/create
Content-Type: application/json

{
  "batchName": "风控冻结批次-20240115",
  "remark": "根据短信预警名单执行冻结",
  "operator": "admin",
  "items": [
    {
      "accountNo": "ACC001",
      "accountName": "张三",
      "phone": "13800138000",
      "smsContent": "【银行】您的账户存在异常交易，请核实",
      "smsSendTime": "2024-01-15T10:30:00",
      "remark": "高风险预警"
    }
  ]
}
```

### 2. 预览批次
```http
GET /api/batch/{batchNo}/preview?operator=admin
```

### 3. 确认预览
```http
POST /api/batch/{batchNo}/preview/confirm?operator=admin
```

### 4. 执行冻结
```http
POST /api/batch/{batchNo}/execute?operator=admin
```

### 5. 查询执行状态
```http
GET /api/batch/{batchNo}/status
```

### 6. 生成报告
```http
POST /api/batch/{batchNo}/report?operator=admin
```

## 业务流程

```
创建批次 → 预览确认 → 执行冻结 → 生成报告
    ↓           ↓          ↓
  幂等校验   风险提示   异步执行
                            ↓
                        逐笔记录状态
                            ↓
                        证据链完整性检查
                            ↓
                  成功/失败分别统计
```

## 异常处理设计

### 证据链断裂场景
- 短信内容缺失 → 标记证据链断裂 → 冻结失败
- 物流证据缺失 → 标记待复核 → 暂停执行
- 系统异常 → 记录错误日志 → 支持重试

### 部分成功处理
- 成功的账号：状态更新为已冻结
- 失败的账号：保留失败原因
- 批次状态：标记为 PARTIAL_SUCCESS

## 部署说明

1. 创建MySQL数据库并执行 `src/main/resources/sql/schema.sql`
2. 修改 `application.yml` 中的数据库连接配置
3. 执行 `mvn clean package` 打包
4. 执行 `java -jar target/batch-account-freeze-1.0.0.jar` 启动

## 扩展建议

1. 接入真实的账号冻结系统接口
2. 实现规则引擎支持复杂条件判断
3. 增加Excel批量导入功能
4. 接入文件存储系统保存截图证据
5. 增加审批流支持多级审核
