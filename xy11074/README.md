# 企业礼品仓礼品定制打样 API

## 功能特点

- ✅ **单条人工处理入口**：支持单条创建、更新打样记录
- ✅ **批量补录入口**：支持批量导入打样记录
- ✅ **旧稿新单检测**：自动检测客户确认旧稿后按新稿重新下单的情况
- ✅ **打样轨迹一致性检查**：检查打样轨迹是否完整
- ✅ **下一步处理建议**：智能提示需要补充的材料和操作
- ✅ **CSV导出功能**：保留关键业务列，便于台账核对
- ✅ **本地无依赖启动**：不依赖外部数据库，内存存储
- ✅ **配置检查提示**：缺配置时给出清晰提示
- ✅ **真实业务字段**：样例数据包含企业礼品打样的真实业务字段

## 快速启动

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

服务默认运行在: `http://localhost:3000`

## 接口说明

### 1. 单条创建打样记录
```
POST /api/samples
Content-Type: application/json

{
  "operator": "张三",
  "companyId": "COMP004",
  "companyName": "测试企业",
  "contactPerson": "李经理",
  "contactPhone": "13800138000",
  "giftCategory": "数码配件",
  "giftName": "无线充电器",
  "giftModel": "WC-2024-001",
  "material": "PC+ABS",
  "specification": "15W快充",
  "color": "白色",
  "quantity": 50,
  "unitPrice": 35.5,
  "customizationType": "LOGO印刷",
  "printingMethod": "丝印",
  "logoPosition": "正面居中",
  "materialsNeeded": [
    { "materialCode": "MAT001", "materialName": "PC料", "quantity": 10, "unit": "kg" }
  ]
}
```

### 2. 更新打样记录
```
PUT /api/samples/:sampleId
Content-Type: application/json

{
  "operator": "张三",
  "sampleStatus": "打样中",
  "sampler": "王打样"
}
```

### 3. 查询单条打样记录
```
GET /api/samples/:sampleId
```

### 4. 查询打样记录列表
```
GET /api/samples?companyId=COMP001&sampleStatus=打样中
```

### 5. 批量补录打样记录
```
POST /api/samples/batch/import
Content-Type: application/json

{
  "operator": "李四",
  "samples": [
    {
      "companyId": "COMP005",
      "companyName": "批量企业1",
      "giftName": "礼品1"
    },
    {
      "companyId": "COMP006",
      "companyName": "批量企业2",
      "giftName": "礼品2"
    }
  ]
}
```

### 6. 检查旧稿新单情况
```
GET /api/samples/:sampleId/check-old-design
```

### 7. 检查打样轨迹一致性
```
GET /api/samples/:sampleId/check-tracker
```

### 8. 获取下一步处理建议
```
GET /api/samples/:sampleId/next-steps
```

### 9. 导出打样记录CSV
```
GET /api/samples/export/download
```

## 业务字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| sampleId | 打样编号 | SMP1705000000000 |
| companyId | 企业编号 | COMP001 |
| companyName | 企业名称 | 阿里巴巴集团 |
| giftCategory | 礼品类别 | 数码配件 |
| giftName | 礼品名称 | 无线充电器 |
| giftModel | 礼品型号 | WC-2024-001 |
| material | 材质 | PC+ABS |
| specification | 规格 | 15W快充 |
| customizationType | 定制类型 | LOGO印刷 |
| printingMethod | 印刷方式 | 丝印 |
| logoPosition | LOGO位置 | 正面居中 |
| designVersion | 设计版本 | V1, V2 |
| designConfirmed | 设计是否确认 | true/false |
| sampleStatus | 打样状态 | 待打样/打样中/质检完成 |
| oldDesignOrderId | 旧设计稿订单号 | SMPxxxx |
| materialsNeeded | 需要的材料列表 | 数组 |
| materialsProvided | 已提供的材料列表 | 数组 |
| sampleTracker | 打样轨迹记录 | 数组 |
| isBatchImport | 是否批量导入 | true/false |
| batchId | 批次号 | BATCHxxxx |

## 打样状态说明

- **待打样**：刚创建，等待开始打样
- **待客户确认**：等待客户确认设计稿
- **打样中**：正在进行打样生产
- **质检完成**：打样完成，质检通过
- **已完成**：客户已签收并反馈

## 项目结构

```
├── src/
│   ├── app.js                 # 主应用入口
│   ├── models/
│   │   └── GiftSample.js      # 打样数据模型
│   ├── data/
│   │   └── store.js           # 数据存储层
│   ├── controllers/
│   │   └── sampleController.js # 业务控制器
│   └── routes/
│       └── samples.js         # 路由定义
├── exports/                    # 导出文件目录
├── package.json
└── README.md
```

## 健康检查

```
GET /api/health
```