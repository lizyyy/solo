# 模型推理API评测系统

本地部署的模型质量评测工作台，供质量负责人录入模型版本、执行评测、人工标注审核。

## 🚀 本地启动

### 环境要求
- Python 3.8+

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
python app.py
```

服务启动后访问: **http://localhost:5000**

## 📊 功能说明

### 1. 看板 (Dashboard)
- 统计总评测数、模型数量、测试样本数
- 各模型准确率对比图表
- 模型状态展示（待审核/通过/拒绝）
- 最近评测结果列表

### 2. 模型管理
- 添加新模型（名称 + 版本号 + 描述）
- 添加测试样本（输入文本 + 期望输出 + 分类）
- 一键初始化示例数据

### 3. 评测执行
- 选择模型和测试样本执行评测
- 自动测量响应延迟（ms）
- 自动检测错误分类
- 待人工审核列表

### 4. 时间线
- 完整的操作历史记录
- 支持追溯所有评测活动

### 5. 修正复盘
- 错误分类修正记录
- 人工标注处理理由可复盘
- **规则阻挡演示**：尝试标记已通过的评测会被拒绝

## 🔧 API接口

### 初始化数据
```bash
POST /api/init
```
初始化示例模型和测试样本。

### 模型管理
```bash
GET  /api/models          # 获取所有模型
POST /api/models          # 创建新模型
# 请求体: {"name": "GPT-3.5", "version": "turbo", "description": "..."}
```

### 测试样本
```bash
GET  /api/test-samples    # 获取所有样本
POST /api/test-samples    # 创建新样本
# 请求体: {"input": "...", "expected_output": "...", "category": "general"}
```

### 评测执行
```bash
POST /api/evaluate        # 执行评测
# 请求体: {"model_id": "...", "sample_id": "..."}

GET  /api/evaluations     # 获取评测列表
```

### 人工标注
```bash
POST /api/evaluations/{id}/label
# 请求体: {"label": "correct", "reason": "..."}
```

### 看板数据
```bash
GET /api/dashboard        # 获取统计数据
GET /api/timeline         # 获取时间线
GET /api/corrections      # 获取修正记录
```

## ⚠️ 会被规则挡住的操作

**场景**：尝试对已通过的评测进行人工标注

```bash
POST /api/evaluations/{completed_eval_id}/label
Body: {"blocked": true}
```

**返回**: `403 Forbidden`
```json
{"error": "此操作被规则挡住: 不允许标记已通过的评测"}
```

在前端"修正复盘"页面点击"尝试标记已通过的评测"按钮即可体验。

## 🔄 错误分类修正路径

### 修正流程
1. **评测触发错误**：系统检测到 `classification_error`，状态设为 `needs_review`
2. **人工介入**：在"评测执行"页面的待审核列表中处理
3. **提交标注**：填写标注结果(correct/incorrect)和处理理由
4. **生成修正记录**：系统自动保存修正记录到复盘列表

### 复盘查看
在"修正复盘"页面可查看：
- 原始错误类型
- 最终修正标注
- 人工处理理由
- 时间戳记录

## 📁 数据存储

所有数据保存在 `data/` 目录下的 JSON 文件中：
- `models.json` - 模型列表
- `test_samples.json` - 测试样本
- `evaluations.json` - 评测结果
- `timeline.json` - 操作时间线
- `corrections.json` - 修正记录

## 🎯 评测判定规则

模型状态自动判定：
- **通过 (approved)**: 平均延迟 < 200ms 且 准确率 > 80%
- **拒绝 (rejected)**: 平均延迟 > 500ms
- **待审核 (pending)**: 其他情况

## 💡 使用示例

1. 点击"模型管理" → 点击"初始化示例数据"
2. 点击"评测执行" → 选择模型和样本 → 点击"开始评测"
3. 多次评测后查看"看板"的准确率图表
4. 遇到错误分类时，在待审核列表提交人工标注
5. 在"修正复盘"查看标注理由记录
6. 测试规则阻挡：点击"尝试标记已通过的评测"
