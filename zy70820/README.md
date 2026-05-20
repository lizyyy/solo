# 社区卫生服务站疫苗预约后端服务

可追踪、可解释的疫苗预约记录管理系统。

## 功能特性

### 数据导入
- 支持CSV格式预约记录导入
- 支持JSON格式疫苗库存导入
- 支持JSON格式接种禁忌规则导入

### 批次管理
- 创建预约批次
- 批次统计信息
- 批量处理预约记录

### 记录处理
- 单条记录处理
- 批量处理
- 标记完成接种
- 退回修改功能

### 业务规则验证
- 接种间隔检查
- 年龄限制检查
- 疫苗库存检查
- 禁忌规则拦截
- 重复预约检测

### 候补管理
- 自动候补队列
- 候补顺序追踪
- 候补来源记录

### 查询与导出
- 多条件查询记录
- 按儿童身份证查询历史
- 按候补顺序查询
- 导出CSV明细
- 导出追踪日志（含解释说明）

### 数据持久化
- 服务重启数据不丢失
- JSON文件存储
- 完整操作日志记录

## 项目结构

```
.
├── src/
│   ├── types/           # 类型定义
│   │   └── index.ts
│   ├── store/           # 数据存储
│   │   └── DataStore.ts
│   ├── services/        # 业务服务
│   │   ├── ImportService.ts
│   │   ├── BusinessService.ts
│   │   └── QueryService.ts
│   └── server.ts        # 服务入口
├── examples/            # 示例数据
│   ├── sample_appointments.csv
│   ├── sample_inventory.json
│   └── sample_contraindications.json
├── data/                # 数据存储目录（自动创建）
├── package.json
├── tsconfig.json
├── test_api.sh          # API测试脚本
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译项目

```bash
npm run build
```

### 3. 启动服务

```bash
npm start
```

开发模式（自动重启）：
```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 4. 运行测试脚本

先确保服务已启动，然后运行：

```bash
chmod +x test_api.sh
./test_api.sh
```

## API接口文档

### 健康检查

```
GET /health
```

### 批次管理

#### 创建批次
```
POST /api/batches
Body: {
  "batchNo": "批次编号",
  "name": "批次名称",
  "vaccineCode": "疫苗编码",
  "vaccineName": "疫苗名称",
  "createdBy": "创建人"
}
```

#### 查询所有批次
```
GET /api/batches
```

#### 查询批次详情（含统计）
```
GET /api/batches/:id
```

#### 批量处理批次内所有待处理记录
```
POST /api/batches/:id/process-all
Body: { "operator": "处理人" }
```

#### 查询批次候补列表
```
GET /api/batches/:id/waitlist
```

#### 查询批次候补追踪信息
```
GET /api/batches/:id/waitlist/traceability
```

### 数据导入

#### 导入预约CSV
```
POST /api/import/appointments
Body: { "csvContent": "CSV字符串内容", "batchId": "批次ID" }
```

#### 导入疫苗库存
```
POST /api/import/inventory
Body: { "jsonContent": "JSON字符串内容" }
```

#### 导入禁忌规则
```
POST /api/import/contraindications
Body: { "jsonContent": "JSON字符串内容" }
```

### 记录处理

#### 处理单条记录
```
POST /api/records/:id/process
Body: { "operator": "处理人" }
```

#### 退回修改
```
POST /api/records/:id/return
Body: { "operator": "处理人", "reason": "退回原因" }
```

#### 标记完成接种
```
POST /api/records/:id/mark-processed
Body: { "operator": "处理人" }
```

### 查询与导出

#### 查询预约记录
```
GET /api/records
查询参数:
  - childIdCard: 儿童身份证号
  - childName: 儿童姓名
  - vaccineCode: 疫苗编码
  - batchId: 批次ID
  - status: 状态 (pending/approved/processed/rejected/returned/waitlisted)
  - startDate: 开始日期
  - endDate: 结束日期
  - waitlistOrder: 候补顺序
```

#### 查询单条记录详情（含追踪信息）
```
GET /api/records/:id
```

#### 导出预约记录CSV
```
GET /api/export/records
查询参数同查询接口
```

#### 导出单条记录追踪CSV
```
GET /api/export/records/:id/traceability
```

#### 按儿童查询历史记录
```
GET /api/children/:idCard/history
```

### 基础数据查询

#### 查询疫苗库存
```
GET /api/inventory
```

#### 查询禁忌规则
```
GET /api/contraindications
```

## 记录状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| approved | 审核通过 |
| processed | 已完成接种 |
| rejected | 已拒绝 |
| returned | 已退回修改 |
| waitlisted | 候补 |

## 追踪日志说明

每条记录的每一步操作都会被记录，包含：
- 操作时间
- 操作人
- 操作类型
- 状态变更
- 原因说明（可解释）
- 自动生成的解释文字

## 候补追踪重点

候补列表可追踪到：
1. 候补顺序号
2. 候补来源（如：疫苗库存不足）
3. 候补时间
4. 完整的操作历史
5. 可解释的原因说明

## 数据文件位置

所有数据保存在 `./data/data.json` 文件中，服务重启后自动加载。

## 注意事项

1. 导入CSV时请确保字段正确，参考示例文件
2. 处理记录前请确保疫苗库存已导入
3. 候补顺序按记录处理时间自动分配
4. 所有操作都会记录操作人，请在API调用时传入operator参数
