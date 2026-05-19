# 印刷车间品控数据管理系统

用于管理印刷车间的Lab测色数据、订单信息、返工记录和质检报告的后端系统。

## 功能特性

- 📊 **测色数据管理**: 支持CSV批量导入Lab数据，自动计算ΔE和判定结果
- 📋 **订单管理**: JSON格式导入订单，包含目标Lab值和公差设置
- 🔄 **返工记录**: 记录返工原因和处理情况
- ✅ **质检判定**: 自动根据公差判定测色数据是否合格
- 📝 **质检报告**: 一键生成质检报告，支持复核流程
- 📈 **趋势分析**: 按纸张批次和时间分析品质趋势
- ❌ **错误处理**: 导入坏数据时记录原始位置、错误原因和修改建议
- 🔒 **数据脱敏**: 敏感字段在API返回和导出时自动脱敏
- 👤 **权限控制**: 基于用户角色的访问控制

## 技术栈

- **后端框架**: FastAPI
- **数据库**: SQLite (可扩展为PostgreSQL/MySQL)
- **ORM**: SQLAlchemy
- **数据处理**: Pandas
- **认证**: JWT (OAuth2)

## 快速开始

### 1. 环境准备

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
# 创建表和初始用户
python scripts/init_db.py
```

这将创建两个默认用户：
- 管理员: `admin` / `admin123`
- 品控员: `qc_operator` / `qc123456`

### 3. 启动服务

```bash
uvicorn app.main:app --reload
```

服务将在 `http://localhost:8000` 启动

- API文档: `http://localhost:8000/docs`
- ReDoc文档: `http://localhost:8000/redoc`

## 使用流程

### 步骤1: 导入订单数据

```bash
# 使用示例数据
curl -X POST "http://localhost:8000/api/v1/import/order-json" \
  -H "Authorization: Bearer <你的token>" \
  -F "file=@sample_data/orders.json"
```

或使用API文档页面的 `/api/v1/import/order-json` 接口上传。

**订单JSON格式**:
```json
{
  "order_no": "PO-2024-001",
  "product_name": "产品名称",
  "customer": "客户名称",
  "paper_batch": "纸张批次号",
  "paper_type": "纸张类型",
  "quantity": 5000,
  "target_l": 95.0,
  "target_a": -1.5,
  "target_b": 5.2,
  "tolerance_l": 2.0,
  "tolerance_a": 2.0,
  "tolerance_b": 2.0,
  "operator": "操作员",
  "remarks": "备注"
}
```

### 步骤2: 导入测色数据

```bash
curl -X POST "http://localhost:8000/api/v1/import/color-csv" \
  -H "Authorization: Bearer <你的token>" \
  -F "file=@sample_data/color_measurements.csv"
```

**测色CSV格式**:
```csv
order_no,measurement_no,measure_point,l_value,a_value,b_value,paper_batch,operator,equipment
PO-2024-001,M001,左上角,94.8,-1.6,5.1,PAPER-2024-001,张工,测色仪-A
```

### 步骤3: 导入返工记录（可选）

```bash
curl -X POST "http://localhost:8000/api/v1/import/rework-notes" \
  -H "Authorization: Bearer <你的token>" \
  -F "file=@sample_data/rework_notes.csv"
```

### 步骤4: 查看导入错误

如果导入的数据有问题，系统会记录错误详情：

```bash
curl -X GET "http://localhost:8000/api/v1/import/errors" \
  -H "Authorization: Bearer <你的token>"
```

错误记录包含：
- 文件名和行号
- 原始数据
- 错误类型和原因
- 修改建议

### 步骤5: 评估订单质检结果

```bash
# 先获取订单ID
curl -X GET "http://localhost:8000/api/v1/orders/" \
  -H "Authorization: Bearer <你的token>"

# 评估质检
curl -X POST "http://localhost:8000/api/v1/orders/<订单ID>/evaluate" \
  -H "Authorization: Bearer <你的token>"
```

### 步骤6: 生成质检报告

```bash
curl -X POST "http://localhost:8000/api/v1/qc-reports/generate/PO-2024-001" \
  -H "Authorization: Bearer <你的token>"
```

报告包含：
- 总测色次数
- 合格/不合格数量
- 合格率
- 平均/最大/最小ΔE值
- 返工次数
- 自动判定结论

### 步骤7: 复核质检报告

```bash
curl -X POST "http://localhost:8000/api/v1/qc-reports/<报告ID>/review" \
  -H "Authorization: Bearer <你的token>" \
  -H "Content-Type: application/json" \
  -d '{
    "qc_report_id": <报告ID>,
    "review_action": "复核通过",
    "review_notes": "数据复核无误",
    "after_status": "pass"
  }'
```

复核状态可选: `pending`, `pass`, `fail`, `reviewing`, `final_pass`

### 步骤8: 导出质检报告

```bash
curl -X GET "http://localhost:8000/api/v1/qc-reports/<报告ID>/export" \
  -H "Authorization: Bearer <你的token>"
```

导出数据中敏感字段（如操作员、客户名称）会自动脱敏。

如需包含敏感数据：
```bash
curl -X GET "http://localhost:8000/api/v1/qc-reports/<报告ID>/export?include_sensitive=true" \
  -H "Authorization: Bearer <你的token>"
```

### 步骤9: 趋势分析

