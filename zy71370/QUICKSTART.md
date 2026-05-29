# 画材库存替代推荐系统 - 快速启动

## 先跑什么

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 导入测试数据（含脏数据）
```bash
python -m app.data.seed_dirty_data
```

### 3. 启动服务
```bash
uvicorn app.main:app --reload
```

### 4. 打开接口文档
浏览器访问: http://127.0.0.1:8000/docs

---

## 再看哪里

| 功能 | 接口 | 推荐先试 |
|------|------|----------|
| 找替代品 | `GET /api/substitutes/{paint_id}` | paint_id 填 4 (镉黄中黄-断货) 或 7 (大红-停产) |
| 检测数据问题 | `POST /api/data-issues/scan` | 自动发现重复库存、无效色值、预算异常 |
| 创建采购单 | `POST /api/purchases` | 故意选断货颜料看自动替代逻辑 |
| 库存扣减 | `POST /api/stock/deduct` | 测试库存不足的异常处理 |
| 导出报告 | `POST /api/reports/generate` | report_type 选 inventory 或 purchase |
| 统计概览 | `GET /api/stats` | 一眼看全系统状态 |

---

## 核心数据流

```
颜料断货 → 颜色匹配(LAB ΔE) → 替代推荐 → 预算检查 → 采购创建 → 库存扣减 → 报告导出
     ↓         ↓                ↓            ↓          ↓            ↓
  色差警告  数据质量标记    预算超限提示  自动替代记录  状态流转    Excel多Sheet导出
```

---

## 预置脏数据（能被检测到的问题）

| 问题类型 | 示例 | 检测接口 |
|----------|------|----------|
| 库存重复 | 钛白(温莎牛顿) 录了3遍 | `/api/data-issues/scan` |
| 无效色值 | 金色、银色 LAB值超标 | `/api/data-issues/scan` |
| 负库存 | 熟褐 stock=-2 | `/api/data-issues/scan` |
| 预算负数 | 黄子轩 budget=-50 | `/api/data-issues/scan` |
| 预算异常 | 林诗涵 剩余>总预算 | `/api/data-issues/scan` |
| 同物异名 | 拿坡里黄/那坡里黄 | `/api/data-issues/scan` |

---

## 异常返回格式（统一）

```json
{
  "error_code": "OUT_OF_STOCK",
  "message": "颜料 [镉黄中黄] 库存不足...",
  "details": { "paint_id": 4, "shortage": 5 },
  "fix_suggestion": "可以开启自动替代功能..."
}
```

---

## 项目结构

```
app/
├── main.py           # API接口入口
├── models.py         # 7个数据库表
├── schemas.py        # 请求/响应结构
├── services.py       # 核心业务逻辑
├── exceptions.py     # 8种自定义异常
├── reports.py        # 4种Excel报告
├── database.py       # 数据库连接
├── data/
│   └── seed_dirty_data.py   # 脏数据导入脚本
└── reports/          # 导出的Excel存放处
```
