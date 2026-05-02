# 匿名指标保险箱 - 本地差分隐私发布服务

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](./LICENSE)

## 📋 项目简介

**匿名指标保险箱** 是一个为数据合规团队设计的本地差分隐私（Local Differential Privacy）发布服务。当团队需要将活动报名CSV数据共享给合作方时，只能开放年龄段、城市、渠道、转化率这类聚合指标，同时需要防止小样本人群被反推识别。

本服务通过差分隐私技术，在聚合统计结果中添加受控噪声，并对低样本量分组进行自动抑制，从而保护个人隐私的同时提供有价值的统计洞察。

## 🔑 核心功能

### 1. 数据集管理
- 创建数据集并配置字段类型（维度/指标/敏感字段）
- 导入CSV数据文件
- 自动分析字段特征和数据分布

### 2. 差分隐私查询
- **拉普拉斯机制**：向计数、求和、平均值等聚合结果添加受控噪声
- **样本抑制**：自动抑制低于阈值的小样本分组，防止重识别攻击
- **多维度分组**：支持按多个维度字段进行分组聚合
- **灵活筛选**：支持多种筛选条件（等于、不等于、大于、小于、包含等）

### 3. 隐私预算管理
- **预算账本**：跟踪每个数据集的总预算和剩余预算
- **预算消耗**：每次查询消耗相应的epsilon预算
- **预算重置**：管理员可重置或调整预算
- **交易记录**：完整记录所有预算变动

### 4. 查询审计
- **完整审计日志**：记录每次查询的参数、消耗预算、状态
- **审计统计**：按查询类型、状态等维度的统计分析
- **结果哈希**：对查询结果生成SHA256哈希，便于验证

### 5. 结果缓存
- **缓存机制**：相同查询自动命中缓存，避免重复消耗预算
- **缓存失效**：支持手动使指定查询或数据集的缓存失效
- **TTL管理**：缓存自动过期机制
- **缓存统计**：缓存命中率、节省预算等统计

### 6. 报告导出
- **Markdown格式**：生成结构化的审计报告，适合文档存档
- **CSV格式**：生成表格格式报告，适合数据分析
- **可下载**：支持直接下载报告文件
- **在线预览**：支持在线预览报告内容

## 🛠️ 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| Web框架 | FastAPI 0.104.1 | 高性能异步API框架 |
| ORM | SQLAlchemy 2.0.23 | 数据库对象关系映射 |
| 数据验证 | Pydantic 2.5.2 | 数据模型和验证 |
| 数据处理 | Pandas 2.1.3 | CSV解析和数据聚合 |
| 数值计算 | NumPy 1.26.2 | 噪声生成和数学计算 |
| 数据库 | SQLite | 轻量级本地数据库 |
| 测试 | Pytest 7.4.3 | 单元测试和集成测试 |

## 📦 安装步骤

### 1. 环境准备

确保你的系统已安装 Python 3.9 或更高版本：

```bash
python --version
```

### 2. 克隆项目

```bash
cd /path/to/project
```

### 3. 创建虚拟环境（推荐）

```bash
python -m venv venv

# macOS/Linux
source venv/bin/activate

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1
```

### 4. 安装依赖

```bash
pip install -r requirements.txt
```

### 5. 验证安装

```bash
python -c "from app.main import app; print('安装成功！')"
```

## 🚀 快速开始

### 1. 启动服务

```bash
# 开发模式（带热重载）
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 或直接运行
python app/main.py
```

服务启动后，访问以下地址：

- **API文档（Swagger UI）**: http://localhost:8000/docs
- **API文档（ReDoc）**: http://localhost:8000/redoc
- **健康检查**: http://localhost:8000/health

### 2. 使用示例数据验证全流程

