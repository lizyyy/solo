# ML Pipeline Studio

本地模型训练流水线演练台，用于完整的机器学习流水线管理和可追溯性。

## 项目概述

平时数据收集、清洗、特征工程、训练、验证、测试、上线都散在 notebook 和表格里，最后没人说得清某个模型用了哪批数据、规则有没有变、验证有没有过线。

ML Pipeline Studio 提供了完整的解决方案：

- **可追溯性**: 记录数据集版本、清洗任务、特征版本、训练 run、验证指标、测试用例、上线申请、审批和审计
- **阶段执行**: 按阶段执行流水线，支持回滚到任意阶段
- **质量保障**: 自动发现数据质量问题、特征缺失/泄漏、阈值未达标
- **对比分析**: 支持模型版本对比、测试集回放、灰度上线模拟
- **报告导出**: 导出 Markdown/JSON 格式报告

## 技术栈

- **后端**: Python + Flask + SQLAlchemy + SQLite
- **前端**: Jinja2 + Bootstrap 5
- **数据处理**: pandas + numpy + scikit-learn
- **配置**: YAML
- **测试**: pytest

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动应用

```bash
python app.py
```

应用将在 `http://localhost:5000` 启动。

### 3. 访问应用

打开浏览器访问 `http://localhost:5000`

## 项目结构

```
zy1169/
├── app.py                      # Flask 应用主入口
├── config.py                   # 应用配置
├── models.py                   # 数据库模型定义
├── requirements.txt            # 依赖列表
├── README.md                   # 本文档
├── core/                       # 核心业务逻辑
│   ├── __init__.py
│   ├── data_uploader.py        # 文件上传处理
│   ├── data_cleaner.py         # 数据清洗引擎
│   ├── feature_engineer.py     # 特征工程模块
│   ├── model_trainer.py        # 模型训练模块
│   ├── quality_checker.py      # 数据质量检查
│   ├── pipeline_manager.py     # 流水线管理和回滚
│   └── report_generator.py     # 报告生成模块
├── templates/                  # Jinja2 模板
│   ├── base.html               # 基础模板
│   ├── index.html              # 首页
│   ├── project_detail.html     # 项目详情
│   ├── upload_data.html        # 数据上传
│   ├── create_cleaning.html    # 创建清洗任务
│   ├── create_features.html    # 创建特征版本
│   ├── create_training.html    # 创建训练任务
│   ├── create_deployment.html  # 创建上线申请
│   ├── training_detail.html    # 训练详情
│   ├── deployment_detail.html  # 上线申请详情
│   ├── reports.html            # 报告列表
│   ├── compare_models.html     # 模型对比
│   ├── playback.html           # 测试回放
│   └── playback_result.html    # 回放结果
├── seeds/                      # Seed 数据和坏样例
│   ├── good/                   # 正确配置示例
│   │   ├── raw-data.csv
│   │   ├── cleaning-rules.yaml
│   │   ├── feature-spec.yaml
│   │   ├── train-config.yaml
│   │   └── eval-thresholds.yaml
│   └── bad/                    # 坏样例（用于测试质量检查）
│       ├── bad_data_missing_values.csv
│       ├── bad_data_duplicates.csv
│       ├── bad_data_outliers.csv
│       └── bad_data_leakage.csv
└── tests/                      # 测试文件
    ├── __init__.py
    ├── conftest.py
    ├── test_quality_checker.py
    ├── test_data_cleaner.py
    ├── test_feature_engineer.py
    └── test_routes.py
```

## 使用指南

### 完整流水线流程

1. **创建项目** → 2. **上传原始数据** → 3. **创建清洗任务** → 4. **执行清洗** → 5. **创建特征版本** → 6. **执行特征工程** → 7. **创建训练任务** → 8. **执行训练** → 9. **申请上线** → 10. **审批** → 11. **上线部署**

### 配置文件格式

#### 1. 清洗规则 (cleaning-rules.yaml)

```yaml
rules:
  - name: drop_duplicates
    description: "删除重复行"
    action: drop_duplicates

  - name: handle_missing_age
    description: "使用中位数填充age缺失值"
    action: fill_missing
    column: "age"
    method: "median"  # mean, median, mode

  - name: filter_valid_age
    description: "过滤无效年龄（18-100岁）"
    action: filter
    condition: "age >= 18 and age <= 100"

  - name: convert_boolean
    description: "转换布尔列类型"
    action: convert_type
    columns: ["has_cr_card"]
    dtype: "int"

  - name: drop_unused_columns
    description: "删除不需要的列"
    action: drop_column
    columns: ["unnamed_0"]
```

**支持的清洗操作**:
- `drop_duplicates`: 删除重复行
- `fill_missing`: 填充缺失值 (mean/median/mode)
- `filter`: 按条件过滤行
- `convert_type`: 转换列类型
- `drop_column`: 删除列
- `rename_column`: 重命名列

#### 2. 特征规格 (feature-spec.yaml)

```yaml
features:
  - name: "age"
    transform: "normalize"
    method: "minmax"  # minmax, standard

  - name: "category"
    transform: "label_encode"

  - name: "category_multi"
    transform: "one_hot"

  - name: "income"
    transform: "log_transform"

  - name: "income_age_interaction"
    transform: "interaction"
    columns: ["monthly_income", "age"]

  - name: "age_group"
    transform: "bin"
    column: "age"
    bins: [0, 40, 60, 200]
    labels: ["young", "middle", "senior"]
    encode: "label"

exclude_features:
  - "user_id"

target_column: "churned"
```

