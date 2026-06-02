# RAG知识库引用体检系统

> 版本化的RAG引用质量评估工具，让每一次判断都有迹可循。专为算法工程师设计，解决交接时"指标涨了但样本是不是变了"的信任问题。

## ✨ 核心特性

### 📌 不可变记录原则
- **版本、阈值、证据、人工改判均可回看**：核心记录永不修改，人工改判和备注采用追加模式
- **旧报告不被无声覆盖**：每次体检生成独立记录，模型版本变更后历史数据永久保留
- **哈希校验**：每次体检生成SHA-256数据哈希，确保数据完整性

### 📝 完整追溯链条
- **原始来源和处理时间**：每条记录保留来源文件、行号、导入时间、操作人
- **操作历史可查**：所有修改、改判、补录都有审计日志，时间线清晰
- **差异说明**：补录备注时可填写差异说明，清晰展示变更原因

### 🎯 核心功能
1. **体检总览**：指标卡片、趋势图表、历史时间线、快速操作
2. **样本管理**：JSONL/JSON格式导入、搜索筛选、批量选择、详情查看
3. **体检详情**：判断链路展示、引用证据、人工改判、备注补录、操作历史
4. **版本对比**：双版本选择、指标对比表、柱状图、差异明细、报告导出
5. **冲突清单**：所有判定变化、待处理标记、快速跳转详情
6. **系统设置**：模型版本管理、置信度阈值配置、数据导入导出重置

### 🛡️ 数据安全
- **LocalFirst架构**：数据全部存储在浏览器本地IndexedDB，无需后端服务
- **数据可迁移**：支持完整导入导出，便于团队协作和交接
- **哈希防篡改**：关键数据带SHA-256哈希校验

---

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 构建生产版本
```bash
npm run build
```

### 4. 预览生产构建
```bash
npm run preview
```

---

## 📁 样本数据格式

### 文件格式要求
支持 **JSONL**（推荐）和 **JSON** 两种格式。

### JSONL 格式示例
```jsonl
{"question": "系统支持哪些支付方式？", "reference_answer": "系统支持支付宝、微信支付和银行卡支付。", "model_output": "系统支持支付宝和微信支付。", "manual_correction": "遗漏了银行卡支付选项。", "online_feedback": "用户询问为什么不支持银行卡。", "knowledge_source": "docs/payment.md", "original_data": {"conversation_id": "conv_001"}}
{"question": "如何修改密码？", "reference_answer": "登录后进入个人设置，点击安全中心，选择修改密码。", "model_output": "登录后进入个人设置，点击修改密码。", "knowledge_source": "docs/account.md", "original_data": {"conversation_id": "conv_002"}}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `question` | string | ✅ | 用户问题 |
| `reference_answer` | string | ⭕ | 参考答案（用于对比评估） |
| `model_output` | string | ⭕ | 模型输出（用于对比评估） |
| `manual_correction` | string | ⭕ | 人工修正（样本自带的修正） |
| `online_feedback` | string | ⭕ | 线上反馈（实际用户反馈） |
| `knowledge_source` | string | ✅ | 知识库来源标识，如 `docs/payment.md` |
| `original_data` | object | ⭕ | 原始业务数据，用于追溯 |

> ⭕ = 可选字段，至少需要填写 `reference_answer` 或 `model_output` 之一

### 下载模板
登录系统后，进入**样本管理**页面，点击「下载模板」按钮获取标准格式模板。

---

## 📖 使用指南

### 第一步：准备样本数据
按照上述JSONL格式准备你的RAG样本数据。建议包括：
- 一小批真实样本（5-20条足够起步）
- 对应的模型输出
- 人工修正（如果已有）
- 线上反馈（如果有）

### 第二步：导入样本
1. 点击左侧导航「样本管理」
2. 拖拽JSONL文件到上传区域，或点击选择文件
3. 导入成功后，样本会显示在列表中

### 第三步：配置模型版本
1. 点击左侧导航「系统设置」
2. 在「模型版本管理」中添加你的模型版本
3. 填写模型名称、版本号、描述信息
4. 设为当前版本

### 第四步：运行体检
1. 在「样本管理」页面勾选要体检的样本
2. 点击右上角「运行体检」按钮
3. 填写批次名称，选择模型版本
4. 点击「开始体检」，等待完成

### 第五步：查看和人工改判
1. 体检完成后自动跳转到体检详情页
2. 查看每条样本的判定结果、引用证据
3. 对模型判定有异议的，点击「人工改判」
4. 选择新判定并填写改判原因

### 第六步：补录备注
1. 在体检详情页，点击「补录备注」
2. 填写备注内容
3. 如果涉及数据变更，在「差异说明」中描述清楚

### 第七步：版本对比
1. 点击左侧导航「版本对比」
2. 选择两个要对比的体检版本
3. 查看指标变化、对比图表、差异明细
4. 导出对比报告存档

### 第八步：查看冲突清单
1. 点击左侧导航「冲突清单」
2. 查看所有版本间的判定变化
3. 筛选待处理的冲突，逐一处理

---

## 🔍 关键概念

### 判定类型
| 类型 | 说明 |
|------|------|
| ✅ **正确** | 模型引用完全准确，符合知识库内容 |
| ⚠️ **部分正确** | 模型引用部分正确，但存在遗漏或偏差 |
| ❌ **错误** | 模型引用错误，与知识库内容不符 |
| ❓ **未验证** | 无法通过现有信息验证引用正确性 |

### 核心指标
- **准确率** = 正确样本数 / 总样本数
- **精确率** = 正确样本数 / (正确样本数 + 错误样本数)
- **召回率** = 正确样本数 / (正确样本数 + 部分正确 + 未验证)
- **F1分数** = 2 * (精确率 * 召回率) / (精确率 + 召回率)

### 置信度阈值
- 默认阈值：70%
- 模型置信度低于阈值的样本会被特别标记，建议人工审核
- 可在「系统设置」中调整

---

## 🏗️ 技术架构

### 技术栈
- **前端框架**：React 18 + TypeScript + Vite 5
- **状态管理**：Zustand 4
- **路由**：React Router 6
- **样式**：TailwindCSS 3 + CSS变量主题系统
- **本地存储**：IndexedDB (idb库) + LocalStorage
- **图表**：Recharts 2
- **动画**：Framer Motion
- **图标**：Lucide React
- **数据校验**：SHA-256 (Web Crypto API)

### 数据模型
```
ModelVersion (模型版本)
├── id, name, version, description, config
└── isActive (是否当前版本)

