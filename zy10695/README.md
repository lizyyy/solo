# 数据脱敏服务 - 豁免审批 API

## 项目概述

本项目实现了数据脱敏服务的脱敏规则豁免审批管理功能。对少数导出任务需要明文字段时，提供豁免审批管理，并可追踪审计。

### 核心特性

- ✅ 豁免审批记录管理（CRUD）
- ✅ 嵌套 JSON 字段支持
- ✅ 字段别名匹配
- ✅ 到期自动拦截检查
- ✅ 批量导入（含坏行处理）
- ✅ 导出豁免审批表
- ✅ 操作日志追踪

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库和种子数据

```bash
npm run seed
```

> 种子数据包含：
> - 嵌套 JSON 字段：4条
> - 字段别名：8条（全部记录）
> - 审批过期：3条
> - 生效中：5条

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 4. 健康检查

```bash
curl http://localhost:3000/api/health
```

---

## API 接口文档

### 一、豁免审批管理

#### 1.1 创建豁免审批

**接口：** `POST /api/exemptions`

**输入：**
```json
{
  "datasetName": "用户核心数据集",
  "datasetCode": "USER_CORE_001",
  "fieldName": "手机号",
  "fieldAlias": "mobile",
  "fieldPath": "profile.contact.mobile",
  "exemptionReason": "运营活动需要发送短信通知，需真实手机号",
  "approver": "张三",
  "approverEmail": "zhangsan@company.com",
  "expireDate": "2025-06-30T00:00:00.000Z",
  "createdBy": "李四",
  "isNestedJson": true,
  "metadata": {"department": "运营部"}
}
```

**必填字段：**
- datasetName: 数据集名称
- datasetCode: 数据集编码
- fieldName: 字段名称
- exemptionReason: 豁免原因（至少10字符）
- approver: 审批人
- expireDate: 到期时间（必须大于当前时间）
- createdBy: 创建人

**处理：**
- 验证所有必填字段
- 检查是否已存在相同数据集+字段的生效审批
- 存储到数据库

**输出：**
```json
{
  "success": true,
  "message": "豁免审批创建成功",
  "data": {
    "id": "uuid",
    "datasetName": "用户核心数据集",
    "status": "active",
    "createdAt": "2025-05-18T...",
    "updatedAt": "2025-05-18T..."
  }
}
```

#### 1.2 查询豁免审批列表

**接口：** `GET /api/exemptions`

**查询参数：**
- datasetCode: 数据集编码
- fieldName: 字段名称（模糊匹配）
- status: 状态（active/expired/revoked）
- approver: 审批人
- isExpired: 是否过期（true/false）
- page: 页码（默认1）
- pageSize: 每页条数（默认20）

**输出：**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 8,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

#### 1.3 查询单条详情

**接口：** `GET /api/exemptions/:id`

#### 1.4 更新豁免审批

**接口：** `PUT /api/exemptions/:id`

**输入：** 同创建接口

#### 1.5 撤销豁免审批

**接口：** `DELETE /api/exemptions/:id`

**处理：** 软删除，状态改为 revoked

#### 1.6 查询即将到期的审批

**接口：** `GET /api/exemptions/expiring/soon?days=7`

---

### 二、导出豁免检查

#### 2.1 导出前豁免检查

**接口：** `POST /api/export/check`

**输入：**
```json
{
  "exportId": "EXPORT_001",
  "datasetCode": "USER_CORE_001",
  "fields": ["身份证号", "手机号", "银行卡号"],
  "exportedBy": "导出操作员"
}
```

**处理逻辑：**
1. 匹配字段（fieldName / fieldAlias / fieldPath）
2. 检查豁免审批状态和到期时间
3. 分类：生效审批 / 过期审批 / 无审批
4. 返回结果并记录操作日志

**匹配字段优先级：**
- fieldName: 字段名称
- fieldAlias: 字段别名
- fieldPath: 嵌套JSON路径

**输出：**

**情况1：全部字段有效（200）**
```json
{
  "success": true,
  "exportId": "EXPORT_001",
  "status": "allowed",
  "message": "所有字段豁免审批有效，允许明文导出",
  "approvedFields": [
    {"fieldName": "身份证号", "fieldAlias": "id_number", "approver": "张三", ...}
  ],
  "needReapprovalFields": []
}
```

