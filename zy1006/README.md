# 样品借用台账系统

一个为小工作室设计的样品借用管理全栈系统，帮助管理拍摄样品、测试机、配件的借用和归还流程。

## 功能特性

### 📦 样品管理
- 录入样品信息（名称、编号、分类、库存位置、押金/价值）
- 编辑和删除样品
- 按状态、分类、关键词搜索筛选
- 状态联动：已借出的样品不能重复借出

### 📝 借用管理
- 发起借用单（借用人、联系方式、预计归还日期）
- 归还操作（实际归还时间、损坏/缺件说明）
- 自动检测逾期状态
- 状态联动：归还后样品自动变为可借状态

### 📊 首页概览
- 可借库存、待归还、已逾期统计
- 近期借用记录列表
- 逾期未还提醒
- 快速操作说明

### 📤 导入导出
- CSV 批量导入样品（自动校验重复编号）
- 导出借用记录 CSV（支持日期范围筛选）
- 下载导入模板

## 技术栈

### 后端
- **Node.js** + **Express** - Web 服务器
- **Prisma** - ORM 数据库工具
- **SQLite** - 本地持久化数据库
- **csv-parser** / **csv-writer** - CSV 文件处理
- **multer** - 文件上传处理

### 前端
- **React 18** - UI 框架
- **Vite** - 构建工具
- **Ant Design** - UI 组件库
- **React Router** - 路由管理
- **Day.js** - 日期处理

## 项目结构

```
zy1006/
├── backend/                 # 后端项目
│   ├── prisma/             # Prisma 配置
│   │   └── schema.prisma   # 数据模型定义
│   ├── server.js           # 后端服务入口
│   └── package.json        # 后端依赖配置
│
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   │   ├── Dashboard.jsx       # 首页概览
│   │   │   ├── Samples.jsx         # 样品管理
│   │   │   ├── BorrowRecords.jsx   # 借用记录
│   │   │   └── ImportExport.jsx    # 导入导出
│   │   ├── services/       # API 服务
│   │   │   └── api.js      # API 封装
│   │   ├── App.jsx         # 主应用组件
│   │   ├── main.jsx        # 入口文件
│   │   ├── App.css         # 应用样式
│   │   └── index.css       # 全局样式
│   ├── index.html          # HTML 模板
│   ├── vite.config.js      # Vite 配置
│   └── package.json        # 前端依赖配置
│
└── package.json            # 根项目配置
```

## 安装和运行

### 前置要求
- Node.js >= 16.0.0
- npm >= 7.0.0

### 步骤 1: 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装所有工作区依赖
npm run install:all
```

或者分别安装：

```bash
# 后端依赖
cd backend
npm install

# 前端依赖
cd ../frontend
npm install
```

### 步骤 2: 初始化数据库

```bash
cd backend

# 初始化 Prisma 并创建数据库
npx prisma migrate dev --name init

# 生成 Prisma 客户端
npx prisma generate
```

### 步骤 3: 启动服务

**方式一：分别启动（推荐开发时使用）**

```bash
# 终端 1: 启动后端服务 (端口 3001)
cd backend
npm run dev

# 终端 2: 启动前端服务 (端口 3000)
cd frontend
npm run dev
```

**方式二：使用 npm 脚本**

```bash
# 后端
npm run dev:backend

