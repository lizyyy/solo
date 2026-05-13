# 药店处方留存监管系统

一个前后端一体的药店处方监管工具，解决处方附件更新后销售锁定和监管导出的数据一致性问题。

## 功能特性

- ✅ 处方复核面板 - 药师复核管理
- ✅ 多维度搜索过滤 - 按状态、责任人、日期、关键词筛选
- ✅ 统计卡片展示 - 实时数据统计
- ✅ 修改历史追踪 - 保留处方附件、药师复核、销售锁定的修改前后值
- ✅ 流程化操作 - 复核→锁定销售→退药审核→脱敏归档→监管导出
- ✅ 导出报告筛选 - 按责任人和处理时间导出监管报告
- ✅ 数据一致性保证 - 刷新页面或重复点击结果稳定

## 本地启动

### 环境要求
- Node.js 14 或更高版本

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```

服务启动后，在浏览器中访问：
```
http://localhost:3000
```

## 主要 API

### 1. 获取处方列表
```
GET /api/prescriptions
```

**查询参数：**
- `status`: 状态筛选 (pending_review/reviewed/refund_pending/archived/rejected)
- `handler`: 责任人筛选
- `startDate`: 开始日期
- `endDate`: 结束日期
- `keyword`: 关键词搜索（处方号/患者/医生）

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "RX001",
      "patientName": "张三",
      "status": "pending_review",
      "previousValues": {}
    }
  ]
}
```

### 2. 获取单个处方详情
```
GET /api/prescriptions/:id
```

### 3. 药师复核
```
POST /api/prescriptions/:id/review
```

**请求体：**
```json
{
  "pharmacist": "李药师",
  "approved": true
}
```

### 4. 锁定销售
```
POST /api/prescriptions/:id/lock
```

### 5. 推进退药审核
```
POST /api/prescriptions/:id/refund
```

### 6. 脱敏归档
```
POST /api/prescriptions/:id/desensitize
```

### 7. 监管导出
```
POST /api/prescriptions/:id/export
```

### 8. 更新处方附件
```
PUT /api/prescriptions/:id/attachment
```

**请求体：**
```json
{
  "attachment": "prescription_001_v2.pdf"
}
```

### 9. 获取统计数据
```
GET /api/stats
```

### 10. 导出监管报告
```
GET /api/export?handler=李药师&startDate=2024-01-01&endDate=2024-01-31
```

### 11. 重置测试数据
```
POST /api/reset
```

## 测试数据

系统预置 5 条处方数据，覆盖各个流程阶段：

| 处方号 | 患者 | 状态 | 销售锁定 | 退药审核 | 脱敏归档 | 监管导出 | 附件版本 |
|--------|------|------|----------|----------|----------|----------|----------|
| RX001 | 张三 | 待复核 | ❌ | ❌ | ❌ | ❌ | v1 |
| RX002 | 李四 | 已复核 | ✅ | ❌ | ❌ | ❌ | v2 |
| RX003 | 王五 | 退药审核中 | ✅ | ✅ | ❌ | ❌ | v1 |
| RX004 | 赵六 | 已归档 | ✅ | ✅ | ✅ | ✅ | v1 |
| RX005 | 钱七 | 已复核 | ✅ | ❌ | ✅ | ❌ | v3 |

**历史修改记录示例：**
- RX002: 附件从 prescription_002.pdf → prescription_002_v2.pdf
- RX005: 附件经历 3 次版本更新，已完成脱敏归档

## 会失败的操作

### 场景：未复核就锁定销售

**操作步骤：**
1. 选择处方 RX001（状态：待复核）
2. 点击 "锁定销售" 按钮

**预期结果：**
- 操作失败，显示错误提示："只有已复核的处方才能锁定销售"
- 处方状态保持不变
- 销售锁定状态仍为 false

**API 验证：**
```bash
curl -X POST http://localhost:3000/api/prescriptions/RX001/lock
```

**响应：**
```json
{
  "success": false,
  "message": "只有已复核的处方才能锁定销售"
}
```

### 其他会失败的操作场景：

1. **未锁定销售就发起退药审核**
   - 错误信息："请先锁定销售"

2. **未完成退药审核就脱敏归档**
   - 错误信息："请先完成退药审核"

3. **未脱敏归档就监管导出**
   - 错误信息："请先完成脱敏归档"

4. **复核时不填写药师姓名**
   - 错误信息："药师信息不能为空"

5. **对已归档处方重复操作**
   - 系统提示已完成状态，不执行重复操作

## 数据一致性保证

系统通过以下机制保证数据一致性：

1. **状态机验证**：每个操作都有前置状态检查，不符合流程的操作会被拒绝
2. **历史记录追踪**：所有字段变更都会记录在 `previousValues` 中，包括：
   - 附件版本变更历史
   - 状态流转记录
   - 销售锁定时间
   - 各节点处理时间
3. **幂等性设计**：重复点击已完成的操作不会产生副作用，系统会提示当前状态
4. **可追溯审计**：导出报告包含完整的修改历史，满足监管审计要求

## 项目结构

```
.
├── package.json          # 项目配置
├── server.js             # 后端服务
├── public/
│   └── index.html        # 前端页面
└── README.md             # 说明文档
```
