# 民宿布草洗涤追踪系统

一个完整的民宿布草管理系统，包含布草管理、洗涤批次追踪、库存预警、赔付记录等功能。

## 功能特性

### 1. 布草管理
- 添加、编辑、删除布草
- 按类型、状态、房源筛选
- 支持条形码录入
- 洗涤次数统计
- 布草状态追踪（在库/洗涤中/丢失/已赔付）

### 2. 洗涤批次
- 创建送洗批次
- 按房源、类型筛选可送洗布草
- 验收入库功能
- 自动标记丢失布草
- 批次时间线记录

### 3. 批次详情
- 布草明细查看
- 操作时间线追踪
- 丢失布草赔付申请

### 4. 房源管理
- 房源信息维护
- 安全库存设置
- 楼栋楼层管理

### 5. 库存预警
- 各房源布草库存统计
- 低于安全库存自动预警
- 缺口数量显示

### 6. 赔付记录
- 赔付历史查询
- 支持赔付撤销（恢复布草入库）
- 赔付金额和原因记录

### 7. 数据导出
- 所有列表支持Excel导出
- 导出格式友好易读

### 8. 业务规则
- 防止重复送洗同一布草
- 回库数量不能超过送洗数量
- 赔付后布草可恢复入库
- 库存低于安全线自动预警

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- uuid 唯一ID生成

### 前端
- Vue 3 + Vue Router
- Element Plus UI组件库
- Axios HTTP客户端
- XLSX Excel导出

## 安装和运行

### 1. 安装后端依赖
```bash
npm install
```

### 2. 安装前端依赖
```bash
cd client
npm install
cd ..
```

### 3. 启动后端服务
```bash
npm run server
```
后端服务运行在 http://localhost:3000

### 4. 启动前端服务（新开终端）
```bash
npm run client
```
前端服务运行在 http://localhost:8080

### 5. 一键启动前后端（可选）
```bash
npm run dev
```

## 使用说明

### 第一步：添加房源
1. 点击"房源管理"菜单
2. 点击"添加房源"按钮
3. 填写房源名称、楼栋、楼层、安全库存
4. 点击"确认"

### 第二步：添加布草
1. 点击"布草管理"菜单
2. 点击"添加布草"按钮
3. 选择布草类型、填写条形码、选择所属房源、设置价格
4. 点击"确认"

### 第三步：创建送洗批次
1. 点击"洗涤批次"菜单
2. 点击"创建送洗批次"按钮
3. 筛选房源和类型（可选）
4. 勾选要送洗的布草
5. 点击"确认创建"

### 第四步：验收入库
1. 在批次列表中找到对应批次
2. 点击"验收入库"按钮
3. 勾选实际回库的布草
4. 点击"确认入库"
5. 未勾选的布草将自动标记为丢失

### 第五步：丢失布草赔付
1. 点击批次的"查看详情"
2. 在布草明细中找到丢失的布草
3. 点击"申请赔付"按钮
4. 填写赔付金额和原因
5. 点击"确认赔付"

### 查看库存预警
1. 点击"库存预警"菜单
2. 查看各房源的布草库存情况
3. 红色标记表示库存低于安全线

### 查看赔付记录
1. 点击"赔付记录"菜单
2. 查看所有赔付历史

## API接口

### 房源管理
- `GET /api/rooms` - 获取所有房源
- `POST /api/rooms` - 创建房源
- `PUT /api/rooms/:id` - 更新房源
- `DELETE /api/rooms/:id` - 删除房源

### 布草管理
- `GET /api/linens` - 获取布草列表（支持status/type/room_id筛选）
- `POST /api/linens` - 创建布草
- `PUT /api/linens/:id` - 更新布草
- `DELETE /api/linens/:id` - 删除布草
- `POST /api/linens/:id/restore` - 恢复已赔付布草入库

### 批次管理
- `GET /api/batches` - 获取批次列表（支持status筛选）
- `GET /api/batches/:id` - 获取批次详情
- `POST /api/batches` - 创建批次
- `POST /api/batches/:id/receive` - 验收入库

### 赔付管理
- `GET /api/claims` - 获取赔付记录
- `POST /api/claims` - 创建赔付记录

### 库存查询
- `GET /api/inventory` - 获取库存预警数据

### 其他
- `GET /api/linen-types` - 获取布草类型列表

## 数据持久化

数据存储在项目根目录的 `linen.db` SQLite数据库文件中。数据库包含以下表：
- `rooms` - 房源表
- `linens` - 布草表
- `batches` - 批次表
- `batch_items` - 批次明细表
- `claims` - 赔付记录表
- `batch_timeline` - 批次时间线表

## 注意事项

1. 确保3000和8080端口未被占用
2. 首次运行会自动创建数据库和表
3. 数据库文件会自动保存在项目根目录
4. 导出的Excel文件会下载到浏览器默认下载目录

## 项目结构

```
hotel-linen-tracking/
├── server/
│   ├── index.js          # 后端主入口
│   └── database.js       # 数据库初始化和操作
├── client/
│   ├── public/
│   │   └── index.html    # HTML模板
│   ├── src/
│   │   ├── main.js       # 前端入口
│   │   ├── App.vue       # 根组件
│   │   ├── router/       # 路由配置
│   │   └── views/        # 页面组件
│   │       ├── BatchList.vue      # 批次列表
│   │       ├── BatchDetail.vue    # 批次详情
│   │       ├── LinenList.vue      # 布草管理
│   │       ├── RoomList.vue       # 房源管理
│   │       ├── InventoryList.vue  # 库存预警
│   │       └── ClaimList.vue      # 赔付记录
│   ├── vue.config.js     # Vue配置
│   └── package.json      # 前端依赖
├── package.json          # 后端依赖
└── README.md             # 项目说明
```