我们提供了示例数据文件 `data/sample_campaign_registrations.csv`，包含50条模拟的活动报名数据，字段如下：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | sensitive | 用户ID（敏感字段） |
| age_group | dimension | 年龄段（18-24, 25-34, 35-44, 45+） |
| city | dimension | 城市（北京、上海、广州、深圳、杭州、成都） |
| channel | dimension | 渠道（微信小程序、抖音） |
| conversion | metric | 是否转化（1=转化，0=未转化） |
| registered_at | dimension | 注册时间 |
| gender | dimension | 性别 |

#### 步骤1：创建数据集

```bash
curl -X POST "http://localhost:8000/api/v1/datasets/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024春季活动报名数据",
    "description": "用于与合作方共享的活动报名统计数据",
    "fields": [
      {"name": "id", "field_type": "sensitive", "description": "用户唯一标识"},
      {"name": "age_group", "field_type": "dimension", "description": "年龄段分组"},
      {"name": "city", "field_type": "dimension", "description": "城市"},
      {"name": "channel", "field_type": "dimension", "description": "报名渠道"},
      {"name": "conversion", "field_type": "metric", "description": "是否转化（1=是，0=否）"}
    ],
    "total_epsilon": 10.0,
    "delta": 1e-5,
    "suppression_threshold": 5
  }'
```

**参数说明**：
- `total_epsilon`: 总隐私预算，建议设置为1.0-10.0。epsilon越小，隐私保护越强，但噪声越大。
- `suppression_threshold`: 样本抑制阈值，默认5。分组样本数低于此值将被自动抑制。

#### 步骤2：导入CSV数据

```bash
curl -X POST "http://localhost:8000/api/v1/datasets/1/import" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/sample_campaign_registrations.csv;type=text/csv"
```

> 注意：如果创建的数据集ID不是1，请将URL中的 `1` 替换为实际的数据集ID。

#### 步骤3：查看预算状态

```bash
curl "http://localhost:8000/api/v1/datasets/1/budget/summary"
```

你应该看到类似这样的响应：

```json
{
  "dataset_id": 1,
  "exists": true,
  "total_epsilon": 10.0,
  "remaining_epsilon": 10.0,
  "consumed_epsilon": 0.0,
  "refunded_epsilon": 0.0,
  "delta": 1e-5,
  "suppression_threshold": 5,
  "usage_percentage": 0.0,
  "transaction_count": 0
}
```

#### 步骤4：执行差分隐私查询

**查询示例1：按年龄段统计报名人数和转化数**

```bash
curl -X POST "http://localhost:8000/api/v1/datasets/1/queries/" \
  -H "Content-Type: application/json" \
  -d '{
    "group_by": ["age_group"],
    "aggregations": [
      {"type": "count", "name": "total_registrations"},
      {"type": "sum", "metric": "conversion", "name": "conversion_count"},
      {"type": "avg", "metric": "conversion", "name": "conversion_rate"}
    ],
    "epsilon": 1.0,
    "use_cache": true
  }'
```

**响应说明**：

```json
{
  "dataset_id": 1,
  "query_hash": "abc123...",
  "epsilon_used": 1.0,
  "from_cache": false,
  "results": [
    {
      "group": {"age_group": "18-24"},
      "aggregations": {
        "total_registrations": 15,
        "conversion_count": 10,
        "conversion_rate": 0.67
      },
      "suppressed": false,
      "noise_scale": 1.0
    },
    {
      "group": {"age_group": "45+"},
      "aggregations": {
        "total_registrations": null,
        "conversion_count": null,
        "conversion_rate": null
      },
      "suppressed": true,
      "noise_scale": null
    }
  ],
  "suppressed_count": 1,
  "total_groups": 4
}
```

**关键信息**：
- `epsilon_used`: 本次查询消耗的隐私预算
- `suppressed`: 该分组是否因样本量不足被抑制
- `suppressed_count`: 被抑制的分组数量

**查询示例2：按城市和渠道分组（带筛选条件）**

