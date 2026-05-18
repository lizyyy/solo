# 体检中心体检报告补寄 API 设计文档

## 1. 数据模型

### 1.1 体检报告补寄记录 (SupplementRecord)

```typescript
interface SupplementRecord {
  supplementId: string;
  batchNumber: string;
  physicalExaminationCenter: string;
  reportType: '个人' | '单位团检';
  examineeName: string;
  examineeIdCard: string;
  examineePhone: string;
  unitName?: string;
  unitId?: string;
  originalMailingAddress: string;
  correctedMailingAddress: string;
  originalRecipient: string;
  correctedRecipient: string;
  originalPhone: string;
  correctedPhone: string;
  supplementReason: string;
  reportPrintDate: string;
  originalShipDate?: string;
  supplementApplyDate: string;
  courierCompany: string;
  trackingNumber?: string;
  status: SupplementStatus;
  manualRemarks?: string;
  operator: string;
  createdAt: string;
  updatedAt: string;
}

type SupplementStatus = 
  | '待审核'
  | '已审核待打印'
  | '已打印待寄出'
  | '已寄出'
  | '已签收'
  | '需人工确认'
  | '已取消';
```

### 1.2 导入错误记录 (ImportError)

```typescript
interface ImportError {
  rowIndex: number;
  originalData: Record<string, any>;
  errorReason: string;
  suggestion: string;
}
```

### 1.3 导入响应 (ImportResponse)

```typescript
interface ImportResponse {
  success: boolean;
  totalCount: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  importedIds: string[];
}

interface ImportWarning {
  rowIndex: number;
  originalData: Record<string, any>;
  warningReason: string;
  suggestion: string;
  allowContinueWithRemark: boolean;
}
```

## 2. API 接口定义

### 2.1 导入补寄记录

**接口地址**: `POST /api/supplement-records/import`

**Content-Type**: `application/json` 或 `multipart/form-data`

#### 请求体

```json
{
  "records": [
    {
      "batchNumber": "TJ20260518001",
      "physicalExaminationCenter": "北京协和体检中心",
      "reportType": "单位团检",
      "examineeName": "张三",
      "examineeIdCard": "110101199001011234",
      "examineePhone": "13800138000",
      "unitName": "北京某某科技有限公司",
      "unitId": "UNIT001",
      "originalMailingAddress": "北京市朝阳区某某街道123号",
      "correctedMailingAddress": "北京市海淀区中关村大街1号",
      "originalRecipient": "张三",
      "correctedRecipient": "李四（单位前台）",
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
  "remarks": "批量导入5月18日补寄申请"
}
```

#### 成功响应 (200 OK)

```json
{
  "success": true,
  "totalCount": 100,
  "successCount": 95,
  "errorCount": 3,
  "warningCount": 2,
  "errors": [
    {
      "rowIndex": 12,
      "originalData": {
        "batchNumber": "TJ20260518012",
        "examineeName": "李四",
        "examineeIdCard": "",
        "examineePhone": "13800138001"
      },
      "errorReason": "身份证号不能为空",
      "suggestion": "请补充身份证号信息后重新导入"
    }
  ],
  "warnings": [
    {
      "rowIndex": 45,
      "originalData": {
        "batchNumber": "TJ20260518045",
        "reportType": "单位团检",
        "correctedRecipient": "王五",
        "correctedMailingAddress": "北京市朝阳区某某小区3号楼501"
      },
      "warningReason": "单位团检报告拟寄往个人住宅地址",
      "suggestion": "请确认是否为员工个人补寄需求，添加备注后可继续",
      "allowContinueWithRemark": true
    }
  ],
  "importedIds": ["SUP2026051800001", "SUP2026051800002"]
}
```

#### 错误响应 (400 Bad Request)

```json
{
  "success": false,
  "errorCode": "INVALID_REQUEST",
  "errorMessage": "请求格式错误",
  "details": "records 字段不能为空，至少需要一条记录"
}
```

## 3. 特殊业务规则

### 3.1 单位团检报告寄往个人地址检测
- **触发条件**: reportType = '单位团检' 且 correctedMailingAddress 不包含单位名称相关关键词
- **处理方式**: 产生警告，允许人工添加备注后继续导入

### 3.2 补寄日志一致性检查
- **触发条件**: 同一 batchNumber 存在多条补寄记录，且状态变化时间线矛盾
- **处理方式**: 产生警告，允许人工添加备注后继续导入

### 3.3 重复提交检测
- **触发条件**: 相同 batchNumber + examineeIdCard 已存在记录
- **处理方式**: 产生错误，除非设置 `forceUpdate: true`

### 3.4 状态越级检测
- **触发条件**: 状态从 '待审核' 直接变更为 '已寄出' 等非正常流程
- **处理方式**: 产生错误，提示正确的状态流转顺序

## 4. 状态流转图

```
待审核 → 已审核待打印 → 已打印待寄出 → 已寄出 → 已签收
   ↓              ↓              ↓            ↓
 需人工确认    需人工确认    需人工确认   需人工确认
   ↓
 已取消
```
