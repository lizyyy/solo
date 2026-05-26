# 汽修连锁对账服务 API 文档

## 基础地址
`http://localhost:3000/api`

## 认证

所有需要认证的接口需要在请求头中携带：
```
Authorization: Bearer <token>
```

---

## 1. 认证接口

### 登录
**POST** `/auth/login`

请求体：
```json
{
  "username": "admin",
  "password": "admin123"
}
```

响应：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "u001",
    "username": "admin",
    "realName": "系统管理员",
    "role": "admin",
    "storeId": null
  }
}
```

默认账号：
- `admin` / `admin123` - 系统管理员
- `manager_hq` / `store123` - 总部旗舰店店长
- `manager_hd` / `store123` - 海淀分店店长

---

## 2. 对账批次接口

### 获取批次列表
**GET** `/batches?storeId=&status=&limit=20&offset=0`

查询参数：
- `storeId` (可选) - 门店ID
- `status` (可选) - 批次状态
- `limit` (可选, 默认20) - 每页数量
- `offset` (可选, 默认0) - 偏移量

### 获取批次详情
**GET** `/batches/:id`

返回批次完整信息，包括对账记录、差异明细、操作日志。

### 创建批次
**POST** `/batches`

请求体：
```json
{
  "name": "2024年4月对账",
  "storeId": "s001",
  "periodStart": "2024-04-01",
  "periodEnd": "2024-04-30"
}
```

### 执行对账
**POST** `/batches/:id/run`

触发自动对账流程，比对套餐、工单、库存数据。

### 完成批次
**POST** `/batches/:id/complete`

所有差异处理完成后，标记批次为已完成。

---

## 3. 数据导入接口

### 导入套餐 CSV
**POST** `/import/packages`

请求 (multipart/form-data):
- `file`: 套餐CSV文件
- `batchId`: 批次ID
- `storeId`: 门店ID (admin可选)

### 导入工单 JSON
**POST** `/import/workorders`

请求 (multipart/form-data):
- `file`: 工单JSON文件
- `batchId`: 批次ID
- `storeId`: 门店ID

### 导入库存 CSV
**POST** `/import/inventory`

请求 (multipart/form-data):
- `file`: 库存CSV文件
- `batchId`: 批次ID
- `storeId`: 门店ID

---

## 4. 复核接口

### 复核对账记录
**POST** `/batches/records/:recordId/review`

请求体：
```json
{
  "reviewResult": "approved",
  "reviewComment": "跨店核销属于正常业务，已核实客户签字"
}
```

`reviewResult` 可选值：
- `approved` - 通过（放行）
- `rejected` - 退回
- `need_more_info` - 需补充材料

### 标记差异已解决
**POST** `/batches/discrepancies/:discrepancyId/resolve`

请求体：
```json
{
  "resolutionComment": "已联系客户补签项目替换确认单"
}
```

---

## 5. 报告导出接口

### 导出 Excel 报告
**GET** `/reports/:id/excel`

返回 Excel 文件下载，包含：
- 汇总信息
- 差异明细
- 对账记录
- 操作日志

### 导出 PDF 报告
**GET** `/reports/:id/pdf`

返回 PDF 文件下载。

### 获取 JSON 格式报告数据
**GET** `/reports/:id/json`

---

## 差异类型说明

| 类型代码 | 说明 | 严重程度 |
|---------|------|---------|
| `cross_store_redemption` | 跨店核销 | 中 |
| `item_replacement` | 项目替换 | 中 |
| `inventory_shortage` | 库存盘亏 | 高 |
| `inventory_surplus` | 库存盘盈 | 高 |
| `package_usage_mismatch` | 套餐项目不匹配 | 高 |
| `quantity_mismatch` | 使用数量不符 | 高 |
| `price_mismatch` | 价格差异 | 中 |
| `missing_package` | 套餐不存在 | 高 |
| `missing_work_order` | 缺少工单 | 中 |
| `amount_mismatch` | 金额不符 | 高 |

---

## 状态流转

```
草稿(draft) → 导入数据 → 执行对账 → 对账完成(reconciled)
     ↓                ↓
  已取消         人工复核
                      ↓
                全部差异解决
                      ↓
                已完成(completed)
```
