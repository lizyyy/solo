# 供应商资料校验API

本地可启动的供应商资料校验服务，重点关注状态管理、历史记录追踪和数据导出功能。

## 功能特性

- ✅ **字段校验**: 营业执照、联系人、付款信息等关键字段校验
- ✅ **缺失拦截**: 自动检测缺失字段并拦截
- ✅ **修正历史**: 完整记录所有人工修正操作
- ✅ **幂等提交**: 重复提交相同数据返回已有结果
- ✅ **报告导出**: 支持 JSON 和 Excel 格式报告导出
- ✅ **异常处理**: 保留原始输入和处理依据
- ✅ **状态管理**: pending -> validating -> passed/failed -> corrected

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init
```

### 3. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口说明

### 基础检查

```bash
curl http://localhost:3000/health
```

### 创建供应商（带校验）

```bash
curl -X POST http://localhost:3000/api/vendors \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VENDOR001",
    "vendor_name": "示例供应商有限公司",
    "business_license": "91110108MA001ABC12",
    "business_license_expiry": "2030-12-31",
    "contact_person": "张三",
    "contact_phone": "13800138000",
    "contact_email": "zhangsan@example.com",
    "payment_bank": "中国工商银行北京分行",
    "payment_account": "6222020200010001234",
    "payment_account_name": "示例供应商有限公司"
  }'
```

### 查询供应商列表

```bash
# 查询所有
curl http://localhost:3000/api/vendors

# 按状态筛选
curl http://localhost:3000/api/vendors?status=failed

# 分页
curl http://localhost:3000/api/vendors?limit=10&offset=0
```

### 查询供应商详情（含历史）

```bash
curl http://localhost:3000/api/vendors/VENDOR001
```

### 更新供应商状态

```bash
curl -X PUT http://localhost:3000/api/vendors/VENDOR001/status \
  -H "Content-Type: application/json" \
  -d '{"status": "corrected"}'
```

### 添加人工修正记录

```bash
curl -X POST http://localhost:3000/api/vendors/corrections \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VENDOR001",
    "validation_id": "your-validation-id",
    "field_name": "contact_phone",
    "old_value": "13800138000",
    "new_value": "13900139000",
    "corrected_by": "管理员",
    "correction_note": "电话号码有误，已修正"
  }'
```

### 查询缺失项

```bash
curl http://localhost:3000/api/vendors/validations/{validation_id}/missing-items
```

### 标记缺失项已解决

```bash
curl -X PUT http://localhost:3000/api/vendors/missing-items/{missing_item_id}/resolve
```

### 导出 JSON 报告

```bash
curl -X POST http://localhost:3000/api/vendors/VENDOR001/export/json \
  -H "Content-Type: application/json" \
  -d '{"validation_id": "your-validation-id"}'
```

### 导出 Excel 报告

```bash
curl -X POST http://localhost:3000/api/vendors/VENDOR001/export/excel \
  -H "Content-Type: application/json" \
  -d '{"validation_id": "your-validation-id"}'
```

导出的 Excel 文件保存在 `data/` 目录下

### 查询所有报告

```bash
curl http://localhost:3000/api/vendors/reports
```

## 异常路径示例

### 1. 缺失关键字段（被拦截）

提交缺少营业执照和联系电话的数据：

```bash
curl -X POST http://localhost:3000/api/vendors \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VENDOR002",
    "vendor_name": "测试供应商",
    "contact_person": "李四",
    "payment_bank": "中国建设银行"
  }'
```

预期响应（被拦截）：

```json
{
  "success": true,
  "data": {
    "vendor": { ... },
    "validation": {
      "status": "failed",
      "missingCount": 5,
      "errors": [
        { "fieldLabel": "营业执照号", "error_type": "missing", "message": "营业执照号格式不正确" },
        { "fieldLabel": "联系电话", "error_type": "missing", "message": "联系电话格式不正确" },
        { "fieldLabel": "联系邮箱", "error_type": "missing", "message": "联系邮箱格式不正确" },
        { "fieldLabel": "银行账号", "error_type": "missing", "message": "银行账号格式不正确" },
        { "fieldLabel": "账户名称", "error_type": "missing", "message": "账户名称不能为空" }
      ],
      "message": "发现 5 个缺失或错误字段，已拦截"
    }
  }
}
```

### 2. 格式错误校验

提交格式错误的邮箱和电话：

```bash
curl -X POST http://localhost:3000/api/vendors \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VENDOR003",
    "vendor_name": "格式测试公司",
    "business_license": "91110108MA001ABC12",
    "business_license_expiry": "2030-12-31",
    "contact_person": "王五",
    "contact_phone": "12345",
    "contact_email": "not-an-email",
    "payment_bank": "中国银行",
    "payment_account": "123",
    "payment_account_name": "格式测试公司"
  }'
