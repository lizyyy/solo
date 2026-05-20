# 证书续期编排控制台

一个用于管理大量边缘设备证书续期的全栈控制台应用。

## 功能特性

### 前端控制台
- **左侧筛选面板**: 同时按**设备分组**（多选复选框）和**到期时间**（7/15/30/60/90天）筛选批次
- **批次列表**: 展示所有续期批次的统计信息，显示当前活跃的筛选条件
- **详情页标签**:
  - 续期记录: 查看所有设备的续期状态，可模拟签发/吊销回调
  - 签发回执: 查看CA签发的证书回执编号和签发时间
  - 离线设备: 管理需要补偿的离线设备列表
  - 旧证吊销链路: 展示完整的旧证书吊销链路（吊销中/已吊销/吊销失败）
  - 补偿记录: 时间线展示每次补偿尝试的操作者和时间戳
  - 复盘报告: 生成完整的批次统计报告

### 后端接口
- `POST /api/batches`: 创建续期批次
- `POST /api/batches/:id/issue-callback`: 接收签发结果回调
- `POST /api/batches/:id/revoke-callback`: 接收吊销结果回调
- `POST /api/batches/:id/compensate`: 安排离线设备补偿
- `GET /api/batches/:id/report`: 生成复盘报告

### 样例数据
系统预置了各种场景的测试数据：
- ✅ 在线设备续期成功
- 📴 离线设备待补偿
- ❌ 签发失败
- ⚠️ 旧证吊销失败

### 重要特性
- **防重复处理**: 重复触发同一批次不会生成两套证书
- **完整链路追踪**: 每条补偿记录都显示操作者和时间戳
- **实时状态更新**: 模拟回调可实时更新设备状态

## 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 启动服务

```bash
# 方式1: 分别启动（推荐）

# 启动后端服务 (端口 3001)
cd server
npm run dev

# 启动前端服务 (端口 3000)
cd ../client
npm start
```

### 访问应用
打开浏览器访问: http://localhost:3000

## 使用指南

### 1. 查看和筛选批次列表
- 首页展示所有证书续期批次
- **左侧双维度筛选**:
  - 按**设备分组**筛选：多选复选框（A厂区、B厂区、仓库、零售门店、物流）
  - 按**到期时间**筛选：单选（7天/15天/30天/60天/90天内到期）
- 页面顶部显示当前活跃的筛选标签
- 每个批次卡片显示关键统计数据

### 2. 创建新批次
1. 点击"新建批次"按钮
2. 填写批次名称、操作人、到期阈值
3. 选择要处理的设备分组
4. 点击"创建批次"

### 3. 模拟签发回调
在批次详情页的"续期记录"标签中：
- 对状态为"待处理"的设备，可点击"模拟成功"或"模拟失败"
- 成功后状态会变为"吊销中"，可继续模拟吊销回调

### 4. 处理离线设备
1. 在"离线设备"标签查看所有待补偿设备
2. 点击"发起补偿"按钮
3. 选择操作人和要补偿的设备
4. 系统会随机生成补偿结果（成功/失败）

### 5. 查看旧证吊销链路
在"旧证吊销链路"标签中，可查看完整的吊销流程：
- **吊销中**：新证书已签发，正在等待旧证书吊销
- **已吊销**：旧证书已成功吊销（显示CA吊销回执）
- **吊销失败**：旧证书吊销失败（显示错误信息，可重试）
- 支持模拟吊销成功/失败回调

### 6. 查看补偿记录
在"补偿记录"标签中，可通过时间线查看：
- 每次补偿的时间
- 操作者信息
- 补偿结果（成功/失败）
- 错误信息（如果失败）

### 7. 生成复盘报告
点击"生成复盘报告"按钮，查看：
- 整体统计数据（成功、失败、待处理等）
- 需要关注的离线设备列表
- 各设备的补偿尝试次数

## API 调用示例

### 创建批次
```bash
curl -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试批次",
    "createdBy": "admin",
    "deviceGroups": ["factory-a", "factory-b"],
    "expiryThresholdDays": 30
  }'
```

### 模拟签发回调
```bash
curl -X POST http://localhost:3001/api/batches/batch-001/issue-callback \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "dev-001",
    "success": true,
    "certSn": "NEW-CERT-12345",
    "receipt": "CA-RECEIPT-20240515-0001"
  }'
```

### 发起补偿
```bash
curl -X POST http://localhost:3001/api/batches/batch-001/compensate \
  -H "Content-Type: application/json" \
  -d '{
    "deviceIds": ["dev-003", "dev-005"],
    "operator": "operator_zhang"
  }'
```

### 获取复盘报告
```bash
curl http://localhost:3001/api/batches/batch-001/report
```

## 项目结构

```
.
├── server/                 # 后端服务
│   ├── src/
│   │   ├── types.ts       # 类型定义
│   │   ├── store.ts       # 数据存储（内存）
│   │   ├── routes.ts      # API 路由
│   │   ├── index.ts       # 入口文件
│   │   └── data/          # 样例数据
│   └── package.json
├── client/                 # 前端应用
│   ├── src/
│   │   ├── types.ts       # 类型定义
│   │   ├── api.ts         # API 客户端
│   │   ├── App.tsx        # 主应用
│   │   ├── index.tsx      # 入口文件
│   │   ├── index.css      # 样式
│   │   └── components/    # 组件
│   └── package.json
└── README.md
```

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- 内存存储（可扩展为真实数据库）

### 前端
- React 18
- TypeScript
- React Router
- 原生 CSS

## 注意事项

1. 当前使用内存存储，重启服务后数据会重置
2. 模拟补偿结果是随机生成的，用于演示目的
3. 实际生产环境需要：
   - 替换为真实数据库
   - 对接真实CA服务
   - 添加设备在线状态检测
   - 添加用户认证和权限控制
   - 添加操作日志审计