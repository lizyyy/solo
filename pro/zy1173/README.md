# GPT 原理沙盘

一个用于学习和演示 GPT（Generative Pre-trained Transformer）工作原理的交互式沙盘工具。

## 📖 项目简介

GPT 原理沙盘是一个交互式学习工具，通过可视化的方式帮助你理解 GPT 模型的核心工作原理。不同于静态的科普文章，这个沙盘让你能够：

- **亲自输入文本**，观察 Tokenizer 的切分过程
- **看到 Token ID 序列**，理解文本如何被数字化
- **直观展示上下文窗口截断**，理解模型的限制
- **交互式注意力热力图**，理解自注意力机制
- **对比不同采样策略**，理解 Temperature/Top-P 的作用
- **量化演示 KV Cache**，了解推理优化原理

## 🏗️ 项目架构

```
gpt-sandbox/
├── backend/                    # 后端服务
│   ├── app/
│   │   ├── core/              # 核心模块
│   │   │   ├── tokenizer_service.py      # Tokenizer 服务
│   │   │   ├── model_simulator.py        # Transformer 模拟器
│   │   │   └── experiment_manager.py     # 实验管理器
│   │   ├── routers/           # API 路由
│   │   │   ├── tokenizer.py   # Tokenizer API
│   │   │   ├── inference.py   # 推理 API
│   │   │   ├── experiment.py  # 实验管理 API
│   │   │   └── data.py        # 数据管理 API
│   │   ├── main.py            # FastAPI 应用入口
│   │   └── config.py          # 配置
│   ├── tests/                  # 测试文件
│   │   ├── test_tokenizer_service.py
│   │   ├── test_model_simulator.py
│   │   ├── test_experiment_manager.py
│   │   └── test_api_routes.py
│   └── requirements.txt        # Python 依赖
│
└── frontend/                   # 前端应用
    ├── src/
    │   ├── pages/              # 页面组件
    │   │   ├── TokenizerPage.tsx    # Tokenizer 可视化
    │   │   ├── InferencePage.tsx    # 推理演示
    │   │   ├── AttentionPage.tsx    # 注意力机制
    │   │   ├── ExperimentPage.tsx   # 实验管理
    │   │   └── DataPage.tsx         # 数据管理
    │   ├── api/index.ts        # API 服务层
    │   ├── App.tsx             # 主应用组件
    │   └── main.tsx            # 应用入口
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── tailwind.config.js
```

## 🚀 快速开始

### 环境要求

- Python 3.9+
- Node.js 18+
- pnpm 或 npm

### 后端安装

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 前端安装

```bash
cd frontend

# 安装依赖
pnpm install
# 或 npm install
```

### 启动服务

**启动后端：**

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

后端服务将在 http://localhost:8000 启动。

**启动前端：**

```bash
cd frontend
pnpm dev
# 或 npm run dev
```

前端应用将在 http://localhost:5173 启动。

### 访问应用

打开浏览器访问：http://localhost:5173

## 📚 功能模块

### 1. Tokenizer 可视化

**功能：** 观察文本如何被切分成 Token

**核心概念：**
- **Token**：模型理解的最小语言单元
- **Token ID**：Token 在词表中的数字索引
- **上下文窗口**：模型一次能处理的最大 Token 数量

**操作步骤：**
1. 输入一段文本（支持中英文混合）
2. 查看彩色 Token 盒子展示
3. 观察 Token ID 序列
4. 调整上下文窗口大小，查看截断效果

**内置分词器：**
- **Simple Tokenizer**：基于字符的简易分词器（默认）
- **HuggingFace Tokenizer**：需要安装 `transformers` 库

### 2. 推理演示

**功能：** 演示文本生成过程和优化策略

#### 2.1 文本生成

**核心概念：**
- **Next-token Prediction**：自回归预测下一个 token
- **Sampling Strategies**：不同的采样策略影响输出多样性

