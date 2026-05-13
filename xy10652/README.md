# 供应链样品评审定版管理系统

一个完整的前后端一体应用，用于管理供应链样品的评审、整改、物流追踪和版本定版流程。

## 技术栈

- **前端**: React 18 + TypeScript + Ant Design + Vite
- **后端**: Express + TypeScript
- **数据库**: SQLite (better-sqlite3)
- **其他**: uuid, exceljs, dayjs

## 功能特性

### 核心功能
- ✅ **样品批次管理**: 新建、查询、筛选样品批次
- ✅ **评审打分**: 外观、品质、功能、包装四项评分，自动计算总分
- ✅ **整改意见**: 记录整改项、指定责任人、设置截止日期，支持状态推进
- ✅ **复寄物流**: 追踪样品寄送物流信息（快递公司、运单号、状态）
- ✅ **版本定版**: 确认最终版本，锁定已完成批次
- ✅ **修改记录**: 完整记录所有字段的修改历史，保留修改前后值
- ✅ **报告导出**: 按责任人、时间范围筛选导出Excel评审报告

### 统计功能
- 样品批次总数
- 待评审数量
- 评审中数量
- 已定版数量
- 平均评分

## 本地启动

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务
#### 方式一：同时启动前后端（推荐）
```bash
npm run dev
```

#### 方式二：分别启动
```bash
# 启动后端服务（端口 3001）
npm run dev:server

# 启动前端服务（端口 3000，需要新开终端）
npm run dev:client
```

### 3. 访问应用
打开浏览器访问: http://localhost:3000

## 主要 API 接口

### 供应商管理
- `GET /api/suppliers` - 获取所有供应商
- `POST /api/suppliers` - 创建供应商
- `PUT /api/suppliers/:id` - 更新供应商

### 样品批次管理
- `GET /api/batches` - 获取批次列表（支持筛选）
- `GET /api/batches/:id` - 获取单个批次详情
- `GET /api/batches/validate/:batchNo` - 校验批次
- `POST /api/batches` - 创建批次
- `PUT /api/batches/:id` - 更新批次

### 评审打分
- `GET /api/batches/:batchId/reviews` - 获取批次评审记录
- `POST /api/reviews` - 创建评审
- `PUT /api/reviews/:id` - 更新评审

### 整改意见
- `GET /api/batches/:batchId/rectifications` - 获取整改意见
- `POST /api/rectifications` - 创建整改意见
- `PUT /api/rectifications/:id/advance` - 推进整改状态

### 复寄物流
- `GET /api/batches/:batchId/logistics` - 获取物流信息
- `POST /api/logistics` - 创建物流记录

### 版本定版
- `GET /api/batches/:batchId/finalization` - 获取定版信息
- `POST /api/finalizations` - 创建版本定版

### 统计与导出
- `GET /api/statistics/overview` - 获取统计概览
- `GET /api/export/report` - 导出Excel报告（支持参数：responsible_person, start_date, end_date）

### 修改记录
- `GET /api/change-logs/:tableName/:recordId` - 获取记录修改历史

## 测试数据

系统启动时会自动初始化以下测试数据：

### 供应商（3个）
1. **深圳电子科技有限公司** - 联系人：张三
2. **东莞五金制品厂** - 联系人：李四  
3. **广州塑胶材料公司** - 联系人：王五

### 样品批次（4个）
1. **BATCH202401001** - 智能手机壳（深圳电子）- 评审中，版本 1.2
2. **BATCH202401002** - 金属支架（东莞五金）- 已定版，版本 2.0
3. **BATCH202401003** - 塑胶外壳（广州塑胶）- 待评审，版本 1.0
4. **BATCH202401004** - 充电器（深圳电子）- 评审中，版本 1.1

### 评审记录
- BATCH202401001: 2次评审（70分→77分）
- BATCH202401002: 80分（完美）
- BATCH202401004: 2次评审（72分→75分）

## 会失败的操作示例

### 1. 查询不存在的批次
```bash
# 尝试获取不存在的批次ID
curl http://localhost:3001/api/batches/non-existent-id
# 返回：{"error":"Batch not found"}
```

### 2. 校验不存在的批次号
```bash
curl http://localhost:3001/api/batches/validate/NON_EXISTENT_BATCH
# 返回：{"valid":false,"message":"批次不存在","batch":null}
```

### 3. 更新不存在的记录
```bash
curl -X PUT http://localhost:3001/api/suppliers/non-existent-id \
  -H "Content-Type: application/json" \
  -d '{"name":"测试修改"}'
# 服务器内部错误：尝试访问不存在的记录
```

### 4. 创建重复批次号
```bash
# 尝试创建已存在的批次号
curl -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{"batch_no":"BATCH202401001","supplier_id":"xxx","product_name":"测试产品"}'
# 数据库唯一约束错误（SQLITE_CONSTRAINT_UNIQUE）
```

### 5. 导出报告时日期格式错误
```javascript
// 在前端调用时传入错误的日期格式
exportApi.downloadReport({
  start_date: 'invalid-date',  // 错误格式
  end_date: '2024-13-32'       // 无效日期
});
// 服务器将无法正确解析日期，导致查询结果为空
```

## 数据幂等性保证

系统在关键操作中实现了幂等性：

1. **复寄物流**: 相同批次 + 相同运单号重复提交不会创建重复记录
2. **版本定版**: 相同批次 + 相同版本号重复提交不会创建重复定版记录
3. **修改记录**: 相同字段的相同值更新不会重复记录

## 项目结构

```
.
├── client/                    # 前端代码
│   ├── components/           # 组件
│   │   ├── StatisticsCards.tsx  # 统计卡片
│   │   ├── SearchFilter.tsx     # 搜索筛选
│   │   └── ReviewPanel.tsx      # 复核面板
│   ├── api.ts                 # API接口
│   ├── types.ts               # TypeScript类型
│   ├── App.tsx                # 主应用
│   └── main.tsx               # 入口文件
├── server/                    # 后端代码
│   ├── database.ts            # 数据库初始化
│   ├── seed.ts                # 测试数据
│   ├── services.ts            # 业务逻辑服务
│   ├── routes.ts              # 路由
│   └── index.ts               # 服务器入口
├── data/                      # SQLite数据库文件目录（自动创建）
├── index.html                 # HTML模板
├── vite.config.ts             # Vite配置
├── tsconfig.json              # TypeScript配置（前端）
├── tsconfig.server.json       # TypeScript配置（后端）
└── package.json               # 项目配置
```

## 数据库表结构

- **suppliers**: 供应商表
- **sample_batches**: 样品批次表
- **review_scores**: 评审打分表
- **rectification_opinions**: 整改意见表
- **reship_logistics**: 复寄物流表
- **version_finalizations**: 版本定版表
- **change_logs**: 修改记录表（记录所有变更的前后值）
