# 食堂留样追溯系统

学校后勤留样追溯 API 服务，用于学生投诉或抽检时按餐次、菜品、留样盒和冷藏柜事件追溯责任。

## 技术栈

- FastAPI - Web 框架
- SQLite - 数据库
- SQLAlchemy - ORM
- Pydantic - 数据验证

## 功能特性

- 登记留样
- 扫码入柜/取样
- 过期预警
- 投诉反查
- 导出追溯报告
- 支持导入 meals.csv、sample_events.jsonl、fridge_rules.yaml
- 处理重复盒码、事件乱序边界情况

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn app.main:app --reload
```

服务将在 http://localhost:8000 启动

API 文档：http://localhost:8000/docs

### 运行测试脚本

```bash
python demo.py
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # 应用入口
│   ├── models.py            # 数据库模型
│   ├── schemas.py           # Pydantic 模式
│   ├── database.py          # 数据库配置
│   ├── crud.py              # 持久化层
│   ├── validation.py        # 规则校验
│   ├── services.py          # 业务服务
│   └── routes/              # 路由
│       ├── __init__.py
│       ├── samples.py
│       ├── import.py
│       ├── alerts.py
│       └── trace.py
├── data/                    # 示例数据
│   ├── meals.csv
│   ├── sample_events.jsonl
│   └── fridge_rules.yaml
├── requirements.txt
├── README.md
└── demo.py                  # 演示脚本
```

## API 接口

### 留样管理

- `POST /api/samples/register` - 登记留样
- `POST /api/samples/scan-in` - 扫码入柜
- `POST /api/samples/scan-out` - 扫码取样

### 数据导入

- `POST /api/import/meals` - 导入餐次数据
- `POST /api/import/sample-events` - 导入留样事件
- `POST /api/import/fridge-rules` - 导入冷藏柜规则

### 预警与追溯

- `GET /api/alerts/expiry` - 过期预警
- `POST /api/trace/complaint` - 投诉反查
- `POST /api/trace/export-report` - 导出追溯报告
