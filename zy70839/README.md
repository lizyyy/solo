# 汽车试驾车钥匙借还管理API服务

## 功能特性

1. **材料提交与重复识别**：同一批材料重复提交时，系统会识别并返回原有处理结果
2. **任务状态管理**：支持处理中、处理失败、人工确认、已导出四种状态，状态持久化存储
3. **审计日志**：记录谁改过结论、为什么改、改动前是什么
4. **导出功能**：支持CSV格式导出，包含钥匙、油卡、违章记录等信息
5. **统计查询**：与导出结果保持一致的统计信息

## 技术栈

- Node.js + Express
- SQLite (持久化存储)
- 支持CSV导出

## 安装与运行

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 开发模式
npm run dev
```

服务默认运行在 `http://localhost:3000`

## API接口

### 1. 提交材料
```
POST /api/tasks/submit
Content-Type: application/json

{
  "submitter": "销售主管姓名",
  "materials": [
    {
      "key_number": "钥匙编号",
      "key_status": "钥匙状态(borrowed/returned)",
      "fuel_card_number": "油卡编号",
      "fuel_card_balance": 500,
      "violation_records": "违章记录",
      "manual_registration": "手工登记信息"
    }
  ]
}
```

### 2. 更新任务状态
```
PATCH /api/tasks/:taskId/status
Content-Type: application/json

{
  "newStatus": "manual_confirm",
  "operator": "操作人姓名",
  "changeReason": "修改原因"
}
```

### 3. 获取任务详情
```
GET /api/tasks/:taskId
```

### 4. 获取任务列表
```
GET /api/tasks
GET /api/tasks?status=processing
```

### 5. 获取统计信息
```
GET /api/tasks/statistics
```

### 6. 获取审计日志
```
GET /api/tasks/:taskId/audit-logs
```

### 7. 导出任务
```
POST /api/tasks/:taskId/export
Content-Type: application/json

{
  "exportedBy": "导出人姓名",
  "format": "csv"
}
```

### 8. 获取导出历史
```
GET /api/tasks/:taskId/export-history
```

## 任务状态说明

- `processing` - 处理中
- `failed` - 处理失败
- `manual_confirm` - 人工确认
- `exported` - 已导出

## 项目结构

```
.
├── src/
│   ├── server.js          # 服务入口
│   ├── database.js        # 数据库配置
│   ├── utils.js           # 工具函数
│   ├── controllers/
│   │   └── taskController.js  # 控制器
│   ├── services/
│   │   ├── taskService.js     # 任务服务
│   │   └── exportService.js   # 导出服务
│   ├── daos/
│   │   └── index.js           # 数据访问层
│   └── routes/
│       └── tasks.js           # 路由定义
├── data/
│   └── database.db        # SQLite数据库文件
├── package.json
└── test-example.js        # 测试示例
```

## 导出数据包含字段

- 任务ID
- 提交人
- 任务状态
- 创建时间
- 最后处理人
- 试驾车钥匙编号
- 试驾车钥匙状态
- 油卡编号
- 油卡余额
- 违章记录手工登记
- 备注
- 导出人
- 导出时间