**情况2：部分/全部字段有问题（403）**
```json
{
  "success": true,
  "exportId": "EXPORT_001",
  "status": "partial",
  "message": "部分字段豁免审批有问题，需处理后重新导出",
  "approvedFields": [...],
  "needReapprovalFields": [
    {
      "fieldName": "收款人姓名",
      "fieldAlias": "payee_name",
      "reason": "豁免审批已过期，需重新申请"
    },
    {
      "fieldName": "不存在的字段",
      "reason": "未找到豁免审批记录"
    }
  ]
}
```

#### 2.2 查询导出日志

**接口：** `GET /api/export/logs`

---

### 三、批量导入导出

#### 3.1 批量导入豁免审批

**接口：** `POST /api/batch/import`

**输入：** form-data
- file: CSV文件
- importedBy: 导入人

**CSV格式支持中英文表头：**

| 英文字段名 | 中文表头 | 说明 |
|-----------|---------|------|
| datasetName | 数据集名称 | 必填 |
| datasetCode | 数据集编码 | 必填 |
| fieldName | 字段名称 | 必填 |
| fieldAlias | 字段别名 | 可选 |
| fieldPath | 字段路径 | 可选（嵌套JSON） |
| exemptionReason | 豁免原因 | 必填（至少10字符） |
| approver | 审批人 | 必填 |
| approverEmail | 审批人邮箱 | 可选 |
| expireDate | 到期时间 | 必填 |
| createdBy | 创建人 | 可选 |
| isNestedJson | 是否嵌套JSON | true/false |
| metadata | 元数据 | JSON字符串 |

**坏行处理：**
- 逐行验证，不合法的记录会被记录但不中断导入
- 返回成功/失败数量和详细错误信息

**输出：**
```json
{
  "success": true,
  "message": "批量导入完成: 成功 1 条, 失败 4 条",
  "batchId": "BATCH_1234567890",
  "data": {
    "total": 5,
    "success": 1,
    "failed": 4,
    "failedDetails": [
      {
        "row": 1,
        "record": {...},
        "errors": ["数据集名称不能为空"]
      },
      {
        "row": 2,
        "record": {...},
        "errors": ["豁免原因至少需要10个字符"]
      }
    ]
  }
}
```

#### 3.2 查询导入日志

**接口：** `GET /api/batch/import/logs`

#### 3.3 导出豁免审批表

**接口：** `GET /api/batch/export`

**查询参数：**
- datasetCode: 数据集编码过滤
- status: 状态过滤
- approver: 审批人过滤

**输出：** CSV文件下载

---

## 测试命令

### 运行全部测试

```bash
npm test
```

### 单独运行测试场景

```bash
# 测试正常记录（创建、查询、导出）
npm run test:normal

# 测试异常记录（参数错误、过期字段、坏行）
npm run test:abnormal

# 测试重复运行记录（重复创建冲突）
npm run test:repeat
```

### 生成示例导入文件

```bash
npm run export
```

---

## 测试场景说明

### 场景1：正常记录 ✅

**测试目标：** 验证完整的正常业务流程

**测试内容：**
1. 创建一条有效的豁免审批
2. 查询列表验证数据已入库
3. 查询单条详情
4. 更新豁免审批
5. 导出检查（有效字段）

**预期结果：** 全部操作成功，返回200状态码

---

### 场景2：异常记录 ❌

**测试目标：** 验证错误处理和边界情况

**测试内容：**
1. 创建豁免审批（缺少必填参数）→ 400
2. 导出检查（全部是过期字段）→ 403 blocked
3. 导出检查（混合有效/过期/不存在字段）→ 403 partial
4. 生成包含坏行的测试CSV文件
5. 查询导出日志

**预期结果：**
- 参数验证失败返回400和详细错误
- 过期字段拦截返回403和需重新审批列表
- 坏行文件生成成功，可用于导入测试

---

### 场景3：重复运行记录 🔄

**测试目标：** 验证幂等性和防重复

