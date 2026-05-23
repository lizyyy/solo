# 二手设备质检 API

本地后端 API 服务，提供二手设备质检流程管理。

## 技术栈

- **FastAPI** - 高性能 Web 框架
- **SQLAlchemy** - ORM 数据库操作
- **SQLite** - 本地持久化存储

## 核心功能

### 数据模型

1. **设备** - 序列号、品牌、型号、存储、颜色、状态
2. **检测项** - 屏幕评分、电池评分、外观评分、功能评分、总分
3. **报价版本** - 初始价格、最终价格、冻结状态、版本号
4. **复核记录** - 复核人、状态、意见
5. **扣减原因** - 扣减类型（屏幕/电池/序列号/外观/功能/其他）、描述、金额
6. **质检报告** - 报告编号、完整内容
7. **状态历史** - 记录所有状态变更轨迹
8. **异常日志** - 记录异常请求的原始输入和处理结论

### 核心规则

1. **检测项评分** - 加权平均计算总分
   - 屏幕: 30%
   - 电池: 25%
   - 外观: 20%
   - 功能: 25%

2. **报价冻结** - 报价确认后冻结，防止修改

3. **复核状态机**
   - 待检测 → 检测中 → 已检测 → 已报价 → 复核中 → 已通过/已拒绝/需修正 → 已结算

4. **重复入库拦截** - 相同序列号禁止重复创建

5. **异常路径处理** - 所有错误请求都保存原始输入

## API 接口

### 设备管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/devices/ | 创建设备 |
| GET | /api/devices/{serial} | 查询设备详情 |
| GET | /api/devices/ | 设备列表 |
| POST | /api/devices/transition | 状态推进 |
| POST | /api/devices/correct | 人工修正 |

### 检测管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/inspections/ | 提交检测 |
| GET | /api/inspections/ | 检测记录列表 |

### 报价管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/quotes/ | 创建报价 |
| POST | /api/quotes/{id}/freeze | 冻结报价 |
| GET | /api/quotes/ | 报价列表 |

### 复核管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reviews/ | 创建复核 |
| PUT | /api/reviews/{id} | 更新复核状态 |
| GET | /api/reviews/ | 复核列表 |

### 报告管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reports/generate | 生成质检报告 |
| GET | /api/reports/{id}/export | 导出报告 |
| GET | /api/reports/ | 报告列表 |
| GET | /api/reports/exceptions/ | 异常日志列表 |
| PUT | /api/reports/exceptions/{id}/resolve | 处理异常 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行测试脚本

```bash
python test_api.py
```

测试脚本覆盖 4 个场景:
1. **正常流程** - 设备创建 → 检测 → 报价 → 复核 → 报告
2. **重复提交** - 验证重复入库拦截
3. **异常拦截** - 验证异常路径记录
4. **人工修正** - 验证特殊情况人工干预

## 验收指南

### 正常创建

1. POST /api/devices/ 创建设备
2. POST /api/inspections/ 提交检测（含扣分项）
3. POST /api/quotes/ 创建报价
4. POST /api/quotes/{id}/freeze 冻结报价
5. POST /api/reviews/ 创建复核
6. PUT /api/reviews/{id} 通过复核
7. POST /api/reports/generate 生成报告
8. GET /api/devices/{serial} 查看完整状态历史

### 重复提交

- 使用相同序列号再次调用 POST /api/devices/
- 应返回 400 错误，提示"已存在"
- GET /api/reports/exceptions/ 可查看异常记录

### 异常拦截

- 给不存在的设备提交检测/报价
- 应返回 400 错误
- 所有异常请求都保存在异常日志中

### 人工修正

- POST /api/devices/correct 修正状态
- 状态历史中保留人工修正记录和原因

## 项目结构

```
.
├── main.py              # 主入口
├── database.py          # 数据库配置
├── models.py            # 数据模型
├── schemas.py           # Pydantic 模式
├── services.py          # 业务逻辑
├── routers/             # API 路由
│   ├── __init__.py
│   ├── device.py        # 设备管理
│   ├── inspection.py    # 检测管理
│   ├── quote.py         # 报价管理
│   ├── review.py        # 复核管理
│   └── report.py        # 报告管理
├── requirements.txt     # 依赖
├── test_api.py          # 测试脚本
└── inspection.db        # SQLite 数据库（自动生成）
```