```bash
curl -X POST "http://localhost:8000/api/v1/datasets/1/queries/" \
  -H "Content-Type: application/json" \
  -d '{
    "group_by": ["city", "channel"],
    "aggregations": [
      {"type": "count", "name": "total"},
      {"type": "avg", "metric": "conversion", "name": "conversion_rate"}
    ],
    "filters": {
      "age_group": {"in": ["18-24", "25-34"]}
    },
    "epsilon": 1.5,
    "use_cache": true
  }'
```

**查询示例3：执行相同查询（命中缓存）**

再次执行与示例1相同的查询：

```bash
curl -X POST "http://localhost:8000/api/v1/datasets/1/queries/" \
  -H "Content-Type: application/json" \
  -d '{
    "group_by": ["age_group"],
    "aggregations": [
      {"type": "count", "name": "total_registrations"},
      {"type": "sum", "metric": "conversion", "name": "conversion_count"},
      {"type": "avg", "metric": "conversion", "name": "conversion_rate"}
    ],
    "epsilon": 1.0,
    "use_cache": true
  }'
```

注意响应中的 `from_cache: true` 和 `epsilon_used: 0` - 缓存命中不消耗预算！

#### 步骤5：查看更新后的预算

```bash
curl "http://localhost:8000/api/v1/datasets/1/budget/summary"
```

现在你应该看到预算已被消耗，`usage_percentage` 大于0。

#### 步骤6：查看审计日志

```bash
curl "http://localhost:8000/api/v1/datasets/1/audit/logs"
```

#### 步骤7：导出审计报告

**导出Markdown格式报告**：

```bash
# 在线预览
curl "http://localhost:8000/api/v1/datasets/1/reports/preview/markdown"

# 下载文件
curl -O "http://localhost:8000/api/v1/datasets/1/reports/download/markdown"
```

**导出CSV格式报告**：

```bash
curl -O "http://localhost:8000/api/v1/datasets/1/reports/download/csv"
```

#### 步骤8：查看审计统计

```bash
curl "http://localhost:8000/api/v1/datasets/1/audit/statistics"
```

### 3. 使用API文档界面

除了使用curl，你还可以通过浏览器访问 http://localhost:8000/docs 来交互式测试所有API接口。

## 📚 差分隐私说明

### 什么是差分隐私？

差分隐私（Differential Privacy）是一种严格的隐私保护框架，其核心思想是：**通过添加受控噪声，使得单个记录的存在与否不会显著影响查询结果**。

形式化定义：一个随机算法 M 满足 (ε, δ)-差分隐私，当且仅当对于任意两个相邻数据集 D 和 D'（仅相差一条记录），以及任意输出集合 S：

```
Pr[M(D) ∈ S] ≤ e^ε × Pr[M(D') ∈ S] + δ
```

### 本服务实现的机制

#### 1. 拉普拉斯机制（Laplace Mechanism）

对于数值型查询结果，我们添加服从拉普拉斯分布的噪声：

```python
noise = np.random.laplace(loc=0.0, scale=sensitivity/epsilon)
noisy_value = true_value + noise
```

**参数说明**：
- `sensitivity`（敏感度）：单个记录变化对结果的最大影响
  - 计数查询：sensitivity = 1
  - 求和查询：sensitivity = max(abs(upper_bound), abs(lower_bound))
- `epsilon`（隐私预算）：控制噪声量。ε越小，噪声越大，隐私保护越强

#### 2. 样本抑制（Suppression）

对于分组计数低于阈值的分组，我们完全抑制其结果：

```python
if group_count < suppression_threshold:
    result = None  # 抑制
    suppressed = True
```

**为什么需要抑制？**

即使添加了噪声，极小的分组仍然可能被重识别。例如：
- 如果某个分组只有1条记录，即使添加噪声，攻击者仍可能推断出该记录的存在
- 结合其他背景知识，攻击者可能识别出具体个人

**建议的阈值**：

| 场景 | 建议阈值 |
|------|----------|
| 高隐私要求 | 10-15 |
| 中等隐私要求 | 5-10 |
| 低隐私要求 | 3-5 |