**可调参数：**
| 参数 | 范围 | 说明 |
|------|------|------|
| Max New Tokens | 1-1024 | 生成的最大 token 数量 |
| Temperature | 0.1-2.0 | 控制随机性（越高越随机） |
| Top-P | 0.1-1.0 | 核采样，累积概率阈值 |
| Top-K | 0-100 | 限制候选 token 数量（0 表示不限制） |
| Sampling Type | - | 采样策略选择 |
| Use KV Cache | - | 是否启用 KV Cache |

**采样策略说明：**
- **Greedy**：总是选择概率最高的 token（确定性输出）
- **Temperature**：基于温度的随机采样
- **Top-P**：核采样，从累积概率超过阈值的候选中采样
- **Top-K**：从概率最高的 K 个候选中采样

#### 2.2 KV Cache 对比

**功能：** 量化演示 KV Cache 对推理延迟的影响

**原理说明：**
KV Cache 通过缓存已计算的 Key 和 Value 状态，避免重复计算，从而显著加速推理过程。

**预期结果：**
- 有 KV Cache：延迟较低（尤其在生成长文本时）
- 无 KV Cache：延迟较高（每次都要重新计算所有 token）
- 加速比：通常可达 2-3 倍或更多

#### 2.3 采样策略对比

**功能：** 同时对比多种采样策略的输出效果

**对比内容：**
- Greedy 采样
- Temperature=0.3（保守）
- Temperature=0.7（平衡）
- Temperature=1.5（随机）
- Top-P=0.9
- Top-K=50

### 3. 注意力机制

**功能：** 可视化 Transformer 的自注意力机制

**核心概念：**
- **自注意力**：模型如何"关注"输入中的其他位置
- **因果掩码**：模型只能看到当前位置之前的 token
- **多层多头**：不同层和头关注不同的语义信息

**交互操作：**
1. 输入文本，生成注意力热力图
2. 切换不同的层（Layer）查看注意力模式
3. 观察因果掩码效果（上三角为 0）

**热力图说明：**
- 行：查询位置（Query）
- 列：键位置（Key）
- 颜色深浅：注意力权重大小
- 上三角全黑：因果掩码导致无法"预测未来"

### 4. 实验管理

**功能：** 保存、查看、导出实验结果

**实验类型：**
- `tokenization`：分词实验
- `inference`：推理实验
- `attention`：注意力实验

**导出格式：**
- **Markdown**：结构化报告，便于阅读和分享
- **JSON**：完整数据，便于后续分析

**风险说明：**
每次实验会根据参数自动生成风险提示，例如：
- 高温度值可能导致输出不连贯
- 低 top-p 可能限制输出多样性
- 过长的生成长度可能超出预期

### 5. 数据管理

**功能：** 管理预训练语料、微调样本和异常样例

#### 5.1 内置 Seed 数据

**预训练语料（5条）：**
- 新闻报道风格文本
- 科普文章风格文本
- 产品描述风格文本
- 对话风格文本
- 诗歌风格文本

**微调样本（3条）：**
- 单轮问答格式
- 多轮对话格式
- 文本摘要格式

**推理样本（2条）：**
- 续写任务
- 问答任务

#### 5.2 异常测试样例（6条）

| ID | 类型 | 说明 |
|------|------|------|
| edge-empty | 空文本 | 边界条件测试 |
| edge-whitespace | 纯空白字符 | Tokenizer 处理测试 |
| edge-special | 特殊字符 | !@#$%^&*()_+ |
| edge-long | 超长文本 | 超过上下文窗口 |
| edge-unicode | Unicode 表情 | Emoji 处理 |
| edge-numeric | 数字和单位 | 数值文本处理 |

#### 5.3 导入功能

支持导入 JSON 格式的自定义数据：

```json
[
  {
    "id": "my-data-001",
    "text": "你的自定义文本内容...",
    "description": "数据描述"
  }
]
```

## 🧪 运行测试

### 后端测试

