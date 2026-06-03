# 基金销售尾佣拆分系统 - 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口
│   ├── database.py             # 数据库连接
│   ├── models.py               # SQLAlchemy 模型
│   ├── schemas.py              # Pydantic 模式
│   ├── crud.py                 # 数据库操作
│   ├── self_check.py           # 自检功能
│   ├── workflow.py             # 工作流处理
│   ├── export.py               # 导出功能
│   ├── balance.py              # 余额变化表
│   └── utils.py                # 工具函数
├── templates/
│   └── index.html              # 前端页面
├── static/
│   └── style.css               # 样式文件
├── samples/
│   ├── sample_batch_1.xlsx     # 样例清算批次号数据
│   └── sample_holiday.xlsx     # 样例节假日顺延说明
├── tests/
│   ├── __init__.py
│   └── test_full_flow.py       # 完整流程测试
├── README.md                   # 使用说明
├── requirements.txt            # 依赖
└── run.py                      # 启动脚本
```
