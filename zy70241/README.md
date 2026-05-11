# 净水站滤芯寿命预测器

基于水量、水质和投诉记录的智能滤芯寿命预测系统。

## 项目特点

- **业务闭环完整**：水量记录 → 水质指标 → 滤芯寿命 → 投诉关联 → 预测解释 → 更换报告
- **数据应用全面**：导入 → 清洗 → 结果列表 → 人工复核 → 导出
- **模型可解释**：每个预测都包含详细的因素分析和解释说明
- **关键判断可见**：在测试、接口响应、页面和命令输出中都能看到关键判断

## 项目结构

```
├── app/                    # 应用代码
│   ├── __init__.py
│   ├── main.py            # FastAPI 主应用
│   ├── database.py        # 数据库配置
│   ├── models.py          # SQLAlchemy 模型
│   ├── schemas.py         # Pydantic 数据模型
│   ├── predictor.py       # 滤芯寿命预测器（核心算法）
│   ├── data_processor.py  # 数据导入和清洗模块
│   └── api/               # API 路由
│       ├── __init__.py
│       ├── filter.py      # 滤芯管理 API
│       ├── water_quality.py  # 水质指标 API
│       ├── water_volume.py   # 水量记录 API
│       ├── complaints.py     # 投诉管理 API
│       ├── predictions.py    # 寿命预测 API
│       └── replacement.py    # 更换报告 API
├── templates/             # 前端模板
│   └── index.html        # 主页面
├── static/               # 静态文件
├── sample_data/          # 样例数据
│   ├── filters.csv
│   ├── water_quality.csv
│   ├── water_volume.csv
│   └── complaints.csv
├── tests/                # 测试文件
│   ├── __init__.py
│   └── test_predictor.py
├── init_data.py          # 数据初始化脚本
├── requirements.txt      # Python 依赖
└── README.md            # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python init_data.py
```

这个脚本会：
- 导入 5 个滤芯数据
- 导入 16 条水质记录
- 导入 17 条水量记录
- 导入 4 条投诉记录
- 运行寿命预测并显示关键判断

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问系统

- **Web 界面**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/health

## 主流程演示

### 流程 1: 完整业务闭环

1. **数据导入**
   - 访问「数据导入」页面
   - 选择数据类型（水质/水量/投诉）
   - 上传 CSV 或 Excel 文件
   - 系统自动清洗并显示导入结果

2. **寿命预测**
   - 访问「仪表盘」
   - 点击「批量预测所有滤芯」
   - 查看风险分布和高优先级滤芯

3. **预测解释**
   - 访问「预测结果」
   - 点击「详情」查看预测详情
   - 可以看到：健康评分、风险等级、剩余天数、解释说明

4. **人工复核**
   - 在预测结果列表中
   - 点击「通过」或「拒绝」
   - 输入复核意见

5. **更换报告**
   - 访问「更换报告」
   - 创建更换报告，关联预测记录
   - 旧滤芯状态更新为已更换

### 流程 2: 投诉关联分析

1. **记录投诉**
   - 访问「投诉管理」
   - 记录用户投诉（类型、严重程度、描述）
   - 关联到特定滤芯

2. **影响预测**
   - 投诉会自动影响滤芯的健康评分
   - 严重程度越高，扣分越多
   - 未解决的投诉权重更高

3. **查看关联**
   - 在预测详情中可以看到投诉因素
   - 解释说明会包含投诉数量信息

## 关键判断验证

### 1. 测试输出验证

```bash
pytest tests/test_predictor.py -v
```

测试覆盖：
- ✅ 新滤芯预测：健康分 > 80，风险等级 normal/low
- ✅ 旧滤芯预测：健康分 < 60，剩余天数 < 10
- ✅ 高用水量：用量百分比 > 90%
- ✅ 水质差：质量评分 < 0.5
- ✅ 投诉影响：投诉数量显示在解释中
- ✅ 风险等级：critical 级别触发「立即更换」建议

### 2. 接口响应验证

查看预测 API 响应：

```bash
curl -X POST "http://localhost:8000/api/predictions/predict/FILTER-001"
```

响应包含：
```json
{
  "prediction": {
    "health_score": 35.5,
    "risk_level": "high",
    "recommendation": "建议本周内更换滤芯",
    "explanation": "滤芯 FILTER-001 已使用 165 天... 过去90天收到 2 起投诉...",
    "confidence": 0.85
  },
  "factors": {
    "age": {"usage_percentage": 183.33},
    "volume": {"usage_percentage": 94.74},
    "quality": {"score": 0.35},
    "complaints": {"factors": {"count": 2, "open_count": 2}}
  }
}
```

### 3. 页面验证

访问 Web 界面可以看到：
- 仪表盘显示风险分布统计
- 高优先级滤芯列表（critical/high）
- 每个预测的健康评分进度条
- 投诉关联数量提示

### 4. 命令输出验证

运行初始化脚本时的输出：

```
关键判断验证:
----------------------------------------

⚠️ 发现 2 个高风险滤芯需要关注:

  滤芯ID: FILTER-001
  净水站: 阳光社区净水站
  风险等级: CRITICAL
  健康评分: 28.5/100
  剩余寿命: 3 天
  建议: 立即更换滤芯，存在严重安全隐患
  ⚠️ 关联投诉: 2 条未解决
     - 水质异味: 水中有明显的氯气味...
     - 水质浑浊: 出水浑浊，有可见悬浮物...
```

## 异常操作演示

### 异常 1: 导入无效数据

