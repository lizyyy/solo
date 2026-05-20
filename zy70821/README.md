# 社区卫生服务站 - 疫苗预约管理API

## 项目概述

本项目为社区卫生服务站提供儿童疫苗预约的批量处理能力，解决人工电话处理效率低、易出错的问题。

### 核心功能

- ✅ **批量导入预约**: 支持CSV格式预约文件上传
- ✅ **疫苗库存管理**: 支持JSON格式库存数据导入和查询
- ✅ **禁忌规则引擎**: 自动拦截高风险禁忌情况
- ✅ **缺苗候补处理**: 库存为0时自动加入候补队列
- ✅ **重复改签检测**: 防止同一预约多次改签
- ✅ **批次防重机制**: 同一批文件重复提交不重复生效
- ✅ **智能分类结果**: 自动分为正常/待确认/候补/失败四类

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

开发模式（自动重启）:
```bash
npm run dev
```

服务启动后访问: http://localhost:3000

### 3. 运行测试

查看测试说明和curl命令:
```bash
node test/run-test.js
```

---

## API 接口文档

### 健康检查
```
GET /health
```

### 1. 上传并处理预约文件
```
POST /api/appointments/upload
Content-Type: multipart/form-data
```

**请求参数**:
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| appointments | File | 是 | 预约CSV文件，支持多个 |
| inventory | File | 否 | 疫苗库存JSON文件 |
| rules | File | 否 | 禁忌规则JSON文件 |

**响应示例**:
```json
{
  "batchId": "abc123def456...",
  "isDuplicateBatch": false,
  "message": "处理完成",
  "result": {
    "summary": {
      "total": 10,
      "success": 4,
      "waitlist": 2,
      "needsConfirmation": 1,
      "failed": 3
    },
    "success": [...],
    "waitlist": [...],
    "needsConfirmation": [...],
    "failed": [...],
    "parseErrors": [...]
  }
}
```

**失败记录字段说明**:
- `originalData`: 保留原始CSV行数据
- `processingResult.issues`: 具体问题说明
- `processingResult.suggestions`: 建议处理方式

### 2. 获取批次处理结果
```
GET /api/appointments/batch/:batchId
```

### 3. 查询疫苗库存
```
GET /api/appointments/inventory
```

### 4. 更新疫苗库存
```
PUT /api/appointments/inventory
Content-Type: application/json
```

### 5. 查询禁忌规则
```
GET /api/appointments/rules
```

### 6. 更新禁忌规则
```
PUT /api/appointments/rules
Content-Type: application/json
```

---

## 数据格式说明

### 预约CSV格式
必填列: `childId`, `childName`, `vaccineCode`, `vaccineName`, `appointmentDate`

可选列: `birthDate`, `phone`, `contraindications`, `isReschedule`, `originalAppointmentDate`, `guardianName`, `address`, `remarks`

### 疫苗库存JSON格式
```json
{
  "vaccines": [
    {
      "code": "MMR",
      "name": "麻腮风疫苗",
      "quantity": 50,
      "expiryDate": "2025-12-31",
      "expectedRestock": "2024-07-15",
      "waitingListCount": 3
    }
  ]
}
```

### 禁忌规则JSON格式
```json
{
  "rules": [
    {
      "id": "R001",
      "name": "免疫缺陷",
      "keywords": ["免疫缺陷", "免疫低下"],
      "severity": "high",
      "description": "免疫缺陷儿童接种活疫苗可能导致严重感染",
      "suggestion": "建议暂缓接种，转儿科免疫专科评估"
    }
  ]
}
```

---

## 业务规则说明

### 1. 缺苗候补规则
- 当疫苗 `quantity <= 0` 时触发
- 自动加入候补队列，返回预计到货时间
- 显示当前候补人数
- 建议: "已自动加入候补名单，到货后将按预约顺序通知"

### 2. 禁忌拦截规则
- **高风险 (high)**: 直接拦截，标记为失败
  - 免疫缺陷、严重过敏史、神经系统疾病
