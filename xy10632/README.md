# 售后换新备机回收管理系统

这是一个前后端一体的售后换新备机回收管理工具，旨在解决保修校验记录更新后，备机借用和售后成本口径不一致的问题。

## 功能特性

- **统计卡片**: 实时展示保修校验总数、检测报告总数、备机借用中、待审批换新、待回收旧机、售后总成本、保修通过率
- **搜索过滤**: 支持按工单号、处理人、时间范围进行数据筛选
- **复核面板**: 按工单号查询完整售后流程记录，确保数据一致性
- **修改历史**: 保留保修校验、检测报告、备机借用的修改前后值
- **导出报告**: 支持按责任人和处理时间筛选导出Excel报表
- **核心API**:
  - 校验检测报告
  - 推进换新审批
  - 保存旧机回收

## 本地启动

### 环境要求
- Node.js >= 14.0.0

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```

### 访问应用
打开浏览器访问: http://localhost:3000

## 主要API接口

### 1. 获取概览统计
```
GET /api/overview
```

### 2. 保修校验列表
```
GET /api/warranty-checks?orderNo=&handler=&status=
```

### 3. 检测报告列表
```
GET /api/inspection-reports?orderNo=&inspector=&status=
```

### 4. 校验检测报告 (核心API)
```
POST /api/inspection-reports/:id/verify
Content-Type: application/json

{
  "status": "已通过" | "已拒绝",
  "comments": "审核意见（可选）"
}
```

### 5. 备机借用列表
```
GET /api/loaner-devices?orderNo=&handler=&status=
```

### 6. 换新审批列表
```
GET /api/replacement-approvals?orderNo=&applicant=&status=
```

### 7. 推进换新审批 (核心API)
```
POST /api/replacement-approvals/:id/advance
Content-Type: application/json

{
  "status": "已通过" | "已拒绝",
  "comments": "审批意见（可选）"
}
```

### 8. 旧机回收列表
```
GET /api/old-device-recoveries?orderNo=&handler=&status=
```

### 9. 保存旧机回收 (核心API)
```
POST /api/old-device-recoveries/:id/save
Content-Type: application/json

{
  "recoveryStatus": "待回收" | "回收中" | "已回收" | "无法回收",
  "recoveryMethod": "上门取件" | "客户寄送" | "门店自送",
  "trackingNo": "快递单号",
  "receiver": "收货人",
  "warehouseLocation": "仓库位置",
  "remarks": "备注"
}
```

### 10. 售后成本列表
```
GET /api/after-sales-costs?orderNo=&handler=&costType=
```

### 11. 获取工单完整记录 (复核用)
```
GET /api/order-detail/:orderNo
```

### 12. 获取修改历史
```
GET /api/modification-history/:type/:recordId
```
- type: warrantyCheck | inspectionReport | loanerDevice

### 13. 导出Excel报告
```
GET /api/export-report?type=all&handler=&startTime=&endTime=
```
- type: all | warranty | inspection | loaner

### 14. 获取处理人列表
```
GET /api/handlers
```

## 样例测试数据

系统启动时自动生成10组完整的测试工单数据，覆盖：

- **工单号范围**: AS2024001 至 AS2024010
- **处理人**: 张三、李四、王五、赵六
- **设备型号**: iPhone 14、iPhone 15、Huawei Mate 60、Xiaomi 14
- **各模块数据**:
  - 保修校验记录
  - 检测报告
  - 备机借用
  - 换新审批
  - 旧机回收
  - 售后成本

### 测试数据示例
1. **AS2024001**: 保修已通过，检测待审核，备机借用中
2. **AS2024002**: 保修异常，检测已通过，备机已归还
3. **AS2024003**: 保修需进一步核实，检测已拒绝，备机逾期未还

## 会失败的操作

以下操作由于业务规则限制会执行失败：

### 1. 重复审核检测报告
检测报告一旦审核通过或拒绝后，不可再次审核
- 场景: 对 status = "已通过" 的报告调用 /api/inspection-reports/:id/verify
- 结果: {"success": false, "message": "该报告已审核，不可重复操作"}

### 2. 检测报告未通过时推进换新审批
换新审批依赖关联的检测报告必须已通过
- 场景: 检测报告 status = "待审核" 或 "已拒绝" 时调用 /api/replacement-approvals/:id/advance
- 结果: {"success": false, "message": "关联的检测报告未通过审核，无法推进审批"}

### 3. 重复审批换新申请
换新申请一旦审批通过或拒绝后，不可再次审批
- 场景: 对 approvalStatus = "已通过" 的申请调用 /api/replacement-approvals/:id/advance
- 结果: {"success": false, "message": "该审批已完成，不可重复操作"}

### 4. 更新不存在的记录
对不存在的ID进行更新操作
- 场景: 使用错误的ID调用保存接口
- 结果: {"success": false, "message": "旧机回收记录不存在"}

### 5. 无效的状态值
使用未在枚举范围内的状态值进行提交
- 场景: status = "审核中" (不在 ["已通过", "已拒绝"] 范围内)
- 结果: {"success": false, "message": "状态只能是\"已通过\"或\"已拒绝\""}

## 数据一致性保障

- 所有修改操作均记录修改前后值
- 修改历史包含: 修改时间、操作人、修改前数据、修改后数据
- 换新审批强依赖检测报告状态，确保流程合规
- 复核面板可查看工单完整链路，确保各模块数据口径一致

## 项目结构

```
.
├── server/
│   ├── index.js          # 后端服务入口
│   └── data.js           # 数据模型与内存存储
├── public/
│   └── index.html        # 前端页面
├── package.json
└── README.md
```
