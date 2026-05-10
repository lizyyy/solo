# 评测集污染检测服务

一个用于检测训练数据是否包含评测题的后端服务，专为 AI 模型评测前的数据排查场景设计。

## 项目结构

```
.
├── app/
│   ├── __init__.py           # Flask 应用工厂
│   ├── models.py             # 数据模型定义
│   ├── routes.py             # REST API 路由
│   └── services/
│       ├── __init__.py
│       ├── state_manager.py  # 状态机管理（核心业务规则）
│       └── detection_service.py  # 检测业务逻辑
├── tests/
│   ├── __init__.py
│   ├── test_api.py           # API 集成测试
│   ├── test_state_manager.py # 状态机单元测试
│   └── test_detection_service.py  # 业务逻辑测试
├── run.py                    # 应用入口
├── example_flow.py           # 示例流程脚本
├── pytest.ini                # pytest 配置
├── requirements.txt          # Python 依赖
└── README.md
```

## 核心概念

### 数据模型关系

```
EvaluationSet (评测集)
    ├── EvaluationItem (评测项) ── fingerprint ──┐
    └── DetectionTask (检测任务)                  │
              ├── TrainingDataFingerprint ── content_hash ──┴──→ PollutionMatch (污染匹配)
              ├── StatusHistory (状态历史)
              ├── ExemptionRecord (豁免记录)
              └── DetectionReport (检测报告)
```

### 状态流转

```
pending → scanning → completed → needs_confirmation → confirmed_polluted
   ↓         ↓            ↓               ↓            (confirmed_clean)
 failed  ← failed       exempted      exempted         exempted
              ↑
           pending/scanning (重试)
```

### 状态说明

| 状态 | 含义 | 可流转到 |
|------|------|----------|
| pending | 等待扫描 | scanning, failed |
| scanning | 正在扫描 | completed, needs_confirmation, failed |
| completed | 扫描完成（无匹配） | needs_confirmation, exempted |
| needs_confirmation | 等待人工确认 | confirmed_polluted, confirmed_clean, exempted |
| confirmed_polluted | 已确认污染 | exempted |
| confirmed_clean | 已确认干净 | exempted |
| exempted | 已豁免 | 无（终态） |
| failed | 失败 | pending, scanning |

## 快速开始

### 1. 安装依赖

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python run.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 运行示例流程

```bash
# 先安装 requests（示例脚本依赖）
pip install requests

# 运行示例
python example_flow.py
```

### 4. 运行测试

```bash
pytest -v
```

## API 接口

### 评测集管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/evaluation-sets | 创建评测集 |
| GET | /api/evaluation-sets | 列出所有评测集 |
| GET | /api/evaluation-sets/{id} | 获取评测集详情 |

#### 创建评测集请求示例

```json
{
  "name": "ML评测基准集",
  "version": "v1.0",
  "description": "用于模型评测的标准题目集",
  "created_by": "qa_team",
  "items": [
    {"item_id": "q1", "content": "什么是机器学习？"},
    {"item_id": "q2", "content": "什么是深度学习？"}
  ]
}
```

### 检测任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/detection-tasks | 创建检测任务 |
| POST | /api/detection-tasks/{id}/run | 运行检测 |
| GET | /api/detection-tasks | 列出所有任务（支持 ?status=xxx 筛选） |
| GET | /api/detection-tasks/{id} | 获取任务摘要 |
| GET | /api/detection-tasks/{id}/history | 获取状态历史 |
| GET | /api/detection-tasks/{id}/matches | 获取匹配列表 |
| GET | /api/detection-tasks/{id}/exemptions | 获取豁免列表 |

#### 创建检测任务请求示例

```json
{
  "evaluation_set_id": 1,
  "training_data_signature": "training_dataset_2024_v1",
  "training_data_description": "从互联网爬取的ML训练数据",
  "created_by": "data_engineer",
  "training_data": [
    {
      "content": "什么是机器学习？",
      "data_source": "crawled_data/file1.txt",
      "meta_info": {"source_type": "web"}
    }
  ],
  "force": false
}
```

### 人工确认与豁免

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/detection-tasks/{id}/confirm | 人工确认匹配 |
| POST | /api/detection-tasks/{id}/exempt | 创建豁免记录 |

#### 人工确认请求

```json
{
  "match_id": 1,
  "is_polluted": true,
  "confirmed_by": "security_reviewer",
  "comment": "经核查，训练数据确实包含评测题"
}
```

#### 豁免请求

```json
{
  "reason": "false_positive",
  "justification": "这是误报，训练数据是合法使用",
  "exempted_by": "admin",
  "match_id": null
}
```