# 前端
npm run dev:frontend
```

### 步骤 4: 访问系统

- 前端页面：http://localhost:3000
- 后端 API：http://localhost:3001

## 数据模型

### 样品 (Sample)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| name | String | 样品名称 |
| code | String | 样品编号（唯一） |
| category | String | 分类 |
| location | String | 库存位置 |
| deposit | Float | 押金 |
| value | Float | 价值 |
| status | Enum | 状态：AVAILABLE/BORROWED/DAMAGED/LOST |

### 借用记录 (BorrowRecord)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| sampleId | Int | 关联样品 ID |
| borrowerName | String | 借用人姓名 |
| borrowerContact | String | 联系方式 |
| expectedReturnDate | DateTime | 预计归还日期 |
| actualReturnDate | DateTime | 实际归还日期 |
| damageNote | String | 损坏/缺件说明 |
| status | Enum | 状态：BORROWED/RETURNED/OVERDUE |

## API 接口

### 统计接口
- `GET /api/stats` - 获取统计数据（可借、待归还、已逾期数量）

### 样品接口
- `GET /api/samples` - 获取样品列表（支持筛选）
- `GET /api/samples/:id` - 获取单个样品详情
- `GET /api/samples/categories` - 获取所有分类
- `POST /api/samples` - 创建样品
- `PUT /api/samples/:id` - 更新样品
- `DELETE /api/samples/:id` - 删除样品
- `POST /api/samples/import` - 批量导入样品
- `GET /api/samples/export-template` - 下载导入模板

### 借用记录接口
- `GET /api/borrow-records` - 获取借用记录列表（支持筛选）
- `POST /api/borrow-records` - 创建借用记录
- `PUT /api/borrow-records/:id/return` - 归还操作
- `GET /api/borrow-records/export` - 导出借用记录 CSV

## 使用说明

### 1. 录入样品
1. 进入「样品管理」页面
2. 点击「新增样品」按钮
3. 填写样品信息（名称、编号为必填项）
4. 点击「确定」保存

### 2. 发起借用
1. 在「样品管理」或「首页」找到可借样品
2. 点击「发起借用」按钮
3. 填写借用人信息和预计归还日期
4. 点击「确定」创建借用记录

### 3. 归还样品
1. 进入「借用记录」页面
2. 找到对应的借用记录
3. 点击「归还」按钮
4. 填写实际归还日期和损坏说明（如有）
5. 点击「确认归还」

### 4. 批量导入样品
1. 进入「导入导出」页面
2. 点击「下载导入模板」
3. 按照模板格式填写样品信息
4. 点击「选择 CSV 文件导入」上传文件
5. 查看导入结果，如有错误会显示详情

### 5. 导出借用记录
1. 进入「借用记录」或「导入导出」页面
2. （可选）设置日期范围筛选
3. 点击「导出 CSV」按钮
4. 下载文件用于对账

## 注意事项

1. **状态联动**：
   - 样品状态会根据借用记录自动更新
   - 已借出的样品不能再次借用
   - 归还时如有损坏说明，样品状态会标记为「损坏」

2. **逾期检测**：
   - 系统会自动检测逾期状态
   - 超过预计归还日期且未归还的记录会标记为「已逾期」

3. **数据安全**：
   - 使用 SQLite 本地数据库，数据存储在 `backend/prisma/dev.db`
   - 删除样品时会同时删除相关的借用记录
   - 正在借用中的样品无法删除

4. **CSV 导入**：
   - 样品编号必须唯一，重复编号会被跳过
   - 支持的列名：name/名称/样品名称, code/编号/样品编号, category/分类/样品分类, location/位置/库存位置, deposit/押金/押金金额, value/价值/样品价值

## 开发说明

### 数据库管理
```bash
# 查看数据库内容（启动 Prisma Studio）
cd backend
npx prisma studio

# 重新生成 Prisma 客户端
npx prisma generate

# 创建新的迁移
npx prisma migrate dev --name <migration-name>
```

### 前端开发
```bash
cd frontend
npm run dev          # 开发模式
npm run build        # 生产构建
npm run preview      # 预览生产构建
```

### 后端开发
```bash
cd backend
npm run dev          # 开发模式
npm start            # 生产模式
```

## 常见问题

**Q: 前端无法连接后端？**
- 检查后端服务是否在 3001 端口运行
- 检查前端 vite.config.js 中的代理配置

**Q: 数据库初始化失败？**
- 确保已安装依赖：`cd backend && npm install`
- 确保有写入权限：`backend/prisma/` 目录

**Q: 导入 CSV 时乱码？**
- 确保 CSV 文件使用 UTF-8 编码
- 可以用文本编辑器另存为 UTF-8 格式

**Q: Excel 打开导出的 CSV 乱码？**
- 这是 Excel 的编码问题
- 解决方法：打开 Excel → 数据 → 从文本/CSV 导入 → 选择文件 → 编码选择 UTF-8

## 许可证

MIT License