**操作**: 导入包含无效 pH 值（如 15.0）的水质数据

**预期行为**:
- 系统检测到 pH 值超出范围（0-14）
- 返回错误信息："pH值有 X 条无效记录"
- 无效记录被标记或排除

### 异常 2: 预测不存在的滤芯

**操作**: 对不存在的滤芯 ID 执行预测

**预期行为**:
- API 返回 404 错误
- 错误信息："滤芯不存在"

### 异常 3: 重复更换滤芯

**操作**: 对已更换的滤芯再次创建更换报告

**预期行为**:
- 系统检测到滤芯状态为 'replaced'
- 返回错误："该滤芯已被替换"

### 异常 4: 导入格式错误的文件

**操作**: 上传非 CSV/Excel 格式的文件

**预期行为**:
- 返回错误："不支持的文件格式，请使用 CSV 或 Excel 文件"

### 异常 5: 投诉严重程度无效

**操作**: 创建投诉时使用无效的严重程度

**预期行为**:
- API 返回 400 错误
- 提示有效选项：low, medium, high, critical

## 预测算法说明

### 评分权重

| 因素 | 权重 | 说明 |
|------|------|------|
| 使用时间 | 25% | 基于安装日期计算 |
| 用水量 | 30% | 基于累积水量计算 |
| 水质指标 | 30% | 综合6项水质参数 |
| 投诉记录 | 15% | 考虑数量和严重程度 |

### 风险等级

| 等级 | 健康评分 | 建议 |
|------|----------|------|
| critical | < 20 | 立即更换 |
| high | 20-40 | 本周内更换 |
| medium | 40-60 | 两周内安排 |
| low | 60-80 | 继续监控 |
| normal | >= 80 | 正常使用 |

### 水质参数权重

| 参数 | 权重 |
|------|------|
| 浊度 (turbidity) | 25% |
| pH 值 | 20% |
| 余氯 | 20% |
| 电导率 | 15% |
| 总溶解固体 | 15% |
| 色度 | 5% |

## API 接口列表

### 滤芯管理
- `POST /api/filters/` - 创建滤芯
- `GET /api/filters/` - 列出滤芯
- `POST /api/filters/import` - 批量导入滤芯

### 水质指标
- `POST /api/water-quality/` - 添加水质记录
- `GET /api/water-quality/` - 列出水质记录
- `POST /api/water-quality/import` - 批量导入水质数据
- `GET /api/water-quality/filter/{id}/summary` - 水质统计

### 水量记录
- `POST /api/water-volume/` - 添加水量记录
- `GET /api/water-volume/` - 列出水量记录
- `POST /api/water-volume/import` - 批量导入水量数据
- `GET /api/water-volume/filter/{id}/summary` - 水量统计

### 投诉管理
- `POST /api/complaints/` - 记录投诉
- `GET /api/complaints/` - 列出投诉
- `PUT /api/complaints/{id}` - 更新投诉状态
- `POST /api/complaints/import` - 批量导入投诉
- `GET /api/complaints/filter/{id}/stats` - 投诉统计

### 寿命预测
- `POST /api/predictions/predict/{filter_id}` - 单个预测
- `POST /api/predictions/predict-batch` - 批量预测
- `GET /api/predictions/` - 列出预测结果
- `GET /api/predictions/{id}` - 预测详情
- `PUT /api/predictions/{id}/review` - 人工复核
- `GET /api/predictions/export/csv` - 导出预测结果
- `GET /api/predictions/risk/summary` - 风险概览

### 更换报告
- `POST /api/replacement/` - 创建更换报告
- `GET /api/replacement/` - 列出更换报告
- `GET /api/replacement/export/csv` - 导出报告
- `POST /api/replacement/complete-replacement` - 完成更换流程

## 数据库表结构

### filters（滤芯）
- filter_id: 滤芯唯一标识
- station_name: 净水站名称
- filter_type: 滤芯类型
- install_date: 安装日期
- max_lifespan_days: 最大寿命天数
- max_lifespan_liters: 最大寿命水量
- status: 状态（active/replaced）

### filter_predictions（预测记录）
- filter_id: 关联滤芯
- prediction_date: 预测时间
- health_score: 健康评分（0-100）
- risk_level: 风险等级
- recommendation: 建议
- explanation: 详细解释
- review_status: 复核状态
- reviewed_by: 复核人

### complaints（投诉）
- filter_id: 关联滤芯
- complaint_date: 投诉日期
- complaint_type: 投诉类型
- severity: 严重程度
- status: 状态（open/resolved）

## 开发说明

### 运行测试

```bash
pytest tests/ -v
```

### 查看测试覆盖率

```bash
pytest tests/ --cov=app --cov-report=html
```

### 重置数据库

```bash
rm water_filter.db
python init_data.py
```

## 技术栈

- **后端**: Python + FastAPI
- **数据库**: SQLite (可升级到 PostgreSQL)
- **ORM**: SQLAlchemy
- **数据处理**: Pandas
- **前端**: 原生 HTML/JS (无框架依赖)
- **测试**: Pytest

## 业务场景说明

### 场景 1: 定期维护
社区净水站管理员每月运行一次批量预测，根据预测结果安排更换计划。

### 场景 2: 投诉触发
收到多起水质投诉后，立即对相关滤芯进行预测，确认是否需要紧急更换。

### 场景 3: 预防性更换
即使滤芯未到寿命终点，但水质指标持续恶化，系统会提前预警。

### 场景 4: 数据追溯
更换滤芯后，可以通过历史数据对比，验证预测准确性，持续优化算法。