豁免原因可选值：`false_positive`, `intended_duplicate`, `data_anonymized`, `administrative_decision`, `other`

### 检测报告

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/detection-tasks/{id}/report | 生成检测报告 |
| GET | /api/detection-tasks/{id}/report | 获取所有报告 |

## 核心特性

### 1. 重复提交检测

- 基于 `evaluation_set_id + training_data_signature` 生成唯一 task_key
- 重复提交会被拒绝并返回现有任务信息
- 使用 `force=true` 可以强制创建新任务

### 2. 状态机约束

- 所有状态流转都经过 `StateManager` 校验
- 非法流转会返回清晰的中文错误消息
- 错误消息包含：当前状态、目标状态、允许的下一步操作

### 3. 完整的历史记录

- 每次状态变更都会记录到 `StatusHistory`
- 记录变更人、变更原因、元数据
- 可通过 `/api/detection-tasks/{id}/history` 查询

### 4. 数据指纹

- 使用 SHA256 哈希生成内容指纹
- 支持内容规范化（去除空白、空行）
- 规范化后的相同内容会生成相同指纹

### 5. 豁免机制

- 支持任务级豁免（match_id=null）和单条匹配豁免
- 豁免需要提供理由和说明
- 豁免后状态变为终态，不可再流转

### 6. 检测报告

- 报告包含：总匹配数、活跃匹配数、豁免数、状态历史
- 不同状态生成不同的摘要描述
- 报告数据结构化，便于后续处理

## 典型使用流程

### 场景 1：检测到污染并确认

```
1. 创建评测集 (POST /api/evaluation-sets)
2. 创建检测任务 (POST /api/detection-tasks)
3. 运行检测 (POST /api/detection-tasks/{id}/run)
   → 状态: pending → scanning → needs_confirmation
4. 查看匹配 (GET /api/detection-tasks/{id}/matches)
5. 人工确认 (POST /api/detection-tasks/{id}/confirm)
   → 状态: needs_confirmation → confirmed_polluted
6. 生成报告 (POST /api/detection-tasks/{id}/report)
```

### 场景 2：检测到污染但豁免

```
1-4. 同上
5. 创建豁免 (POST /api/detection-tasks/{id}/exempt)
   → 状态: needs_confirmation → exempted
6. 生成报告
```

### 场景 3：未检测到污染

```
1-3. 同上
   → 状态: pending → scanning → completed (无匹配)
4. 直接生成报告
```

### 场景 4：非法操作拦截

```
尝试在 pending 状态直接豁免 → 返回错误：
"非法状态流转：无法从【等待扫描】直接切换到【已豁免】。
 当前状态下允许的流转目标：正在扫描中, 失败
 下一步建议：请先检查当前任务状态，或重新提交检测。"
```

## 错误处理

所有 API 响应格式统一：

```json
{
  "success": true/false,
  "message": "操作说明或错误原因",
  "data": {...},
  "details": {
    "from_status": "pending",
    "to_status": "exempted",
    "next_allowed_states": ["scanning", "failed"]
  }
}
```

### 常见错误

| HTTP 状态码 | 场景 |
|------------|------|
| 400 | 参数缺失、非法状态流转 |
| 404 | 资源不存在 |
| 409 | 重复提交（评测集或检测任务） |
| 500 | 服务器内部错误 |

## 单元测试覆盖率

项目包含 35 个单元测试，覆盖：

- **状态管理** (11 tests)：状态流转规则、合法性校验、错误消息
- **业务逻辑** (15 tests)：指纹计算、重复提交、完整检测流程、确认与豁免、报告生成
- **API 集成** (9 tests)：所有接口的端到端测试

运行测试：

```bash
pytest -v
# 带覆盖率
pytest --cov=app -v
```

## 设计亮点

1. **状态机显式定义**：`TRANSITION_RULES` 清晰定义所有合法流转，便于理解和维护
2. **错误消息本地化**：所有错误消息使用中文，包含上下文和下一步建议
3. **幂等性保证**：task_key 机制防止重复提交污染数据库
4. **完整审计追踪**：`StatusHistory` 记录所有状态变更，`DetectionReport` 提供最终汇总
5. **可测试性**：核心业务逻辑独立封装，不依赖 Web 框架，便于单元测试

## 后续扩展建议

1. 添加更复杂的指纹匹配算法（如 n-gram、MinHash）
2. 实现异步检测任务队列（Celery/RQ）
3. 添加权限管理和审计日志
4. 支持批量评测集导入导出
5. 添加 Web 管理界面
