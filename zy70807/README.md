# 跨境包裹申报补税 API 服务

## 功能特性

- **材料提交与去重**: 相同材料重复提交时自动识别，返回原有处理结果
- **完整验证**: 缺字段、时间矛盾、重复编号时返回精确错误位置
- **状态管理**: 支持待处理、已处理、已退单三种状态
- **统计查询**: 提供完整的申报记录查询和统计功能
- **数据导出**: 导出包含订单金额、品类税率、海关退单原因、处理人等完整信息

## 技术栈

- Node.js + TypeScript
- Express.js
- SQLite3
- json2csv (CSV导出)

## 安装与运行

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 开发模式运行
npm run dev

# 生产模式运行
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口

### 1. 提交申报材料

**POST** `/api/submit`

请求体:
```json
{
  "declarationNo": "申报编号",
  "submitter": "提交人",
  "submitTime": "提交时间(ISO格式)",
  "totalAmount": 订单总金额,
  "customsCode": "海关编码(可选)",
  "logisticsNo": "物流单号(可选)",
  "packages": [
    {
      "itemNo": "品项编号",
      "name": "商品名称",
      "category": "商品品类",
      "quantity": 数量,
      "unitPrice": 单价,
      "currency": "货币类型",
      "taxRate": 税率(0-1之间)
    }
  ]
}
```

响应:
- `success`: 是否成功
- `isDuplicate`: 是否为重复提交
- `declarationId`: 申报ID
- `errors`: 错误详情（含字段位置和行号）
- `existingRecord`: 已存在的记录（重复提交时返回）

### 2. 查询申报记录

**GET** `/api/query`

查询参数:
- `declarationNo`: 申报编号（可选）
- `submitter`: 提交人（可选）
- `status`: 状态（pending/processed/rejected）（可选）
- `startDate`: 开始日期（可选）
- `endDate`: 结束日期（可选）

### 3. 获取统计数据

**GET** `/api/statistics`

返回统计信息:
- `totalCount`: 总申报数
- `pendingCount`: 待处理数
- `processedCount`: 已处理数
- `rejectedCount`: 已退单数
- `totalAmount`: 总金额
- `totalTax`: 总税额

### 4. 处理申报（审核通过/退单）

**PUT** `/api/process/:id`

请求体:
```json
{
  "status": "processed | rejected",
  "processor": "处理人姓名",
  "rejectionReason": "退单原因（status=rejected时必填）"
}
```

### 5. 导出数据

**GET** `/api/export`

查询参数:
- `format`: 导出格式（json/csv），默认json
- 其他查询参数同 `/api/query`

导出字段:
- 申报编号、提交人、提交时间
- 订单总金额、状态
- 品项编号、商品名称、商品品类
- 数量、单价、货币
- 品类税率、税额
- 海关退单原因、最后处理人、处理时间

### 6. 健康检查

**GET** `/health`

## 去重机制

系统通过内容哈希（contentHash）进行重复检测：
- 对申报编号、提交人、包裹列表、总金额等关键字段计算MD5哈希
- 相同内容的提交会自动识别为重复，返回原有记录
- 避免生成重复的有效记录

## 错误处理示例

缺字段或格式错误时返回：
```json
{
  "success": false,
  "errors": [
    {
      "field": "declarationNo",
      "message": "申报编号不能为空"
    },
    {
      "field": "packages[0].quantity",
      "rowIndex": 0,
      "message": "数量必须为正整数"
    }
  ]
}
```

## 运行测试

```bash
# 确保服务已启动
npm run dev

# 新开终端运行测试脚本
chmod +x test-api.sh
./test-api.sh
```