### Epsilon 选择指南

| Epsilon值 | 隐私保护强度 | 数据效用 | 适用场景 |
|-----------|-------------|----------|----------|
| 0.1 - 0.5 | 非常强 | 较低 | 高度敏感数据 |
| 0.5 - 1.0 | 强 | 中等 | 一般敏感数据 |
| 1.0 - 5.0 | 中等 | 较高 | 内部分析使用 |
| 5.0 - 10.0 | 较弱 | 高 | 公开数据发布 |

## 🧪 运行测试

### 运行所有测试

```bash
pytest tests/ -v
```

### 运行特定测试

```bash
# 运行完整流程测试
pytest tests/test_full_flow.py::TestFullFlow -v

# 运行差分隐私查询测试
pytest tests/test_full_flow.py::TestPrivacyQuery -v
```

### 测试覆盖率报告

```bash
pytest tests/ --cov=app --cov-report=html
```

## 📁 项目结构

```
xy4087/
├── app/                          # 应用主目录
│   ├── __init__.py
│   ├── main.py                   # FastAPI应用入口
│   ├── config.py                 # 配置管理
│   ├── database.py               # 数据库连接和初始化
│   ├── models.py                 # SQLAlchemy数据模型
│   ├── schemas.py                # Pydantic请求/响应模型
│   ├── routers/                  # API路由
│   │   ├── __init__.py
│   │   ├── datasets.py           # 数据集管理路由
│   │   ├── queries.py            # 差分隐私查询路由
│   │   ├── budget.py             # 预算管理路由
│   │   ├── audit.py              # 审计日志路由
│   │   └── reports.py            # 报告生成路由
│   └── services/                 # 业务逻辑服务
│       ├── __init__.py
│       ├── csv_parser.py         # CSV解析和数据导入
│       ├── privacy_engine.py     # 差分隐私引擎（核心算法）
│       ├── budget_manager.py     # 预算账本管理
│       ├── audit_service.py      # 审计日志服务
│       ├── cache_manager.py      # 缓存管理服务
│       └── report_generator.py   # 报告生成服务
├── data/                         # 示例数据
│   └── sample_campaign_registrations.csv
├── tests/                        # 测试用例
│   ├── __init__.py
│   └── test_full_flow.py         # 完整流程测试
├── requirements.txt              # Python依赖
├── README.md                     # 本文档
└── dp_vault.db                   # SQLite数据库（运行后生成）
```

## ⚙️ 配置说明

### 环境变量

你可以通过设置环境变量来覆盖默认配置：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `DATABASE_URL` | `sqlite:///./dp_vault.db` | 数据库连接字符串 |
| `DEFAULT_EPSILON` | `1.0` | 默认隐私预算 |
| `MIN_EPSILON` | `0.1` | 最小允许的epsilon |
| `MAX_EPSILON` | `10.0` | 最大允许的epsilon |
| `SUPPRESSION_THRESHOLD` | `5` | 默认样本抑制阈值 |
| `CACHE_TTL_SECONDS` | `3600` | 缓存有效期（秒） |
| `MAX_CACHE_SIZE` | `100` | 最大缓存条目数 |
| `UPLOAD_DIR` | `./uploads` | 上传文件存储目录 |

### 配置示例

```bash
# 使用PostgreSQL数据库
export DATABASE_URL="postgresql://user:pass@localhost/dp_vault"

# 调整隐私参数
export DEFAULT_EPSILON=2.0
export SUPPRESSION_THRESHOLD=10
```

## 🔒 安全最佳实践

### 1. 生产环境部署

- **不要使用默认配置**：根据实际安全需求调整epsilon和抑制阈值
- **启用HTTPS**：生产环境必须使用HTTPS加密传输
- **限制CORS**：不要使用 `allow_origins=["*"]`，指定具体的允许域名
- **数据库加密**：敏感数据应加密存储

### 2. 数据安全

