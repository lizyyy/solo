# 知识库问答引用校验器

一个用于校验问答系统引用准确性的工具，重点关注引用缺失、指错文档、内容不匹配等问题，并提供完整的人工复核、误判回滚、版本记录和报告导出功能。

## 核心功能

### 1. 数据导入
- 支持知识库文档导入（CSV/JSON/Excel）
- 支持问答记录导入（CSV/JSON/Excel）
- 支持逐条手动添加
- 示例数据位于 `examples/` 目录

### 2. 引用校验（基于轻量规则）
- **有效引用**：引用文本与知识库内容高度匹配（≥60%）
- **缺失引用**：回答中无引用或引用信息不完整
- **错误文档**：引用的文档在知识库中不存在
- **内容不匹配**：引用文本与知识库内容差异较大（<30%）
- **部分匹配**：需要人工复核的边界情况（30%-60%）

### 3. 人工复核
- 查看系统判定理由
- 对比引用文本与知识库原文
- 人工标记有效/无效
- 记录复核人信息和复核意见

### 4. 误判回滚
- 一键回滚最近一次复核操作
- 记录回滚原因
- 完整保留操作历史

### 5. 版本记录
- 追踪所有实体的创建、更新、回滚操作
- 记录操作人、操作时间、操作内容
- 支持查看完整变更历史

### 6. 报告导出
- 完整校验报告（JSON/CSV/Excel）
- 错误样本集合（JSON/CSV）
- 包含详细统计信息

## 技术栈

- **后端**：Node.js + Express
- **前端**：React + TypeScript + Vite
- **数据库**：SQLite (sql.js)
- **数据格式**：支持 CSV、JSON、Excel

## 快速开始

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
```

### 启动项目

```bash
# 启动后端（端口 3001）
npm run server

# 启动前端（端口 3000）
npm run client

# 或同时启动前后端
npm run dev
```

### 使用流程

1. **导入知识库**：进入「知识库」页面，上传 `examples/knowledge-base.json`
2. **导入问答记录**：进入「问答记录」页面，上传 `examples/qa-records.json`
3. **执行校验**：在概览页面点击「校验所有记录」
4. **人工复核**：在「校验结果」页面查看详情，对疑似误判的结果进行复核
5. **导出报告**：在「数据导出」页面导出完整报告或错误样本

## 示例数据说明

示例数据包含以下场景：

| 编号 | 问题 | 预期状态 | 说明 |
|------|------|----------|------|
| 1 | 标准套餐价格？ | 有效引用 | 引用正确 |
| 2 | 购买后可以退款吗？ | 有效引用 | 引用正确 |
| 3 | 企业版API限制？ | 内容不匹配 | 错误引用了标准套餐的限制 |
| 4 | 注册需要什么信息？ | 有效引用 | 引用正确 |
| 5 | 数据存在哪里？ | 内容不匹配 | 回答说在美国，实际在中国 |
| 6 | 支持哪些支付方式？ | 缺失引用 | 回答没有任何引用 |
| 7 | 有客服支持吗？ | 有效引用 | 引用正确 |

## API 接口

### 知识库
- `POST /api/knowledge-base` - 添加知识条目
- `POST /api/knowledge-base/import` - 批量导入
- `GET /api/knowledge-base` - 获取列表

### 问答记录
- `POST /api/qa-records` - 添加问答记录
- `POST /api/qa-records/import` - 批量导入
- `GET /api/qa-records` - 获取列表
- `GET /api/qa-records/:id` - 获取详情

### 校验
- `POST /api/validate/:qaRecordId` - 校验单条
- `POST /api/validate-all` - 校验全部
- `GET /api/validation-results` - 获取校验结果

### 复核与回滚
- `POST /api/review/:validationResultId` - 提交复核
- `POST /api/rollback/:validationResultId` - 回滚

### 导出
- `GET /api/export/report?format=json|csv|xlsx` - 导出报告
- `GET /api/export/error-samples?format=json|csv` - 导出错误样本

### 统计
- `GET /api/stats` - 获取统计数据
- `GET /api/version-history/:entityType/:entityId` - 获取版本历史

## 数据格式

### 知识库导入格式
```json
[
  {
    "document_id": "doc_001",
    "title": "产品定价规则",
    "content": "标准套餐价格为99元/月..."
  }
]
```

### 问答记录导入格式
```json
[
  {
    "question": "标准套餐多少钱？",
    "answer": "标准套餐价格为99元/月。",
    "citations": [
      {
        "document_id": "doc_001",
        "cited_text": "标准套餐价格为99元/月"
      }
    ]
  }
]
```

## 项目结构

```
.
├── server/                 # 后端代码
│   ├── database.js        # 数据库初始化和操作
│   ├── validator.js       # 校验核心逻辑
│   └── server.js          # API 路由
├── client/                # 前端代码
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── App.tsx        # 应用入口
│   │   ├── main.tsx       # React 入口
│   │   └── index.css      # 样式文件
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── examples/              # 示例数据
│   ├── knowledge-base.json
│   └── qa-records.json
├── data/                  # 数据库文件（运行时生成）
├── uploads/               # 上传临时目录
├── package.json
└── README.md
```

## 设计原则

1. **规则优先**：使用可解释的规则而非黑盒模型，便于理解和调试
2. **完整追踪**：所有操作都有版本记录，包括创建、修改、复核、回滚
3. **人工兜底**：规则判断无法覆盖的场景，提供便捷的人工复核流程
4. **数据驱动**：导出错误样本用于后续模型优化或规则改进

## License

MIT