```bash
# 总体趋势
curl -X GET "http://localhost:8000/api/v1/trend/daily" \
  -H "Authorization: Bearer <你的token>"

# 按纸张批次
curl -X GET "http://localhost:8000/api/v1/trend/daily?paper_batch=PAPER-2024-001" \
  -H "Authorization: Bearer <你的token>"

# 对比各纸张批次
curl -X GET "http://localhost:8000/api/v1/trend/compare-paper-batches" \
  -H "Authorization: Bearer <你的token>"
```

## 自动化示例脚本

```bash
# 确保服务已启动
python scripts/example_usage.py
```

该脚本会自动执行完整的演示流程：
1. 导入订单数据
2. 导入测色数据（正常数据 + 带错误数据）
3. 查看导入错误
4. 导入返工记录
5. 评估质检
6. 生成报告
7. 复核报告
8. 导出报告
9. 趋势分析

## 示例数据说明

`sample_data/` 目录包含:

| 文件 | 说明 |
|------|------|
| `orders.json` | 3个正常订单数据 |
| `color_measurements.csv` | 10条正常测色数据 |
| `color_measurements_with_errors.csv` | 含错误的测色数据，演示错误处理 |
| `rework_notes.csv` | 3条返工记录数据 |

## 主要API接口

### 认证
- `POST /api/v1/token` - 获取访问令牌
- `POST /api/v1/users/` - 创建用户

### 导入
- `POST /api/v1/import/order-json` - 导入订单
- `POST /api/v1/import/color-csv` - 导入测色数据
- `POST /api/v1/import/rework-notes` - 导入返工记录
- `GET /api/v1/import/errors` - 获取导入错误
- `POST /api/v1/import/errors/{id}/resolve` - 标记错误已解决

### 数据查询
- `GET /api/v1/orders/` - 订单列表
- `GET /api/v1/orders/{order_no}` - 订单详情
- `GET /api/v1/measurements/` - 测色数据列表
- `GET /api/v1/reworks/` - 返工记录列表

### 质检流程
- `POST /api/v1/orders/{id}/evaluate` - 评估订单质检
- `POST /api/v1/qc-reports/generate/{order_no}` - 生成质检报告
- `GET /api/v1/qc-reports/` - 质检报告列表
- `POST /api/v1/qc-reports/{id}/review` - 复核报告
- `GET /api/v1/qc-reports/{id}/export` - 导出报告

### 趋势分析
- `GET /api/v1/trend/daily` - 日趋势分析
- `GET /api/v1/trend/compare-paper-batches` - 纸张批次对比

## 数据模型

### QC状态枚举
- `pending` - 待处理
- `pass` - 合格
- `fail` - 不合格
- `rework` - 返工
- `reviewing` - 复核中
- `final_pass` - 最终通过

### 用户角色
- `admin` - 管理员
- `qc_operator` - 品控操作员
- `workshop` - 车间人员
- `viewer` - 只读用户

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # 应用入口
│   ├── core/                # 核心模块
│   │   ├── config.py        # 配置管理
│   │   ├── database.py      # 数据库连接
│   │   └── security.py      # 安全工具和脱敏
│   ├── models/              # 数据模型
│   │   └── models.py        # ORM模型定义
│   ├── schemas/             # Pydantic模式
│   │   └── schemas.py       # 请求/响应模式
│   ├── repositories/        # 数据访问层
│   │   └── repositories.py  # Repository类
│   ├── services/            # 业务逻辑层
│   │   └── services.py      # 服务类
│   └── api/                 # API路由
│       └── routes.py        # 路由定义
├── sample_data/             # 示例数据
├── scripts/                 # 脚本工具
│   ├── init_db.py           # 数据库初始化
│   └── example_usage.py     # 使用示例
├── requirements.txt         # 依赖列表
└── README.md                # 本文档
```

## 数据安全

系统自动处理敏感数据：

1. **API返回脱敏**: 操作员、客户等敏感字段在API返回时遮罩
2. **导出脱敏**: 导出报告时默认脱敏，需明确指定 `include_sensitive=true`
3. **日志脱敏**: 日志记录时自动隐藏敏感信息

默认脱敏规则：保留首尾各2字符，中间用 `***` 替换。例如：`张工` → `张***工`

可在 `app/core/config.py` 中配置脱敏规则。

## 部署说明

### 生产环境配置

1. 复制环境变量配置：
```bash
cp .env.example .env
```

2. 修改配置：
```env
DATABASE_URL=sqlite:///./qc_production.db
SECRET_KEY=your-strong-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

3. 使用生产级WSGI服务器：
```bash
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### 数据库迁移

如需使用PostgreSQL/MySQL，修改 `DATABASE_URL` 后重新运行初始化脚本即可。

## 常见问题

**Q: 导入CSV时出现 "缺少必要的列" 错误？**
> A: 确保CSV包含必需的列。测色数据需要 `order_no`, `l_value`, `a_value`, `b_value` 列。

**Q: 为什么导入后 `is_pass` 字段为null？**
> A: 只有当订单已设置目标Lab值和公差时，系统才会自动判定。请确保订单数据完整。

**Q: 如何修改默认公差？**
> A: 在导入订单JSON时设置 `tolerance_l`, `tolerance_a`, `tolerance_b` 字段，默认为2.0。

**Q: 忘记管理员密码怎么办？**
> A: 删除数据库文件，重新运行 `python scripts/init_db.py` 重置。

## 许可证

内部使用
