# 内容审核命令行工具

一个基于多模型评测和规则检测的内容审核命令行工具，支持人工修正、结果溯源、多格式导出等功能。

## 功能特性

- ✅ **多模型评测** - 集成多源模型进行风险评估
- 📋 **规则检测** - 敏感词、联系方式、暴力内容等规则匹配
- 👁️ **批量预览** - 先预览审核影响，再确认执行
- 📝 **人工修正** - 支持人工标注修正，保留修改记录
- 🔄 **重复检测** - 相同内容自动复用历史结论
- 📊 **多格式导出** - 支持 JSON、Markdown 格式报告
- 🔍 **多维查询** - 按处理人、状态、判定结果查询
- 📌 **溯源追踪** - 通过处理人可追溯原始输入和处理依据

## 安装

```bash
npm install
npm run build
npm link
```

## 使用说明

### 1. 预览审核结果
```bash
# 预览多模型评测样例
audit preview examples/multi-model-samples.json

# 预览规则过宽变体样例
audit preview examples/overreach-samples.json
```

### 2. 执行审核
```bash
# 执行审核（自动跳过重复内容）
audit run examples/multi-model-samples.json

# 强制重新审核（忽略重复）
audit run examples/multi-model-samples.json --force
```

### 3. 人工修正
```bash
# 修正审核结果（保留历史和备注）
audit correct <itemId> <handler> <newDecision> <remark>

# 示例：
audit correct sample-001 zhangsan pass "内容正常，误判"
```

### 4. 确认审核结果
```bash
# 无需修改时直接确认
audit confirm <itemId>
```

### 5. 查询审核记录
```bash
# 查询所有记录
audit query

# 按处理人查询
audit query --handler zhangsan

# 按状态查询 (pending/confirmed/corrected)
audit query --status corrected

# 按判定结果查询 (pass/reject/review)
audit query --decision reject

# 导出为JSON格式
audit query --format json --output results.json
```

### 6. 导出审核报告
```bash
# 导出单条记录报告
audit export <itemId> --format markdown --output report.md

# 导出全部记录
audit export all --format json --output all-reports.json
```

### 7. 查看统计
```bash
audit stats
```

## 审核判定说明

| 判定 | 说明 |
|------|------|
| ✅ PASS | 正常内容，审核通过 |
| ❌ REJECT | 违规内容，审核拒绝 |
| ⚠️ REVIEW | 存疑内容，需要人工审核 |

## 项目结构

```
.
├── src/
│   ├── types/              # 类型定义
│   ├── services/           # 业务服务
│   │   ├── AuditService.ts    # 核心审核逻辑
│   │   └── OutputService.ts   # 输出格式化
│   ├── storage/            # 数据存储
│   │   └── StorageService.ts  # 存储与查询
│   └── cli.ts              # 命令行入口
├── examples/               # 样例数据
│   ├── multi-model-samples.json   # 多模型评测样例
│   └── overreach-samples.json     # 规则过宽变体样例
├── data/                   # 数据存储目录
├── package.json
├── tsconfig.json
└── README.md
```

## 样例数据说明

### `multi-model-samples.json`
多源模型评测样例，包含：
- 正常通过的内容
- 包含联系方式的内容
- 包含违禁词的违规内容
- 正常的商品描述
- 包含暴力词汇的内容

### `overreach-samples.json`
检测规则过宽变体样例，用于测试：
- 多个联系方式同时出现的场景
- 正常商业信息被过度检测的场景
- 规则多重命中的边界情况

## 数据持久化

所有审核记录保存在 `data/audit-data.json`，包含：
- 多模型评测的完整结果
- 规则检测明细
- 人工修正记录（处理人、时间、备注）
- 内容哈希（用于重复检测）
- 处理状态和最终判定

## 开发

```bash
# 编译
npm run build

# 开发模式（使用 ts-node）
npm run dev -- preview examples/multi-model-samples.json
```