```

### 3. 重复提交幂等测试

连续两次提交完全相同的数据：

```bash
# 第一次提交
curl -X POST http://localhost:3000/api/vendors \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VENDOR004",
    "vendor_name": "幂等测试公司",
    "business_license": "91110108MA001ABC12",
    "business_license_expiry": "2030-12-31",
    "contact_person": "赵六",
    "contact_phone": "13800138000",
    "contact_email": "zhaoliu@example.com",
    "payment_bank": "中国农业银行",
    "payment_account": "6228480012345678901",
    "payment_account_name": "幂等测试公司"
  }'

# 第二次提交（相同内容）
curl -X POST http://localhost:3000/api/vendors \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VENDOR004",
    "vendor_name": "幂等测试公司",
    "business_license": "91110108MA001ABC12",
    "business_license_expiry": "2030-12-31",
    "contact_person": "赵六",
    "contact_phone": "13800138000",
    "contact_email": "zhaoliu@example.com",
    "payment_bank": "中国农业银行",
    "payment_account": "6228480012345678901",
    "payment_account_name": "幂等测试公司"
  }'
```

第二次提交预期响应：

```json
{
  "success": true,
  "data": {
    "vendor": { ... },
    "validation": {
      "idempotent": true,
      "existingValidationId": "...",
      "status": "passed",
      "message": "重复提交，返回已有校验结果"
    }
  }
}
```

## 数据模型

### 供应商表 (vendors)
- vendor_code: 供应商编号（唯一）
- vendor_name: 供应商名称
- business_license: 营业执照号
- business_license_expiry: 营业执照有效期
- contact_person: 联系人
- contact_phone: 联系电话
- contact_email: 联系邮箱
- payment_bank: 开户银行
- payment_account: 银行账号
- payment_account_name: 账户名称
- status: 状态 (pending/validating/passed/failed/corrected)
- raw_input: 原始输入

### 校验规则表 (validation_rules)
- field_name: 字段名
- field_label: 字段标签
- required: 是否必填
- validation_type: 校验类型
- validation_pattern: 校验正则
- error_message: 错误提示

### 校验记录表 (validation_records)
- validation_id: 校验ID（唯一）
- vendor_code: 供应商编号
- status: 校验状态
- raw_input: 原始输入
- validation_result: 校验结果

### 缺失项表 (missing_items)
- validation_id: 校验ID
- vendor_code: 供应商编号
- field_name: 字段名
- field_label: 字段标签
- error_type: 错误类型
- error_message: 错误信息
- resolved: 是否已解决

### 修正记录表 (correction_records)
- vendor_code: 供应商编号
- validation_id: 校验ID
- field_name: 字段名
- old_value: 原值
- new_value: 新值
- corrected_by: 修正人
- correction_note: 修正备注

### 校验报告表 (validation_reports)
- report_id: 报告ID（唯一）
- vendor_code: 供应商编号
- validation_id: 校验ID
- report_type: 报告类型 (json/excel)
- report_content: 报告内容
- status: 报告状态

## 目录结构

```
.
├── src/
│   ├── app.js                 # 主应用入口
│   ├── models/
│   │   └── database.js        # 数据库连接
│   ├── routes/
│   │   └── vendorRoutes.js    # API路由
│   └── services/
│       ├── validationService.js  # 校验服务
│       ├── vendorService.js      # 供应商服务
│       └── exportService.js      # 导出服务
├── scripts/
│   └── init-db.js            # 数据库初始化脚本
├── data/                      # 数据库和导出文件目录
├── package.json
└── README.md
```

## 技术栈

- Node.js + Express
- SQLite3（本地文件数据库）
- Joi（参数校验）
- XLSX（Excel导出）
- UUID（唯一标识）