CheckupRun (体检运行)
├── id, modelName, version, batchName
├── metrics (准确率/精确率/召回率/F1等)
├── confidenceThreshold
├── dataHash (SHA-256)
└── status (running/completed/failed)

Sample (样本)
├── id, question, referenceAnswer, modelOutput
├── manualCorrection, onlineFeedback
├── knowledgeSource, sourceFile, sourceLine
└── dataHash (SHA-256)

SampleResult (样本结果)
├── id, runId, sampleId, modelOutput
├── originalJudgment, finalJudgment
├── modelConfidence, evidence[]
├── manualJudgment { judgment, reason, operator, timestamp }
└── notes[]

AuditLog (审计日志)
├── id, entityType, entityId, action
├── operator, timestamp
├── beforeState, afterState
└── metadata (改判/备注的详细信息)
```

### 项目结构
```
src/
├── components/        # UI组件
│   ├── Layout/       # 布局组件
│   ├── MetricCard.tsx
│   ├── Timeline.tsx
│   ├── EvidenceBlock.tsx
│   ├── JudgmentBadge.tsx
│   └── ConfidenceBar.tsx
├── pages/            # 页面组件
│   ├── Dashboard.tsx       # 体检总览
│   ├── Samples.tsx         # 样本管理
│   ├── CheckupDetail.tsx   # 体检详情
│   ├── Compare.tsx         # 版本对比
│   ├── Conflicts.tsx       # 冲突清单
│   └── Settings.tsx        # 系统设置
├── services/         # 业务服务
│   ├── checkupEngine.ts    # 体检引擎
│   ├── comparisonEngine.ts # 对比引擎
│   ├── auditService.ts     # 审计服务
│   └── reportGenerator.ts  # 报告生成器
├── store/            # 状态管理
├── db/               # 数据库层
├── utils/            # 工具函数
├── types/            # TypeScript类型
├── lib/              # 第三方库封装
├── App.tsx           # 路由配置
├── main.tsx          # 入口文件
└── index.css         # 全局样式
```

---

## 🤝 交接检查清单

- [ ] 确认所有样本都已导入并设置正确的知识库来源
- [ ] 确认模型版本信息完整（名称、版本号、配置）
- [ ] 确认待处理的冲突都已处理或备注说明
- [ ] 导出完整数据存档（设置 → 导出数据）
- [ ] 导出关键体检报告存档
- [ ] 告知接手人如何查看操作历史和改判原因

---

## ❓ 常见问题

### Q: 数据存储在哪里？安全吗？
A: 数据全部存储在浏览器本地的IndexedDB中，不会上传到任何服务器。可以通过「导出数据」功能备份，或通过「导入数据」功能在不同设备/浏览器间迁移。

### Q: 可以多人协作吗？
A: 可以通过导出/导入JSON文件的方式共享数据。每个人在自己的浏览器上操作，需要合并时可以互相导出最新数据。

### Q: 如何确保数据没有被篡改？
A: 每次体检和每条样本都会生成SHA-256哈希值。导出的报告中包含哈希校验码，可以用于验证数据完整性。

### Q: 误删了数据怎么办？
A: 系统有导出功能，建议定期备份。如果之前导出过，可以通过「导入数据」恢复。也可以点击「重置数据」恢复到初始示例状态。

### Q: 浏览器缓存清除了数据会丢失吗？
A: 是的，IndexedDB数据会随浏览器数据清除而丢失。**请务必定期导出备份！**

---

## 📄 报告格式

系统支持导出三种格式的报告：

### Markdown格式（推荐）
包含完整的指标、图表分析、明细数据，适合交接存档。

### JSON格式
结构化数据，适合程序处理或二次开发。

### CSV格式
表格数据，适合用Excel等工具进一步分析。

---

## 🔗 相关文档
- [产品需求文档](.trae/documents/prd.md)
- [技术架构文档](.trae/documents/tech-arch.md)

---

**让每一次判断都有迹可循，让交接不再是噩梦。** 🎯
