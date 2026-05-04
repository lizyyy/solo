# 机器学习建模对比台

一个本地机器学习建模对比平台，用于快速对比多个模型在业务表格数据上的表现。

## 功能特性

### 📊 核心功能
- **数据上传**: 支持 CSV 格式文件上传，支持拖拽上传
- **自动数据处理**:
  - 缺失值处理（数值型用中位数，类别型用常量填充）
  - 类别型特征独热编码
  - 数值型特征标准化
  - 自动训练测试集划分
- **模型支持**:
  - 回归任务: 线性回归、决策树、随机森林、XGBoost
  - 分类任务: 逻辑回归、决策树、随机森林、XGBoost
- **评估指标**:
  - 回归: MAE, MSE, RMSE, R², MAPE
  - 分类: Accuracy, Precision, Recall, F1, AUC
- **可视化分析**:
  - 特征重要性排序
  - 混淆矩阵（分类）
  - 残差统计（回归）
- **实验管理**:
  - 保存每次实验配置和结果
  - 查看实验详情
  - 多实验对比
  - 删除实验
- **报告导出**:
  - Markdown 格式报告
  - JSON 格式报告

### 🎯 使用场景
- 业务数据快速建模验证
- 多模型效果对比
- 特征重要性分析
- 模型参数调优参考

## 快速开始

### 1. 环境准备

```bash
# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 使用示例

#### 方式一：使用示例数据

项目提供了两个示例数据集：

- `sample_data/regression_sample.csv` - 房价预测（回归任务）
- `sample_data/classification_sample.csv` - 鸢尾花分类（分类任务）

操作步骤：
1. 打开浏览器访问 `http://localhost:5000`
2. 在"新建实验"标签页，点击上传区域
3. 选择示例数据文件
4. 配置参数：
   - 任务类型：回归/分类
   - 目标列：选择要预测的列
   - 特征列：选择用于预测的列（不选则使用全部）
   - 模型：选择要对比的模型
   - 测试集比例：默认 20%
5. 点击"开始训练"
6. 在"实验列表"查看结果

#### 方式二：使用自有数据

准备 CSV 格式的业务数据，要求：
- 第一行为表头（列名）
- 每行为一条记录
- 目标列可以是连续值（回归）或类别（分类）

示例数据格式：
```csv
feature1,feature2,feature3,target
1.2,3.4,5.6,class_A
2.3,4.5,6.7,class_B
...
```

## 项目结构

```
.
├── app.py                    # Flask 主应用入口
├── requirements.txt          # Python 依赖
├── README.md                 # 项目说明文档
├── sample_data/              # 示例数据
│   ├── regression_sample.csv    # 回归示例数据
│   └── classification_sample.csv # 分类示例数据
├── src/                      # 核心模块
│   ├── data_processor.py        # 数据处理模块
│   ├── model_trainer.py         # 模型训练模块
│   ├── evaluator.py             # 评估指标模块
│   ├── experiment_manager.py    # 实验管理模块
│   └── report_generator.py      # 报告生成模块
├── static/                   # 静态文件
│   └── index.html               # 前端页面
├── uploads/                  # 上传文件存储（运行时创建）
└── experiments/              # 实验数据存储（运行时创建）
```

## 模块说明

### 1. 数据处理模块 (data_processor.py)
- `process()`: 完整数据处理流程
- `handle_missing_values()`: 缺失值处理
- `encode_categorical()`: 类别型编码
- `scale_features()`: 特征标准化

### 2. 模型训练模块 (model_trainer.py)
- `train()`: 训练指定模型
- `predict()`: 预测
- `predict_proba()`: 概率预测（分类模型）

### 3. 评估模块 (evaluator.py)
- `evaluate()`: 计算评估指标
- `get_confusion_matrix()`: 混淆矩阵
- `get_residuals()`: 残差分析
- `get_feature_importance()`: 特征重要性

### 4. 实验管理模块 (experiment_manager.py)
- `save_experiment()`: 保存实验
- `load_experiment()`: 加载实验
- `list_experiments()`: 列出实验
- `compare_experiments()`: 对比实验
- `get_best_model()`: 获取最优模型

### 5. 报告生成模块 (report_generator.py)
- `generate_markdown()`: 生成 Markdown 报告
- `generate_json()`: 生成 JSON 报告

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/upload` | POST | 上传 CSV 文件 |
| `/api/train` | POST | 训练模型 |
| `/api/experiments` | GET | 获取实验列表 |
| `/api/experiments/<id>` | GET | 获取实验详情 |
| `/api/compare` | POST | 对比实验 |
| `/api/export/<id>/markdown` | GET | 导出 Markdown 报告 |
| `/api/export/<id>/json` | GET | 导出 JSON 报告 |
| `/api/delete/<id>` | DELETE | 删除实验 |

## 注意事项

1. **数据格式**: 确保 CSV 文件第一行为列名，避免特殊字符
2. **目标列选择**: 回归任务目标列应为数值型，分类任务可以是数值或字符串
3. **模型选择**: 根据任务类型选择合适的模型，线性回归仅支持回归，逻辑回归仅支持分类
4. **计算资源**: XGBoost 和随机森林在大数据集上可能需要较长时间
5. **数据安全**: 本地运行，数据不上传外部服务器

## 常见问题

**Q: 上传文件后没有反应？**
A: 检查 CSV 文件格式是否正确，第一行必须是列名。

**Q: 训练失败怎么办？**
A: 检查控制台错误信息，常见原因：
- 目标列包含无法转换的特殊字符
- 数据量太小（建议至少 100 条记录）
- 目标列缺失值过多

**Q: 如何选择最优模型？**
A: 
- 回归任务：优先看 R²（越接近 1 越好）和 RMSE（越小越好）
- 分类任务：优先看 Accuracy 和 F1 分数
- 特征重要性可以帮助理解关键特征

**Q: 实验数据存在哪里？**
A: 实验数据保存在 `experiments/` 目录下，每个实验一个子目录，包含：
- `metadata.json`: 实验配置和结果
- 模型文件（.pkl 格式）

## 许可证

MIT License