```bash
cd backend

# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_tokenizer_service.py

# 带详细输出
pytest -v

# 生成覆盖率报告
pytest --cov=app
```

**测试覆盖范围：**
- Tokenizer 服务：23 个测试用例
- 模型模拟器：20 个测试用例
- 实验管理器：25 个测试用例
- API 路由：25 个测试用例

## 📊 API 接口

### Tokenizer API

```
POST /api/tokenizer/tokenize      # 文本分词
POST /api/tokenizer/encode        # 编码为 token ID
POST /api/tokenizer/truncate      # 上下文截断
GET  /api/tokenizer/vocab-size    # 获取词表大小
```

### Inference API

```
POST /api/inference/generate              # 文本生成
POST /api/inference/attention-heatmap     # 注意力热力图
POST /api/inference/kv-cache-comparison   # KV Cache 对比
POST /api/inference/sampling-comparison   # 采样策略对比
```

### Experiment API

```
POST   /api/experiment/              # 创建实验
GET    /api/experiment/              # 列出实验
GET    /api/experiment/{id}          # 获取实验详情
PUT    /api/experiment/{id}          # 更新实验
DELETE /api/experiment/{id}          # 删除实验
GET    /api/experiment/{id}/export/markdown  # 导出 Markdown
GET    /api/experiment/{id}/export/json      # 导出 JSON
```

### Data API

```
GET /api/data/seed/all          # 获取所有 seed 数据
GET /api/data/seed/corpus       # 预训练语料
GET /api/data/seed/finetune     # 微调样本
GET /api/data/seed/inference    # 推理样本
GET /api/data/seed/edge-cases   # 异常样例
```

## 🔧 配置说明

### 后端配置

编辑 `backend/app/config.py`：

```python
DATA_DIR = "data"                    # 数据存储目录
CONTEXT_WINDOW = 1024                # 默认上下文窗口
DEFAULT_VOCAB_SIZE = 50257           # 默认词表大小
DEFAULT_NUM_LAYERS = 12               # Transformer 层数
DEFAULT_NUM_HEADS = 12                 # 注意力头数
DEFAULT_HIDDEN_SIZE = 768             # 隐藏层维度
```

### 前端配置

编辑 `frontend/vite.config.ts`：

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:8000',  // 后端地址
    changeOrigin: true,
  }
}
```

## 📝 学习资源

### 核心概念

1. **Tokenizer**：将文本转换为模型可理解的 token 序列
2. **Embedding**：将 token ID 映射为向量表示
3. **Self-Attention**：计算 token 之间的注意力权重
4. **Feed-Forward**：逐位置的前馈神经网络
5. **Causal Mask**：防止模型"看到未来"
6. **KV Cache**：缓存注意力计算以加速推理

### 采样策略对比

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| Greedy | 确定、高效 | 可能重复、不连贯 | 需要确定性输出 |
| Temperature | 可控随机性 | 高温度可能无意义 | 创意写作 |
| Top-P | 保持多样性 | 需要调参 | 平衡质量和多样性 |
| Top-K | 简单直观 | K 值难选 | 快速生成 |

### KV Cache 原理

**无 KV Cache：**
- 每次生成都要重新计算所有 token 的注意力
- 时间复杂度 O(n²)，n 为已生成的 token 数量

**有 KV Cache：**
- 缓存已计算的 Key 和 Value 状态
- 每次只需计算新 token 的注意力
- 时间复杂度 O(n)，显著加速

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📧 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送 Pull Request

## 🎯 下一步学习

掌握本沙盘后，建议进一步学习：

1. **真实模型**：使用 HuggingFace Transformers 加载实际的 GPT 模型
2. **微调实践**：学习如何在自定义数据上微调模型
3. **部署优化**：学习量化、蒸馏等模型优化技术
4. **Prompt 工程**：学习如何设计有效的 prompt

---

**开始你的 GPT 原理探索之旅吧！** 🚀
