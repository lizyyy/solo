# 🧠 深度学习基础实验台

一个用于教学的神经网络可视化实验台，让新同学能够直观地理解深度学习的基本原理。

## ✨ 核心功能

### 🎯 网络配置
- **输入样本**: 支持手动输入或加载预置数据集
- **隐藏层结构**: 可配置多层隐藏层，每层神经元数量可调
- **激活函数**: Sigmoid、ReLU、Tanh、Leaky ReLU、Linear、Softmax
- **损失函数**: 均方误差(MSE)、二元交叉熵、多分类交叉熵
- **学习率**: 可配置，支持观察不同学习率的影响
- **训练轮次**: 可配置 epochs 数量
- **初始化方式**: Xavier、He、随机正态分布、全零、全一
- **随机种子**: 支持固定 seed 确保实验可复现

### 📊 训练可视化
- **Loss 曲线**: 实时观察训练过程中损失值的变化
- **分步详解**: 
  - 前向传播: 查看每层的加权和(z)、激活值(a)的详细计算
  - 反向传播: 查看梯度(δ、dW、db)的链式法则计算过程
  - 权重更新: 查看梯度下降的具体更新步骤(W = W - α·dW)
- **预测结果**: 对比真实值与预测值，查看误差
- **权重矩阵**: 可视化每层权重，观察正负权重的分布

### 📚 实验管理
- **自动保存**: 每次训练自动保存为实验记录
- **历史加载**: 可以加载之前的实验继续分析
- **多实验对比**: 同时对比多个实验的 Loss 曲线和配置参数
- **指标对比**: 对比不同学习率、隐藏层结构、激活函数的效果

### 📄 报告导出
- **Markdown 格式**: 包含公式说明、结果分析，适合教学和分享
- **JSON 格式**: 完整的实验数据，适合进一步分析
- **关键公式**: 前向传播、反向传播、梯度下降的数学公式

### 🎓 教学资源
- **预置数据集**: XOR、AND、OR、正弦曲线拟合、圆形分类
- **教学坏样例**: 
  - 全零初始化陷阱
  - 学习率过大/过小
  - 深层 Sigmoid 梯度消失
  - 无隐藏层(感知机)无法解决非线性问题

## 🛠️ 技术栈

### 后端
- **Python 3.8+**
- **Flask**: Web 框架
- **NumPy**: 纯 NumPy 实现神经网络(无框架依赖)
- **Flask-CORS**: 跨域支持

### 前端
- **React 18**: UI 框架
- **Vite**: 构建工具
- **Recharts**: 图表可视化
- **Axios**: HTTP 客户端

## 📦 安装与运行

### 环境要求
- Python 3.8 或更高版本
- Node.js 16 或更高版本
- npm 或 yarn

### 后端安装

```bash
cd backend
pip install -r requirements.txt
```

### 前端安装

```bash
cd frontend
npm install
```

### 运行项目

**方式一: 分别启动(推荐开发时使用)**

1. 启动后端服务:
```bash
cd backend
python app.py
```
后端将在 http://localhost:5000 运行

2. 启动前端开发服务器:
```bash
cd frontend
npm run dev
```
前端将在 http://localhost:3000 运行

**方式二: 先构建前端再运行**

```bash
cd frontend
npm run build
```

然后启动后端，后端可以配置为服务静态文件。

## 🧪 运行测试

### 后端测试

```bash
cd backend
python -m pytest test_neural_network.py -v
```

或者:

```bash
cd backend
python test_neural_network.py
```

测试覆盖:
- 激活函数测试
- 损失函数测试
- 权重初始化测试
- 神经网络前向/反向传播测试
- 参数验证测试
- XOR 问题学习能力测试

## 📁 项目结构

```
zy1170/
├── backend/                    # 后端代码
│   ├── app.py                 # Flask 应用入口
│   ├── config.py              # 配置文件
│   ├── neural_network.py      # 神经网络核心实现
│   ├── test_neural_network.py # 测试文件
│   ├── requirements.txt       # Python 依赖
│   └── data/                  # 数据目录(运行时自动创建)
│       ├── experiments/       # 实验数据
│       ├── reports/           # 导出的报告
│       └── ...
├── frontend/                   # 前端代码
│   ├── src/
│   │   ├── components/        # React 组件
│   │   │   ├── ConfigPanel.jsx           # 配置面板
│   │   │   ├── TrainingVisualization.jsx # 训练可视化
│   │   │   ├── ExperimentHistory.jsx     # 实验历史
│   │   │   └── ReportExport.jsx          # 报告导出
│   │   ├── services/
│   │   │   └── api.js         # API 调用封装
│   │   ├── App.jsx            # 主应用组件
│   │   └── main.jsx           # 入口文件
│   ├── index.html             # HTML 模板
│   ├── vite.config.js         # Vite 配置
│   └── package.json           # Node 依赖
└── README.md                  # 本文件
```