- **中风险 (medium)**: 标记为待确认，需要人工核实
  - 急性发热、鸡蛋过敏、一般慢性病
- 每条规则都包含具体的处理建议

### 3. 重复改签检测
- 检测条件: 相同儿童 + 相同疫苗 + 相同原预约日期
- 首次改签允许，重复改签拦截
- 建议: "请勿重复改签，如需再次调整请先取消上次改签记录"

### 4. 批次去重机制
- 根据文件名 + 文件大小生成唯一 batchId
- 重复提交同一批文件时，返回历史处理结果
- 不重复执行业务逻辑，不重复存储

---

## 项目结构

```
vaccine-appointment-api/
├── src/
│   ├── app.js                      # 应用入口
│   ├── controllers/
│   │   └── appointmentController.js # 业务控制器
│   ├── middleware/
│   │   └── upload.js               # 文件上传中间件
│   ├── models/
│   │   └── store.js                # 数据存储和批次管理
│   ├── routes/
│   │   └── appointments.js         # 路由定义
│   └── utils/
│       ├── parser.js               # CSV/JSON解析
│       └── rulesEngine.js          # 业务规则引擎
├── data/
│   ├── appointments.csv            # 示例预约数据
│   ├── inventory.json              # 示例库存数据
│   └── rules.json                  # 示例禁忌规则
├── test/
│   └── run-test.js                 # 测试说明脚本
├── uploads/                        # 临时上传目录
├── package.json
└── README.md
```

---

## 本地测试完整流程

### 步骤1: 启动服务
```bash
npm start
```

### 步骤2: 上传所有测试数据（首次）
```bash
curl -X POST http://localhost:3000/api/appointments/upload \
  -F "appointments=@data/appointments.csv" \
  -F "inventory=@data/inventory.json" \
  -F "rules=@data/rules.json"
```

**预期结果**: 处理10条记录，分类为4成功/2候补/1待确认/3失败

### 步骤3: 重复提交相同文件（测试批次去重）
```bash
# 再次执行步骤2的curl命令
```

**预期结果**: 返回 `isDuplicateBatch: true`，显示历史处理结果

### 步骤4: 查看各分类详情
```bash
# 查看库存
curl http://localhost:3000/api/appointments/inventory

# 查看禁忌规则
curl http://localhost:3000/api/appointments/rules
```

---

## 边界情况说明

### 缺苗候补 (waitlist)
> **场景说明**: 百白破疫苗(DPT)当前库存为0，但李四只有鸡蛋过敏(中风险)
> 
> **处理逻辑**: 虽然有禁忌，但属于可确认级别，加上缺苗 → 进入候补队列
>
> **返回信息**: 
> - 显示预计到货日期
> - 显示当前候补人数
> - 明确说明: "已自动加入候补名单，到货后将按预约顺序通知"

### 待确认 (needs_confirmation)
> **场景说明**: 钱七有发热症状
>
> **处理逻辑**: 发热属于中风险，不直接拒绝，但需要人工确认
>
> **返回建议**: "请医护人员电话确认儿童健康状况后再决定是否接受预约"

### 重复改签拦截
> **场景说明**: 吴十试图对同一疫苗同一日期重复改签
>
> **处理逻辑**: 系统检测到已有改签记录，直接拦截
>
> **失败原因**: "该儿童已对该疫苗该预约日期进行过改签"

---

## 技术栈

- **运行时**: Node.js 16+
- **Web框架**: Express.js
- **文件上传**: Multer
- **CSV解析**: csv-parser
- **数据校验**: Joi
- **加密**: Node.js 内置 crypto 模块

---

## 注意事项

1. **数据持久化**: 当前版本使用内存存储，重启后数据丢失
2. **生产部署**: 建议接入真实数据库（MySQL/MongoDB）
3. **文件清理**: 上传的文件处理后会自动删除
4. **编码要求**: CSV文件请使用UTF-8编码
5. **日期格式**: 统一使用 YYYY-MM-DD 格式

---

## 许可证

MIT
