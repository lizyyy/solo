# 酒店布草洗涤追踪系统

一个完整的全栈酒店管理系统，用于追踪布草的洗涤、交接、破损和赔付流程。

## 功能特性

### 核心业务流程
- **布草标签管理**: 每个布草的全生命周期追踪
- **楼层交接**: 布草在酒店各楼层之间的交接记录
- **洗涤厂收发**: 布草送往洗涤厂及从工厂送回的记录
- **破损管理**: 破损照片上传、审核流程
- **赔付规则**: 灵活的赔付规则配置
- **库存回补**: 布草回库和返回房间管理

### 关键功能
- ✅ **破损照片拦截**: 必须上传破损照片才能创建破损记录
- ✅ **赔付规则留痕**: 所有赔付操作都有完整记录
- ✅ **重复回调不重复扣减**: 使用去重键防止重复赔付
- ✅ **状态时间线**: 可视化展示布草状态变更历史
- ✅ **修改记录**: 保留所有字段修改的前后值
- ✅ **报告导出**: 支持按责任人、时间筛选导出Excel报告

### 业务样例流程
1. **正常流程**: 在房间 → 楼层交接 → 送洗涤厂 → 工厂送回 → 库存回补 → 返回房间
2. **问题流程**: 发现破损 → 破损审核 → 创建赔付 → 赔付扣减
3. **复核流程**: 破损审核（无需赔付）→ 继续洗涤流程

## 技术栈

### 后端
- Node.js + Express
- SQLite 数据库
- Multer 文件上传
- ExcelJS 报表导出

### 前端
- React 18
- Ant Design 5
- Axios HTTP 客户端
- Day.js 日期处理

## 项目结构

```
.
├── backend/                 # 后端项目
│   ├── database/           # 数据库相关
│   ├── routes/             # API 路由
│   ├── scripts/            # 脚本文件
│   ├── uploads/            # 上传文件目录
│   ├── server.js           # 服务器入口
│   └── package.json        # 后端依赖
├── frontend/               # 前端项目
│   ├── public/             # 静态资源
│   ├── src/                # 源代码
│   │   ├── pages/          # 页面组件
│   │   ├── App.js          # 应用入口
│   │   └── index.js        # 渲染入口
│   └── package.json        # 前端依赖
└── README.md               # 项目说明
```

## 快速开始

### 1. 初始化数据库

```bash
cd backend
npm install
node scripts/init-db.js
```

### 2. 启动后端服务

```bash
cd backend
npm start
# 或开发模式
npm run dev
```

后端服务运行在 http://localhost:3001

### 3. 启动前端服务

```bash
cd frontend
npm install
npm start
```

前端服务运行在 http://localhost:3000

## API 接口说明

### 布草标签
- `GET /api/linen` - 获取所有布草
- `GET /api/linen/:tagCode` - 获取单个布草详情
- `GET /api/linen/:tagCode/timeline` - 获取布草状态时间线
- `GET /api/linen/:tagCode/logs` - 获取布草修改记录
- `POST /api/linen` - 创建布草
- `PUT /api/linen/:tagCode/status` - 更新布草状态
- `PUT /api/linen/:tagCode` - 更新布草信息

### 楼层交接
- `GET /api/handover` - 获取所有交接记录
- `POST /api/handover` - 创建交接记录
- `PUT /api/handover/:id` - 更新交接记录

### 洗涤厂收发
- `GET /api/factory` - 获取所有工厂收发记录
- `POST /api/factory/send` - 创建送厂记录
- `POST /api/factory/receive` - 创建接收记录
- `PUT /api/factory/:id` - 更新收发记录

### 破损管理
- `GET /api/damage` - 获取所有破损记录
- `GET /api/damage/:id` - 获取单个破损记录
- `POST /api/damage` - 上报破损（需上传照片）
- `POST /api/damage/:id/review` - 审核破损

### 赔付管理
- `GET /api/compensation/rules` - 获取所有赔付规则
- `GET /api/compensation/rules/:id` - 获取单个赔付规则
- `POST /api/compensation/rules` - 创建赔付规则
- `GET /api/compensation/records` - 获取所有赔付记录
- `POST /api/compensation/records` - 创建赔付记录（防重复）
- `POST /api/compensation/records/:id/deduct` - 执行扣减

### 库存管理
- `GET /api/inventory` - 获取库存记录
- `POST /api/inventory/restock` - 库存回补
- `POST /api/inventory/back-to-room` - 返回房间

### 报告导出
- `GET /api/report/export` - 导出Excel报告
  - 支持参数: `responsible_person`, `start_date`, `end_date`, `tag_code`
- `GET /api/report/statistics` - 获取统计数据

## 数据库表结构

### 主要表
- `linen_tags` - 布草标签主表
- `linen_tag_logs` - 布草修改日志
- `floor_handover` - 楼层交接记录
- `floor_handover_logs` - 交接修改日志
- `factory_transactions` - 工厂收发记录
- `factory_transaction_logs` - 收发修改日志
- `damage_photos` - 破损照片记录
- `compensation_rules` - 赔付规则配置
- `compensation_records` - 赔付执行记录（含去重键）
- `inventory_restock` - 库存回补记录
- `status_timeline` - 状态变更时间线

## 使用说明

### 正常流程操作
1. 创建布草标签
2. 楼层交接登记
3. 送往洗涤厂
4. 工厂洗涤完成送回
5. 库存回补
6. 布草返回房间

### 问题流程操作
1. 发现破损，上传破损照片
2. 管理员审核破损
3. 如需要赔付，创建赔付记录
4. 执行赔付扣减
5. 布草后续处理（报废/修复）

### 报告导出
1. 进入报告导出页面
2. 可按标签编号、责任人、时间范围筛选
3. 点击导出按钮下载Excel报告

## 注意事项

1. 所有修改操作都会记录修改前后值
2. 赔付记录使用去重键防止重复扣减
3. 破损照片是必填项，不上传无法创建破损记录
4. 数据库文件位于 `backend/database/linen-tracking.db`
5. 上传的照片保存在 `backend/uploads/` 目录

## 开发说明

### 添加新的赔付规则
可以直接调用 `POST /api/compensation/rules` 接口添加，或在初始化脚本中添加默认规则。

### 扩展状态类型
在 `statusMap` 对象中添加新的状态及对应的显示配置。

### 自定义报告字段
修改 `backend/routes/report.js` 中的导出逻辑即可。

## 许可证

MIT