## 🎯 使用示例

### 快速开始: 训练 XOR 网络

1. 启动前后端服务
2. 在浏览器打开 http://localhost:3000
3. 在"预置数据集"中选择 "XOR 问题"
4. 点击 "开始完整训练"
5. 在右侧观察 Loss 曲线下降
6. 训练完成后点击 "单步训练" 查看详细计算过程

### 教学演示: 观察梯度消失

1. 在"教学坏样例"中选择 "深层Sigmoid梯度消失"
2. 点击 "开始完整训练"
3. 观察 Loss 曲线几乎不下降
4. 点击 "单步训练"，在"分步详解"中查看梯度值
5. 对比改用 ReLU 激活函数的效果

### 实验对比: 不同学习率

1. 用学习率 0.001 训练一次(自动保存)
2. 用学习率 0.1 训练一次
3. 用学习率 10 训练一次
4. 进入"实验历史"标签
5. 勾选这三个实验，点击"对比"
6. 观察三条 Loss 曲线的差异

## 📐 核心数学公式

### 前向传播

```
z[l] = W[l] · a[l-1] + b[l]
a[l] = σ(z[l])
```

其中:
- `z[l]`: 第 l 层的加权和
- `W[l]`: 第 l 层的权重矩阵
- `a[l-1]`: 第 l-1 层的激活值
- `b[l]`: 第 l 层的偏置
- `σ`: 激活函数(Sigmoid/ReLU/Tanh 等)

### 反向传播 (链式法则)

输出层误差:
```
δ[L] = ∂L/∂a[L] ⊙ σ'(z[L])
```

隐藏层误差:
```
δ[l] = (W[l+1])ᵀ · δ[l+1] ⊙ σ'(z[l])
```

权重梯度:
```
∂L/∂W[l] = (a[l-1])ᵀ · δ[l] / m
∂L/∂b[l] = Σ δ[l] / m
```

### 梯度下降更新

```
W[l] = W[l] - α · ∂L/∂W[l]
b[l] = b[l] - α · ∂L/∂b[l]
```

其中 `α` 是学习率。

### 损失函数

**均方误差 (MSE)**:
```
L = (1/2m) · Σ ||y_pred - y_true||²
```

**二元交叉熵**:
```
L = -(1/m) · Σ [y_true·log(y_pred) + (1-y_true)·log(1-y_pred)]
```

## 🔧 API 接口

### 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/datasets | 获取预置数据集列表 |
| GET | /api/datasets/<id> | 获取具体数据集 |
| GET | /api/bad-samples | 获取坏样例列表 |
| POST | /api/validate | 验证参数配置 |
| POST | /api/train/step-by-step | 完整训练 |
| POST | /api/train/single-step | 单步训练 |
| GET | /api/experiments | 获取实验列表 |
| POST | /api/experiments | 创建实验 |
| GET | /api/reports/<id>/markdown | 生成 Markdown 报告 |
| POST | /api/compare | 对比多个实验 |

## 📝 扩展开发

### 添加新的激活函数

在 `backend/neural_network.py` 的 `ActivationFunctions` 类中添加:

```python
@staticmethod
def my_activation(z: np.ndarray) -> np.ndarray:
    # 实现激活函数
    pass

@staticmethod
def my_activation_derivative(z: np.ndarray) -> np.ndarray:
    # 实现导数
    pass
```

然后在 `NeuralNetwork._get_activation` 中注册。

### 添加新的数据集

在 `backend/app.py` 的 `SEED_DATASETS` 字典中添加:

```python
'my_dataset': {
    'name': '我的数据集',
    'description': '数据集描述',
    'X': [[...], [...]],  # 或使用 generator
    'y': [[...], [...]],
    'generator': lambda: generate_my_data()  # 动态生成
}
```

## 🐛 常见问题

### Q: 训练时 Loss 不下降怎么办？

可能的原因:
1. 学习率过大或过小
2. 初始化方式不合适(如全零初始化)
3. 激活函数选择不当(深层网络用 Sigmoid)
4. 网络容量不足(隐藏层太少)

尝试:
- 使用坏样例观察问题
- 调整学习率(推荐 0.01-0.1 开始)
- 改用 ReLU 或 Leaky ReLU
- 增加隐藏层神经元数量

### Q: 如何复现之前的实验结果？

每个实验都保存了随机种子，你可以:
1. 在"实验历史"中加载之前的实验
2. 或者手动设置相同的 seed 值
3. 使用相同的配置参数

### Q: 支持 GPU 加速吗？

目前使用纯 NumPy 实现，目的是教学演示，让学生看到完整的计算过程。GPU 加速会使用 PyTorch/TensorFlow 等框架，会隐藏很多细节，不适合本项目的教学目的。

## 📄 许可证

本项目仅供教学和学习使用。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**祝您学习愉快！** 🎉