- **最小字段原则**：只导入必要的字段，敏感字段标记为 `sensitive` 类型
- **数据脱敏**：导入前对身份证、手机号等直接标识符进行脱敏
- **访问控制**：对API接口进行身份认证和权限控制

### 3. 预算管理

- **合理分配预算**：根据数据敏感度和使用场景分配总预算
- **监控预算消耗**：定期检查审计日志，异常消耗及时告警
- **定期重置**：根据数据生命周期定期重置或补充预算

## 📋 API 参考

### 数据集管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/datasets/` | 获取数据集列表 |
| GET | `/api/v1/datasets/{id}` | 获取数据集详情 |
| POST | `/api/v1/datasets/` | 创建数据集 |
| DELETE | `/api/v1/datasets/{id}` | 删除数据集 |
| POST | `/api/v1/datasets/{id}/import` | 导入CSV数据 |

### 差分隐私查询

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/datasets/{id}/queries/` | 执行差分隐私查询 |
| POST | `/api/v1/datasets/{id}/queries/{hash}/invalidate` | 使指定缓存失效 |
| GET | `/api/v1/datasets/{id}/queries/cache/stats` | 获取缓存统计 |

### 预算管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/datasets/{id}/budget/` | 获取预算账本 |
| GET | `/api/v1/datasets/{id}/budget/summary` | 获取预算摘要 |
| GET | `/api/v1/datasets/{id}/budget/transactions` | 获取预算交易记录 |
| POST | `/api/v1/datasets/{id}/budget/reset` | 重置预算 |

### 审计日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/datasets/{id}/audit/logs` | 获取审计日志列表 |
| GET | `/api/v1/datasets/{id}/audit/logs/{log_id}` | 获取日志详情 |
| GET | `/api/v1/datasets/{id}/audit/statistics` | 获取审计统计 |

### 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/datasets/{id}/reports/generate` | 生成报告 |
| GET | `/api/v1/datasets/{id}/reports/download/markdown` | 下载Markdown报告 |
| GET | `/api/v1/datasets/{id}/reports/download/csv` | 下载CSV报告 |
| GET | `/api/v1/datasets/{id}/reports/preview/markdown` | 预览Markdown报告 |

## ❓ 常见问题

### Q1: 如何选择合适的epsilon值？

**答**：这是一个隐私-效用权衡问题。建议：
- 从epsilon=1.0开始测试
- 评估噪声对结果效用的影响
- 根据业务可接受的误差范围调整
- 高隐私要求场景使用更小的epsilon

### Q2: 为什么有些分组返回null？

**答**：这是样本抑制机制在起作用。当分组的样本数量低于 `suppression_threshold` 时，该分组的结果会被完全抑制（返回null），以防止小样本被重识别。

### Q3: 缓存命中为什么不消耗预算？

**答**：差分隐私的预算消耗是基于"信息泄露"的。当从缓存返回结果时，没有进行新的噪声计算，也没有从原始数据中提取新的信息，因此不需要消耗预算。

### Q4: 如何重置或补充预算？

**答**：使用预算重置接口：

```bash
# 重置为原始总预算
curl -X POST "http://localhost:8000/api/v1/datasets/1/budget/reset"

# 重置为新的总预算
curl -X POST "http://localhost:8000/api/v1/datasets/1/budget/reset?new_total_epsilon=15.0"
```

### Q5: 支持哪些聚合操作？

**答**：目前支持以下聚合类型：

| 聚合类型 | 说明 | 敏感度 |
|----------|------|--------|
| `count` | 计数 | 1 |
| `sum` | 求和 | 数据范围 |
| `avg` | 平均值 | 分两次计算：sum + count |

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系

如有问题或建议，请通过以下方式联系：

- 提交 GitHub Issue
- 发送邮件至维护者

---

**免责声明**：本服务提供差分隐私技术的参考实现，实际部署前请进行充分的安全评估和隐私影响分析。差分隐私不能保证绝对的隐私保护，应根据具体场景和合规要求合理配置参数。
