# 体检中心体检报告补寄 API

一个完整的体检报告补寄管理系统导入接口，支持数据验证、错误报告、警告机制和人工备注处理。

## 核心特性

### ✅ 数据验证
- 必填字段验证（19个必填字段）
- 身份证号格式验证（18位）
- 手机号格式验证（11位）
- 日期格式验证（YYYY-MM-DD）
- 状态值合法性验证
- 报告类型合法性验证

### ⚠️ 警告机制（可人工备注后继续）
- 单位团检报告寄往个人地址检测
- 补寄日志一致性检查（时间线矛盾）
- 特殊业务规则警告

### ❌ 错误阻止
- 重复提交检测
- 状态越级检测

## 项目结构

```
├── server.js                 # Express 服务器入口
├── package.json              # 项目依赖配置
├── api-design.md            # API 详细设计文档
├── models/
│   └── SupplementRecord.js  # 数据模型和状态流转定义
├── validators/
│   └── importValidator.js   # 业务规则验证器
├── controllers/
│   └── importController.js  # 导入逻辑控制器
├── routes/
│   └── importRoutes.js      # 路由定义
├── test/
│   └── import.test.js       # 边界测试用例
└── example-data/
    └── sample-import.json   # 示例导入数据
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行测试

```bash
npm test
```

### 3. 启动服务器

```bash
npm start
# 或开发模式
npm run dev
```

服务器启动后访问: http://localhost:3000

## API 接口

### 1. 导入补寄记录

**POST** `/api/supplement-records/import`

**请求体:**
```json
{
  "records": [
    {
      "batchNumber": "TJ20260518001",
      "physicalExaminationCenter": "北京协和体检中心",
      "reportType": "个人",
      "examineeName": "张三",
      "examineeIdCard": "110101199001011234",
      "examineePhone": "13800138000",
      "originalMailingAddress": "北京市朝阳区某某街道123号",
      "correctedMailingAddress": "北京市海淀区中关村大街1号",
      "originalRecipient": "张三",
      "correctedRecipient": "李四",
      "originalPhone": "13800138000",
      "correctedPhone": "13900139000",
      "supplementReason": "地址错误无法送达",
      "reportPrintDate": "2026-05-10",
      "supplementApplyDate": "2026-05-18",
      "courierCompany": "顺丰速运",
      "status": "待审核",
      "operator": "王小明"
    }
  ],
  "ignoreWarnings": false,
  "remarks": "批量导入说明"
}
```

**响应示例（含错误和警告）:**
```json
{
  "success": false,
  "totalCount": 5,
  "successCount": 2,
  "errorCount": 1,
  "warningCount": 1,
  "errors": [
    {
      "rowIndex": 3,
      "originalData": { ... },
      "errorReason": "身份证号格式无效: 1234567890",
      "suggestion": "请输入有效的18位身份证号"
    }
  ],
  "warnings": [
    {
      "rowIndex": 4,
      "originalData": { ... },
      "warningReason": "单位团检报告拟寄往个人住宅地址",
      "suggestion": "请确认是否为员工个人补寄需求，添加备注后可继续",
      "allowContinueWithRemark": true
    }
  ],
  "importedIds": ["SUP2026051800001", "SUP2026051800002"]
}
```

### 2. 查询已导入记录

**GET** `/api/supplement-records/records?page=1&pageSize=20&batchNumber=&status=`

### 3. 添加人工备注并继续

**PATCH** `/api/supplement-records/records/:supplementId/remark`

```json
{
  "manualRemarks": "已确认是员工个人补寄需求，员工已离职",
  "status": "已审核待打印"
}
```

### 4. 健康检查

**GET** `/health`

## 状态流转

```
待审核 → 已审核待打印 → 已打印待寄出 → 已寄出 → 已签收
   ↓              ↓              ↓            ↓
需人工确认    需人工确认    需人工确认   需人工确认
   ↓
已取消
```

## 必填字段列表

| 字段名 | 说明 | 示例 |
|--------|------|------|
| batchNumber | 批次号 | TJ20260518001 |
| physicalExaminationCenter | 体检中心 | 北京协和体检中心 |
| reportType | 报告类型 | 个人 / 单位团检 |
| examineeName | 体检人姓名 | 张三 |
| examineeIdCard | 身份证号 | 110101199001011234 |
| examineePhone | 手机号 | 13800138000 |
| originalMailingAddress | 原邮寄地址 | ... |
| correctedMailingAddress | 更正后地址 | ... |
| originalRecipient | 原收件人 | ... |
| correctedRecipient | 更正后收件人 | ... |
| originalPhone | 原联系电话 | ... |
| correctedPhone | 更正后电话 | ... |
| supplementReason | 补寄原因 | ... |
| reportPrintDate | 报告打印日期 | 2026-05-10 |
| supplementApplyDate | 补寄申请日期 | 2026-05-18 |
| courierCompany | 快递公司 | 顺丰速运 |
| status | 状态 | 待审核 |
| operator | 操作员 | 王小明 |

## 测试覆盖情况

运行 `npm test` 可执行以下边界测试：

1. ✅ 缺少必填字段
2. ✅ 身份证号格式错误
3. ✅ 手机号格式错误
4. ✅ 日期格式错误
5. ✅ 状态值无效
6. ✅ 报告类型无效
7. ✅ 单位团检寄往个人地址（警告）
8. ✅ 单位团检寄往单位地址（无警告）
9. ✅ 状态越级检测
10. ✅ 完全合法的个人记录
11. ✅ 完全合法的单位团检记录
12. ✅ 多个字段同时缺失
13. ✅ 补寄日志一致性检测
14. ✅ 忽略警告功能

## 使用示例

### 使用 curl 测试导入

```bash
curl -X POST http://localhost:3000/api/supplement-records/import \
  -H "Content-Type: application/json" \
  -d @example-data/sample-import.json
```

### 强制更新已存在的记录

```json
{
  "records": [...],
  "forceUpdate": true,
  "remarks": "更新已存在的记录"
}
```

### 忽略警告直接导入

```json
{
  "records": [...],
  "ignoreWarnings": true
}
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| INVALID_REQUEST | 请求格式错误 |
| MISSING_REMARK | 人工备注不能为空 |
| RECORD_NOT_FOUND | 记录不存在 |
| INTERNAL_SERVER_ERROR | 服务器内部错误 |
| NOT_FOUND | 接口不存在 |

## 技术栈

- **Node.js** - 运行环境
- **Express** - Web 框架
- **moment** - 日期处理
- **cors** - 跨域支持
- **body-parser** - 请求体解析
