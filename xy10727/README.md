# 地址解析纠偏服务

地址解析纠偏服务（Address Correction Service）是一个面向 SRE 的地址数据管理平台，用于处理地址解析、比对、纠偏和复核的完整流程。

## 功能特性

### 核心功能
- **地址记录管理**：新增、编辑、删除、查询地址记录
- **批量比对**：对选中的地址记录进行地理编码与候选坐标的批量比对
- **人工纠偏**：对解析失败的地址进行人工修正，记录纠偏原因
- **复核确认**：对处理后的地址进行复核，记录复核意见
- **导出功能**：支持 Excel 和 CSV 格式导出地址数据
- **重新计算**：地理编码版本变化后支持批量重新计算

### 处理链追踪
- **完整操作日志**：记录每一条地址记录的所有处理操作
- **操作人追踪**：显示谁在什么时间进行了什么操作
- **原因记录**：记录人工纠偏和复核的原因说明
- **变更对比**：展示变更前后的数据差异

## 技术栈

### 后端
- **FastAPI**：现代、高性能的 Python Web 框架
- **SQLAlchemy**：ORM 框架
- **SQLite**：轻量级数据库（可扩展为 PostgreSQL）
- **Pandas**：数据处理和导出
- **Uvicorn**：ASGI 服务器

### 前端
- **Vue 3**：渐进式 JavaScript 框架
- **Element Plus**：Vue 3 组件库
- **Vue Router**：路由管理
- **Pinia**：状态管理
- **Axios**：HTTP 客户端
- **Vite**：构建工具

## 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+

### 一键启动（推荐）

```bash
chmod +x start.sh
./start.sh
```

### 手动启动

#### 后端启动

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --port 8000
```

后端 API 地址: http://localhost:8000
API 文档地址: http://localhost:8000/docs

#### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

前端页面地址: http://localhost:3000

## 测试数据

启动后端服务后，可以运行测试脚本生成示例数据：

```bash
cd backend
python test_data.py
```

## 项目结构

```
address-correction-service/
├── backend/                    # 后端服务
│   ├── app/
│   │   ├── api/               # API 路由
│   │   │   └── addresses.py   # 地址相关接口
│   │   ├── models/            # 数据模型
│   │   │   └── database.py    # 数据库模型定义
│   │   ├── schemas/           # Pydantic 模式
│   │   │   └── address.py     # 地址相关数据结构
│   │   ├── services/          # 业务逻辑
│   │   │   ├── address_service.py   # 地址服务
│   │   │   └── export_service.py    # 导出服务
│   │   └── main.py            # FastAPI 主入口
│   ├── requirements.txt       # Python 依赖
│   └── test_data.py           # 测试数据脚本
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── views/             # 页面组件
│   │   │   ├── AddressList.vue    # 列表页
│   │   │   ├── AddressDetail.vue  # 详情页
│   │   │   └── AddressForm.vue    # 表单页
│   │   ├── router/            # 路由配置
│   │   ├── api/               # API 封装
│   │   └── utils/             # 工具函数
│   ├── package.json           # Node 依赖
│   └── vite.config.js         # Vite 配置
├── start.sh                   # 一键启动脚本
└── README.md                  # 项目文档
```

## API 接口

### 地址记录
- `POST /api/addresses` - 新增地址记录
- `GET /api/addresses` - 获取地址记录列表（支持分页、筛选、搜索）
- `GET /api/addresses/{id}` - 获取地址记录详情（含操作日志和复核记录）
- `PUT /api/addresses/{id}` - 更新地址记录
- `DELETE /api/addresses/{id}` - 删除地址记录

### 业务操作
- `POST /api/addresses/{id}/correction` - 人工纠偏
- `POST /api/addresses/{id}/review` - 复核确认
- `POST /api/addresses/compare` - 批量比对
- `POST /api/addresses/export` - 导出数据
- `POST /api/addresses/recalculate` - 按版本重新计算

## 数据模型

### AddressRecord（地址记录）
- 原始地址（original_address）
- 地理编码结果（geocoding_result）
- 候选坐标（candidate_coordinates）
- 人工纠偏结果（manual_correction）
- 配送范围（delivery_range）
- 命中报告（hit_report）
- 状态（status）
- 是否失败（is_failed）
- 失败原因（failure_reason）
- 地理编码版本（geocoding_version）
- 处理人（processed_by）
- 处理时间（processed_at）

### OperationLog（操作日志）
- 记录 ID
- 操作人
- 操作类型（create/update/manual_correction/review/compare/recalculate）
- 旧值
- 新值
- 原因/说明
- 创建时间

### ReviewRecord（复核记录）
- 地址记录 ID
- 复核人
- 复核结果（pass/fail）
- 复核意见
- 复核时间

## 使用说明

1. **查看列表**：在首页可以查看所有地址记录，支持按状态、是否失败筛选
2. **失败记录**：点击失败记录的「详情」按钮，查看完整处理链
3. **处理链追踪**：在详情页可以查看：
   - 谁进行了操作
   - 操作时间
   - 操作原因
   - 数据变更前后对比
4. **人工纠偏**：在详情页点击「人工纠偏」，输入修正内容和原因
5. **复核确认**：在详情页点击「复核确认」，选择复核结果并输入意见
6. **批量比对**：在列表页多选记录后点击「批量比对」
7. **重新计算**：当地理编码版本变化后，点击「重新计算」按钮

## 边界情况处理

系统特别关注以下容易出错的边界场景：
1. **人工纠偏记录**：所有人工修改都会完整记录，保留历史轨迹
2. **配送范围匹配**：配送范围字段独立管理，支持单独维护
3. **地理编码版本**：支持不同版本地理编码的重新计算和对比
4. **失败记录追踪**：失败记录高亮显示，支持快速跳转详情
5. **操作人追溯**：所有操作都关联操作人，方便问题定位

## 许可证

MIT License
