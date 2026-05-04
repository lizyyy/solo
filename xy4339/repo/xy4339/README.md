# 裁纸报价助手

社区印刷店智能裁纸报价系统 - 自动计算开数、损耗、缺纸，生成报价单和备料单。

## 功能特性

- 📋 **订单管理**: 录入/导入订单，支持批量CSV导入
- 📏 **智能裁切计算**: 自动计算最优排版方案、开数、纸张利用率
- ⚠️ **风险预警**: 自动检测缺纸、低利用率等风险
- 💰 **报价计算**: 材料成本+人工成本+加急费自动核算
- 📤 **导出功能**: Markdown报价单、CSV备料单
- 📦 **库存管理**: 实时库存查询，订单确认自动扣减库存
- 🔄 **订单流转**: 草稿→已报价→已确认→生产中→已完成

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 启动Flask服务
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 第一次报价流程

#### 方法一：手动录入

1. 打开浏览器访问 `http://localhost:5000`
2. 点击「新建订单」标签
3. 填写客户信息（可选）
4. 点击「添加订单项」，填写：
   - 产品名称：例如「宣传单页」
   - 成品宽度：210 (mm)
   - 成品高度：285 (mm)
   - 数量：5000
   - 纸质：铜版纸
   - 克重：157 (g)
   - 颜色：白色
   - 纹理方向：不限
5. 点击「保存订单」
6. 在订单列表中点击「查看」
7. 点击「计算裁切方案」，选择库存纸张（如「大度纸 - 铜版纸 157g 白色」）
8. 查看计算结果：
   - 开数：如16开
   - 纸张利用率：如92%
   - 需要纸张数量：如313张
   - 风险提示：如库存不足会显示警告
   - 报价明细：材料成本、人工成本、加急费、最终报价
9. 点击「导出报价单」下载Markdown格式
10. 点击「导出备料单」下载CSV格式

#### 方法二：CSV导入

使用示例文件 `sample_orders.csv`：

1. 点击「新建订单」
2. 点击「导入CSV」
3. 选择 `sample_orders.csv` 文件
4. 查看导入的订单

## 项目结构

```
paper-cutter-helper/
├── app.py                  # 主入口
├── config.py               # 配置文件
├── requirements.txt        # 依赖列表
├── README.md              # 本文档
├── sample_orders.csv      # 示例订单CSV
│
├── models/                # 数据模型
│   ├── __init__.py
│   ├── paper_spec.py      # 纸张规格
│   ├── paper_stock.py     # 库存
│   ├── order.py           # 订单
│   ├── order_item.py      # 订单项
│   ├── cutting_plan.py    # 裁切方案
│   ├── stock_transaction.py # 库存变动
│   └── sample_data.py     # 示例数据
│
├── services/              # 核心服务
│   ├── __init__.py
│   ├── cutting_calculator.py  # 裁切计算引擎
│   └── quotation_calculator.py # 报价计算引擎
│
├── routes/                # 路由
│   ├── __init__.py
│   ├── main.py            # 页面路由
│   └── api.py             # API路由
│
├── templates/             # 前端模板
│   └── index.html
│
├── static/                # 静态资源
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
│
└── paper_cutter.db        # SQLite数据库（首次运行自动生成）
```

## 核心算法说明

### 裁切计算 (`services/cutting_calculator.py`)

1. **排版计算**: 考虑纸张边距、裁切损耗，自动计算横竖两种排列方式
2. **开数计算**: 每张大纸能裁切的成品数量（如16开 = 16张/大纸）
3. **利用率计算**: `(成品总面积) / (大纸总面积)`
4. **损耗计算**: 基础纸张 + 3% 印刷损耗
5. **纹理方向**: 支持短边、长边、不限三种纹理约束

### 报价计算 (`services/quotation_calculator.py`)

- **材料成本**: 纸张数量 × 单价 + 3%损耗
- **人工成本**: 按裁切刀数计算（每小时约100刀，每小时80元）
- **加急费**: 总成本 × 30%（加急订单）
- **利润加成**: 总成本 × 25%
- **批量折扣**: 200份以上5%，500份以上10%，1000份以上15%

## API接口

### 订单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/orders | 获取订单列表 |
| POST | /api/orders | 创建订单 |
| GET | /api/orders/<id> | 获取订单详情 |
| PUT | /api/orders/<id> | 更新订单 |
| DELETE | /api/orders/<id> | 删除订单 |

### 裁切计算

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/calculate/cutting | 计算单个裁切方案 |
| POST | /api/calculate/find-best-stock | 查找最优库存方案 |
| POST | /api/orders/<id>/calculate-plan | 为订单项计算方案 |

### 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/orders/<id>/export/quotation | 导出Markdown报价单 |
| GET | /api/orders/<id>/export/materials | 导出CSV备料单 |

### 库存

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/stocks | 获取库存列表 |
| GET | /api/stocks/<id> | 获取库存详情 |

## 配置项 (`config.py`)

```python
DEFAULT_CUTTING_LOSS = 3      # 默认裁切损耗(mm)
DEFAULT_MARGIN = 10           # 默认边距(mm)
DEFAULT_WASTAGE_RATE = 0.03   # 损耗率3%
URGENT_SURCHARGE_RATE = 0.3   # 加急费率30%
LABOR_COST_PER_HOUR = 80      # 人工80元/小时
```

## 示例数据

首次运行会自动创建以下示例库存：

| 规格 | 纸质 | 克重 | 颜色 | 单价 | 库存 |
|------|------|------|------|------|------|
| 大度纸(889×1194) | 铜版纸 | 157g | 白色 | ¥2.50 | 500张 |
| 大度纸(889×1194) | 铜版纸 | 200g | 白色 | ¥3.20 | 300张 |
| 大度纸(889×1194) | 胶版纸 | 80g | 米白 | ¥1.80 | 800张 |
| 正度纸(787×1092) | 铜版纸 | 128g | 白色 | ¥2.20 | 400张 |
| ... | ... | ... | ... | ... | ... |

## 常见问题

**Q: 什么是开数？**
A: 开数表示一张大纸能切成多少张成品。如大度纸切A4宣传单，通常是16开（16张/大纸）。

**Q: 为什么有裁切损耗？**
A: 实际裁切时刀与刀之间需要留缝隙，通常每刀3mm左右。

**Q: 什么是纹理方向？**
A: 纸张纤维有方向性，影响印刷效果。短边纹理适合横向印刷，长边纹理适合纵向印刷。

**Q: 如何调整报价参数？**
A: 修改 `config.py` 中的配置项，或直接修改 `services/quotation_calculator.py` 中的计算逻辑。

## 技术栈

- **后端**: Flask 3.0 + SQLAlchemy + SQLite
- **前端**: 原生HTML/CSS/JavaScript
- **运行环境**: Python 3.8+

## 许可证

MIT License