**测试内容：**
1. 第一次创建豁免审批 → 成功 201
2. 第二次创建相同数据集+字段 → 冲突 409
3. 第三次创建相同数据集+字段 → 冲突 409
4. 查询即将到期的审批
5. 查询导入日志

**预期结果：**
- 重复创建返回409冲突
- 不会产生重复数据
- 日志查询正常

---

## 人工复核清单

请按以下清单进行人工复核：

### 1. 种子数据验证 ✅
- [ ] 数据库中共有8条记录
- [ ] 嵌套JSON字段4条（fieldPath不为空）
- [ ] 全部8条都有fieldAlias字段别名
- [ ] 过期审批3条（TRADE_001两条，MEMBER_001一条）
- [ ] 生效中5条

### 2. API功能验证 ✅
- [ ] 创建豁免审批成功，返回201
- [ ] 重复创建相同字段返回409
- [ ] 查询列表支持分页和过滤
- [ ] 更新和撤销功能正常
- [ ] 导出检查正确识别过期字段
- [ ] 导出检查正确识别不存在字段
- [ ] 混合字段返回partial状态

### 3. 批量导入验证 ✅
- [ ] 导入正确识别中英文表头
- [ ] 坏行被正确记录，不中断导入
- [ ] 返回详细的错误信息（行号、字段、原因）
- [ ] 导入日志可查询

### 4. 导出功能验证 ✅
- [ ] 导出CSV文件格式正确
- [ ] 包含所有必要字段
- [ ] 支持按条件过滤导出

### 5. 可追踪性验证 ✅
- [ ] 每条豁免审批有创建人、审批人
- [ ] 有创建时间、更新时间
- [ ] 导出操作有日志记录
- [ ] 导入操作有批次日志

---

## 项目结构

```
.
├── src/
│   ├── app.js                 # 主应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── models/
│   │   ├── Exemption.js       # 豁免审批模型
│   │   ├── ImportLog.js       # 导入日志模型
│   │   └── ExportLog.js       # 导出日志模型
│   ├── middleware/
│   │   └── validation.js      # 参数验证中间件
│   ├── routes/
│   │   ├── exemptions.js      # 豁免审批路由
│   │   ├── exportCheck.js     # 导出检查路由
│   │   └── batchImport.js     # 批量导入导出路由
│   └── scripts/
│       ├── seed.js            # 种子数据脚本
│       ├── test.js            # 测试脚本
│       └── export.js          # 示例文件生成
├── data/                      # SQLite数据库文件
├── uploads/                   # 临时上传文件
├── exports/                   # 导出文件
├── package.json
└── README.md
```

---

## 字段匹配逻辑详解

导出检查时，系统会按以下方式匹配字段：

```
导出字段 = "mobile"
    ↓
1. 匹配 fieldName = "mobile"？
    ↓ 否
2. 匹配 fieldAlias = "mobile"？
    ↓ 是 → 找到对应豁免审批
    ↓
3. 检查 status == "active" 且 expireDate > now
    ↓
4. 通过 / 拦截
```

支持三种字段标识同时匹配，满足任一即可。

---

## 合规说明

本系统满足合规追踪要求：

1. **审批留痕：** 每条豁免记录包含审批人、审批时间、到期时间
2. **操作审计：** 导出、导入操作全部记录日志
3. **到期拦截：** 过期审批自动拦截，需重新申请
4. **字段追溯：** 支持字段别名和嵌套路径，完整追踪数据流向

---

## 技术栈

- **后端框架：** Express.js
- **数据库：** SQLite + Sequelize ORM
- **参数验证：** Joi
- **日期处理：** Moment.js
- **CSV处理：** csv-parser + json2csv
- **文件上传：** Multer

---

## 常见问题

### Q: 如何重置数据库？
A: 重新运行 `npm run seed`，会重建表并重新插入种子数据

### Q: 嵌套JSON字段如何使用？
A: 设置 `fieldPath` 如 `user.profile.contact.phone`，同时 `isNestedJson: true`

### Q: 导出检查返回403怎么办？
A: 查看 `needReapprovalFields` 列表，处理过期或缺失的豁免审批后重新导出

### Q: 批量导入如何处理错误？
A: 导入会继续执行，错误记录在 `failedDetails` 中，可根据行号修正后重新导入
