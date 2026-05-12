# 多阶段导入校验台

运营批量导入客户/商品名单的多阶段校验系统，支持上传/粘贴 CSV/JSON、字段映射配置、预检错误查看、试导入、确认落库和回滚批次。

## 功能特性

- **多阶段流程**：上传 → 字段映射 → 数据预检 → 试导入 → 确认导入 → 回滚

- **业务规则校验**：
  - 必填缺失校验
  - 枚举值合法性校验
  - 重复数据检测（文件内重复 + 数据库重复）
  - 字段映射冲突检测
  - 格式校验（邮箱、数字等）
  - 试导入后源文件变化检测

- **回滚机制**：
  - 已确认批次回滚只生成补偿记录
  - 不直接抹除历史数据
  - 保留完整审计轨迹

- **完整时间线**：
  - 展示上传、预检、试导入、确认、回滚各阶段
  - 每步处理行数统计
  - 错误行人工修正
  - 确认人追踪

## 技术栈

- **后端**：Node.js + Express + SQLite (Sequelize ORM)
- **前端**：React 18 + Vite + Ant Design 5
- **数据格式**：支持 CSV 和 JSON

## 快速开始

### 1. 安装依赖

```bash
npm run install:all
```

### 2. 启动开发环境

```bash
# 启动后端 (端口 3001)
npm run dev:server

# 启动前端 (端口 5173)
npm run dev:client

# 或者同时启动前后端
npm run dev
```

### 3. 访问系统

- 前端地址：http://localhost:5173
- 后端地址：http://localhost:3001

## 项目结构

```
.
├── server/                    # 后端服务
│   ├── src/
│   │   ├── config/        # 数据库配置
│   │   ├── models/        # 数据模型
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务服务
│   │   ├── utils/         # 工具函数
│   │   └── index.js      # 入口文件
│   └── package.json
├── client/                  # 前端应用
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API 服务
│   │   ├── utils/         # 工具函数
│   │   ├── styles/        # 样式文件
│   │   ├── App.jsx      # 应用入口
│   │   └── main.jsx     # 渲染入口
│   └── package.json
├── sample-customers.csv      # 客户导入样例（正确数据）
├── sample-customers-with-errors.csv  # 客户导入样例（含错误）
├── sample-products.csv    # 商品导入样例
└── sample-customers.json  # JSON 格式样例
```

## 数据模型

### 核心表：

1. **import_batches** - 导入批次主表
   - 批次信息、状态、统计数据
   - 源文件哈希（变化检测）
   - 各阶段报告

2. **import_timelines** - 时间线
   - 记录每个操作步骤
   - 处理行数统计
   - 操作人、时间

3. **import_errors** - 错误明细
   - 错误类型、消息、原始值
   - 人工修正记录

4. **imported_records** - 已导入记录
   - 关联批次
   - 回滚标记

5. **compensation_records** - 补偿记录
   - 回滚时生成
   - 保留历史数据

## 业务流程

### 正常导入流程：

1. **创建批次** → 选择导入类型（客户/商品）

2. **上传数据**
   - 支持上传 CSV/JSON 文件
   - 支持粘贴 CSV/JSON 内容

3. **配置字段映射**
   - 源列 → 目标字段映射
   - 必填字段标记
   - 唯一键字段标记

4. **数据预检**
   - 执行所有规则校验
   - 查看错误报告
   - 人工修正错误
   - 可重复预检

5. **试导入**
   - 预览即将导入的数据
   - 确认数据正确性
   - 检测源文件变化

6. **确认导入**
   - 正式落库
   - 生成最终报告

7. **（可选）回滚批次
   - 输入回滚原因
   - 生成补偿记录
   - 标记已归档

## 测试用例

### 样例文件：

1. **sample-customers.csv** - 正确的客户数据
   - 5 条有效记录
   - 包含各种枚举值

2. **sample-customers-with-errors.csv** - 含错误的客户数据
   - 第2行：客户名称必填缺失
   - 第3行：客户等级枚举不合法
   - 第4行：客户编号重复
   - 第5行：邮箱格式错误

3. **sample-products.csv** - 正确的商品数据

### 测试场景：

#### 失败路径：
上传 sample-customers-with-errors.csv
→ 配置字段映射
→ 执行预检
→ 发现错误
→ 人工修正
→ 重新预检
→ 试导入
→ 确认导入

#### 重复执行路径：
第一次：导入 sample-customers.csv
→ 确认导入
→ 回滚批次
→ 再导入同一份文件
→ 预检会检测到数据库重复

## API 接口

### 批次管理：
- `POST /api/batches` - 创建批次
- `GET /api/batches` - 批次列表
- `GET /api/batches/:id` - 批次详情

### 数据操作：
- `POST /api/batches/:id/upload` - 上传数据
- `POST /api/batches/:id/mapping` - 配置映射
- `POST /api/batches/:id/precheck` - 执行预检
- `POST /api/batches/:id/trial` - 试导入
- `POST /api/batches/:id/confirm` - 确认导入
- `POST /api/batches/:id/rollback` - 回滚批次

### 错误处理：
- `POST /api/batches/:id/errors/:errorId/fix` - 修正错误

## 字段定义

### 客户字段：
- `customerNo` - 客户编号（必填、唯一键）
- `customerName` - 客户名称（必填）
- `phone` - 联系电话
- `email` - 电子邮箱
- `level` - 客户等级（枚举：normal/silver/gold/platinum）
- `source` - 客户来源（枚举：online/offline/referral/advertisement）
- `province` - 省份
- `city` - 城市
- `address` - 详细地址
- `remark` - 备注

### 商品字段：
- `productCode` - 商品编码（必填、唯一键）
- `productName` - 商品名称（必填）
- `category` - 分类（枚举）
- `price` - 价格（数字）
- `stock` - 库存（整数）
- `unit` - 计量单位
- `brand` - 品牌
- `remark` - 备注
