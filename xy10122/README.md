# 商品标题归类纠错器

解决商家标题写法不统一、类目错标问题，让错误样本、解释理由和修正历史都可追踪。

## 核心功能

- ✅ **数据导入** - 支持 CSV/Excel 格式批量导入商品数据
- 🤖 **自动归类** - 基于关键词规则引擎自动识别商品类目
- 👀 **人工复核** - 可疑结果进入人工复核队列，支持单条/批量复核
- ↩️ **误判回滚** - 历史操作可追溯，支持一键回滚
- 📦 **版本记录** - 按导入批次管理数据，可追溯历史版本
- 📊 **报告导出** - 归类报告、修正历史可导出 CSV
- ⚙️ **规则管理** - 支持自定义归类规则，调整关键词和优先级

## 项目结构

```
.
├── backend/
│   ├── __init__.py
│   ├── database.py      # 数据库配置
│   ├── models.py        # 数据模型
│   ├── classifier.py    # 归类规则引擎
│   └── main.py          # API 服务
├── frontend/
│   └── index.html       # Web 界面
├── data/                # 数据存储（自动创建）
│   ├── classifier.db
│   └── exports/
├── requirements.txt
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问界面

打开浏览器访问：http://localhost:8000

## 使用指南

### 数据导入

1. 准备数据文件（CSV 或 Excel），必须包含以下列：
   - `product_id` - 商品唯一标识
   - `title` - 商品标题
   - `category` - 原始类目（可选）

2. 在「数据导入」页面拖拽或点击上传文件

3. 系统自动进行分类识别，分类与原类目不同的会标记为「待复核」

### 人工复核

1. 在「人工复核」页面查看待复核商品
2. 点击「复核」按钮查看详情和修正历史
3. 选择正确类目，填写复核理由
4. 确认后状态变为「已复核」

**批量复核**：
- 勾选多个商品
- 点击「批量复核」统一设置类目

### 误判回滚

1. 在「商品列表」或复核弹窗中点击「历史」
2. 查看所有修正记录（自动归类、人工复核、回滚操作）
3. 点击「回滚此操作」恢复到之前的类目

### 版本管理

- 每次导入生成一个批次（Batch ID）
- 在「版本记录」页面查看所有导入历史
- 可在商品列表按批次筛选数据

### 规则管理

系统内置 15 个类目的默认规则，可自定义：

- 点击「新增规则」添加新类目规则
- 填写类目名称和关键词（逗号分隔）
- 设置优先级（数字越大优先级越高）

**内置类目**：
手机数码、手机配件、电脑办公、电脑配件、服装男装、服装女装、鞋靴、家居家纺、食品零食、酒水饮料、美妆护肤、母婴用品、图书文具、运动户外、汽车用品

### 报告导出

- **归类报告** - 导出所有商品的分类结果、状态、复核信息
- **修正历史** - 导出所有分类变更记录，包括操作类型、操作人、时间

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 获取统计数据 |
| POST | `/api/import` | 导入商品数据 |
| GET | `/api/products` | 商品列表（支持分页/筛选） |
| GET | `/api/products/{id}` | 商品详情 + 修正历史 |
| POST | `/api/products/{id}/review` | 人工复核 |
| POST | `/api/products/batch-review` | 批量复核 |
| POST | `/api/products/{id}/rollback` | 误判回滚 |
| GET | `/api/batches` | 导入批次列表 |
| GET | `/api/rules` | 规则列表 |
| POST/PUT/DELETE | `/api/rules` | 规则增删改 |
| GET | `/api/categories` | 所有类目列表 |
| GET | `/api/export/report` | 导出归类报告 |
| GET | `/api/export/history` | 导出修正历史 |

## 数据模型

### Product（商品）
- product_id: 商品唯一标识
- title: 商品标题
- original_category: 原始类目
- current_category: 当前类目
- status: 状态（pending_review / auto_classified / reviewed）
- batch_id: 导入批次

### Correction（修正记录）
- product_id: 关联商品
- old_category: 原类目
- new_category: 新类目
- reason: 理由说明
- source: 操作类型（auto / manual / rollback）
- operator: 操作人
- is_rolled_back: 是否已回滚
- created_at: 操作时间

### Batch（导入批次）
- batch_id: 批次号
- filename: 文件名
- total_count: 总数
- auto_classified_count: 自动归类数
- pending_review_count: 待复核数
- created_at: 导入时间

## 扩展建议

1. **接入本地模型**：在 `classifier.py` 中替换或增强 `classify()` 方法，可接入轻量级 NLP 模型（如 TextCNN、tinyBERT 等）

2. **批量重新分类**：新增规则后，可添加对历史数据的重新分类功能

3. **分类置信度**：增加置信度评分，低置信度强制进入人工复核

4. **多语言支持**：扩展关键词规则适配多语言场景
