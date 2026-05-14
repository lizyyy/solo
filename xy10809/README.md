# REST 到 CSV 同步桥

一个连接运营 CSV 数据与研发 REST API 的全栈数据同步平台。

## 功能特性

### 后端能力
- **字段映射**：CSV 字段到 API 请求体的灵活映射
- **脏数据拦截**：正则验证、枚举验证、必填验证
- **分批提交**：支持批量处理 API 请求
- **失败回写**：详细记录每条记录的失败原因
- **同步报告**：完整导出同步结果和错误信息
- **状态追踪**：完整的批次和行级状态管理

### 前端控制台
- **总览面板**：实时统计同步批次、成功/失败数量
- **详情页面**：查看每条记录的原始数据、转换结果、API 响应
- **失败分析**：筛选查看验证失败和 API 调用失败的记录
- **手动补偿**：支持重试全部或指定失败记录
- **报告导出**：导出完整的同步结果 CSV 报告

## 技术栈

### 后端
- Node.js + TypeScript
- Express (Web 框架)
- Multer (文件上传)
- csv-parser / json2csv (CSV 处理)
- Axios (HTTP 客户端)

### 前端
- React 18 + TypeScript
- React Router (路由)
- Tailwind CSS (样式)
- Lucide React (图标)
- Vite (构建工具)

## 项目结构

```
rest-csv-sync-bridge/
├── server/                    # 后端服务
│   ├── src/
│   │   ├── types.ts          # 类型定义
│   │   ├── store/            # 数据存储层
│   │   ├── services/         # 业务逻辑
│   │   ├── routes/           # API 路由
│   │   └── index.ts          # 入口文件
│   └── package.json
├── client/                    # 前端应用
│   ├── src/
│   │   ├── types.ts          # 类型定义
│   │   ├── api.ts            # API 客户端
│   │   ├── pages/            # 页面组件
│   │   └── main.tsx          # 入口文件
│   └── package.json
├── samples/                   # 样例 CSV 数据
│   ├── normal_data.csv       # 正常数据
│   └── with_errors.csv       # 含错误数据
└── package.json
```

## 快速开始

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 安装前端依赖
cd client && npm install && cd ..
```

### 启动服务

#### 方式一：同时启动前后端（推荐）
```bash
npm run dev
```

#### 方式二：分别启动
```bash
# 启动后端服务 (端口 3001)
cd server && npm run dev

# 启动前端服务 (端口 3000)
cd client && npm run dev
```

### 访问应用

打开浏览器访问：http://localhost:3000

## 使用流程

### 1. 上传 CSV 文件
- 在控制台选择 API 映射配置
- 选择 CSV 文件上传（samples 目录下提供样例）
- 系统创建同步批次

### 2. 验证数据
- 点击"验证"按钮
- 系统检查所有字段格式和业务规则
- 查看验证结果：有效/无效记录数量

### 3. 开始同步
- 点击"开始同步"
- 系统逐条调用 REST API（使用 JSONPlaceholder 模拟）
- 实时更新每条记录的同步状态

### 4. 查看详情
- 点击批次"详情"查看完整信息
- 筛选查看成功/失败/验证失败的记录
- 查看每条记录的：
  - 原始 CSV 数据
  - 验证错误信息
  - API 请求内容
  - API 响应结果

### 5. 重试失败记录
- 在详情页选择要重试的失败记录
- 点击"重试"按钮
- 系统重新同步选中的记录

### 6. 导出报告
- 点击"导出报告"下载完整 CSV
- 报告包含：行号、状态、原始数据、错误信息、API 响应

## 数据模型

### SyncBatch (同步批次)
- `id`: 批次唯一标识
- `mappingId`: API 映射配置 ID
- `fileName`: 上传文件名
- `totalRows`: 总记录数
- `validRows`: 有效记录数
- `invalidRows`: 无效记录数
- `successRows`: 同步成功数
- `failedRows`: 同步失败数
- `status`: 批次状态 (pending/validating/validated/processing/success/failed/partial_success)
- `createdAt`: 创建时间
- `startedAt`: 开始同步时间
- `completedAt`: 完成时间

### SyncRow (同步行)
- `id`: 行记录唯一标识
- `batchId`: 所属批次 ID
- `rowNumber`: CSV 行号
- `rawData`: 原始 CSV 数据
- `transformedData`: 转换后的 API 请求数据
- `status`: 行状态 (pending/valid/invalid/processing/success/failed/skipped)
- `validationErrors`: 验证错误列表
- `apiRequest`: API 请求内容
- `apiResponse`: API 响应内容
- `errorMessage`: 错误信息
- `retryCount`: 重试次数
- `syncedAt`: 同步时间

## API 接口

```
POST   /api/batches               # 创建同步批次（上传CSV）
POST   /api/batches/:id/validate  # 验证批次数据
POST   /api/batches/:id/process   # 开始同步批次
POST   /api/batches/:id/retry     # 重试失败记录
GET    /api/batches               # 查询批次列表
GET    /api/batches/:id           # 查询批次详情
GET    /api/batches/:id/rows      # 查询批次行记录
GET    /api/batches/:id/report    # 获取同步报告
GET    /api/batches/:id/export    # 导出 CSV 报告
GET    /api/templates              # 获取 CSV 模板列表
GET    /api/mappings               # 获取 API 映射列表
GET    /api/stats                  # 获取统计数据
```

## 样例数据说明

### normal_data.csv
- 10 条格式正确的用户数据
- 所有字段验证通过
- 可用于测试完整的同步流程

### with_errors.csv
- 包含多种验证错误：
  - 邮箱格式错误 (第2行)
  - 手机号格式错误 (第3行)
  - 角色枚举值错误 (第4行, 第9行)
  - 邮箱字段为空 (第6行)
  - 角色字段为空 (第10行)
- 用于测试脏数据拦截功能

## 状态流转

### 批次状态
```
pending → validating → validated → processing → success
                                         ↓
                                      partial_success
                                         ↓
                                       failed
```

### 行记录状态
```
pending → validating → valid → processing → success
                    ↓                       ↓
                 invalid                   failed
```

## 注意事项

1. **演示用途**：当前版本使用内存存储，重启后数据丢失
2. **API 模拟**：使用 JSONPlaceholder 作为模拟 API，实际使用时需配置真实接口
3. **并发控制**：当前版本逐条同步，生产环境可优化为并发 + 限流
4. **幂等性**：实际使用时建议添加幂等键防止重复提交