**支持的特征转换**:
- `normalize`: 归一化 (minmax/standard)
- `label_encode`: 标签编码
- `one_hot`: 独热编码
- `log_transform`: 对数变换
- `interaction`: 交互特征
- `bin`: 分箱
- `polynomial`: 多项式特征
- `extract_datetime`: 提取日期特征

#### 3. 训练配置 (train-config.yaml)

```yaml
model_type: "random_forest"  # logistic_regression, decision_tree, svm, knn
task_type: "classification"  # classification, regression

target_column: "churned"

feature_columns:
  - "age"
  - "monthly_income"
  - "tenure"

hyperparameters:
  n_estimators: 100
  max_depth: 10
  min_samples_split: 2
  random_state: 42

data_split:
  test_size: 0.2
  random_state: 42
  stratify: true

evaluation:
  metrics:
    - "accuracy"
    - "precision"
    - "recall"
    - "f1_score"
    - "auc_roc"
```

**支持的模型**:
- `logistic_regression`: 逻辑回归
- `random_forest`: 随机森林
- `decision_tree`: 决策树
- `svm`: 支持向量机
- `knn`: K近邻

#### 4. 验证阈值 (eval-thresholds.yaml)

```yaml
thresholds:
  - metric: "accuracy"
    min_value: 0.75
    description: "准确率最低阈值"

  - metric: "precision"
    min_value: 0.70
    description: "精确率最低阈值"

  - metric: "recall"
    min_value: 0.65
    description: "召回率最低阈值"

  - metric: "f1_score"
    min_value: 0.70
    description: "F1分数最低阈值"

  - metric: "auc_roc"
    min_value: 0.80
    description: "AUC-ROC最低阈值"

data_quality:
  max_missing_ratio: 0.1
  max_duplicate_ratio: 0.01

feature_checks:
  max_leakage_correlation: 0.95
  min_feature_variance: 0.01
```

## 功能特性

### 数据质量检查

系统会自动检测以下数据质量问题：

- **缺失值**: 检测各列缺失值比例
- **重复行**: 检测完全重复的行
- **异常值**: 使用 IQR 方法检测异常值
- **零方差特征**: 检测常量列
- **数据类型不一致**: 检测数据类型问题

### 特征泄漏检测

系统会检测以下特征泄漏风险：

- **高相关性**: 特征与目标列相关性过高 (>0.95)
- **零方差**: 特征无变化
- **ID列**: 检测可能的唯一标识符列

### 流水线阶段

```
数据上传 → 数据清洗 → 特征工程 → 模型训练 → 验证 → 测试 → 上线申请 → 审批 → 已上线
```

每个阶段都可以独立执行，也支持回滚到任意阶段。

### 回滚机制

支持回滚到以下阶段：
- `data_upload`: 数据上传阶段
- `data_cleaning`: 数据清洗阶段
- `feature_engineering`: 特征工程阶段
- `training`: 模型训练阶段
- `validation`: 验证阶段
- `testing`: 测试阶段
- `deployment_request`: 上线申请阶段

### 测试集回放

测试集回放功能用于：

- **验证模型稳定性**: 在已标记的测试集上重新运行预测
- **灰度上线模拟**: 通过调整阈值参数，模拟不同流量比例下的模型表现
- **回归测试**: 确保新版本模型没有破坏已知正确的预测结果

### 模型版本对比

支持对两个训练任务进行指标对比：

- 准确率 (Accuracy)
- 精确率 (Precision)
- 召回率 (Recall)
- F1分数 (F1 Score)
- AUC-ROC

### 报告导出

支持导出以下格式的报告：

- **Markdown**: 适合阅读和文档化
- **JSON**: 适合程序处理

报告内容包括：
- 项目基本信息
- 流水线各阶段状态
- 数据质量检查结果
- 特征工程摘要
- 训练参数和指标
- 验证结果
- 上线审批记录

## 测试

### 运行测试

```bash
pytest tests/ -v
```

### 测试覆盖

- `test_quality_checker.py`: 数据质量检查测试
- `test_data_cleaner.py`: 数据清洗引擎测试
- `test_feature_engineer.py`: 特征工程测试
- `test_routes.py`: Web 路由和核心模块测试

## 坏样例说明

`seeds/bad/` 目录包含各种问题数据，用于测试系统的质量检查功能：

| 文件名 | 问题类型 | 预期检测结果 |
|--------|----------|--------------|
| `bad_data_missing_values.csv` | 大量缺失值 | 缺失值比例高警告 |
| `bad_data_duplicates.csv` | 重复行 | 重复率高警告 |
| `bad_data_outliers.csv` | 异常值 | 检测到异常值 |
| `bad_data_leakage.csv` | 特征泄漏 | 检测到高相关性特征 |

## 数据库模型

主要数据模型：

- `Project`: 项目
- `DatasetVersion`: 数据集版本
- `DataQualityCheck`: 数据质量检查
- `CleaningTask`: 清洗任务
- `FeatureVersion`: 特征版本
- `FeatureCheck`: 特征检查
- `TrainingRun`: 训练运行
- `Validation`: 验证指标
- `TestCase`: 测试用例
- `TestResult`: 测试结果
- `DeploymentRequest`: 上线申请
- `ApprovalRecord`: 审批记录
- `AuditLog`: 审计日志

## 配置环境变量

可以通过环境变量配置：

```bash
export FLASK_ENV=development  # development, production, testing
export SECRET_KEY=your-secret-key
```

## License

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
