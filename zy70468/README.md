# 多仓库变更索引命令行工具 (MRC)

基于高峰发票红冲记录的多仓库变更索引管理系统，支持异常路径检测、人工修正、审批节点回查等功能。

## 功能特性

- ✅ **多维度查询**: 按批次、操作者、风险类型、状态过滤
- ✅ **人工修正**: 保留修正前后值和备注，不直接覆盖
- ✅ **失败路径检测**: 围绕压缩包路径异常展开多种失败场景
- ✅ **多格式导出**: 支持 JSON、Markdown 格式导出
- ✅ **短信清单**: 导出结果包含短信发送清单修正记录
- ✅ **审批节点回查**: 支持按审批节点追溯修正历史
- ✅ **数据持久化**: 本地重启后数据不丢失（SQLite 存储）

## 安装

```bash
npm install
npm run build
npm link
```

## 快速开始

### 1. 初始化样例数据

```bash
mrc init
```

样例数据包含以下压缩包路径异常场景：
- 非法字符路径
- 路径遍历攻击风险（`../`）
- 中文空格路径
- 文件不存在路径

### 2. 查看所有批次

```bash
mrc batches
```

### 3. 查询变更记录

```bash
# 查看所有记录
mrc list

# 按操作者过滤
mrc list -o 张三

# 按风险类型过滤
mrc list -r compression_path_error

# 按状态过滤
mrc list -s failed

# 组合过滤
mrc list -o 李四 -r compression_path_error
```

### 4. 查看记录详情

```bash
mrc detail -i <记录ID>
```

### 5. 人工修正记录

```bash
mrc correct \
  -i <记录ID> \
  -f archivePath \
  -o "/data/temp/未命名文件夹 1.zip" \
  -n "/data/archives/202401/corrected_file.zip" \
  -O 管理员 \
  -m "路径规范化处理，移除中文空格" \
  -a pre_check
```

### 6. 导出数据

```bash
# 导出 JSON 格式
mrc export -f json

# 导出 Markdown 格式
mrc export -f md

# 按批次导出
mrc export -f md -b <批次ID>

# 指定输出目录
mrc export -f json -o ./exports
```

### 7. 审批节点回查

```bash
# 查看可用审批节点
mrc history

# 按节点回查修正历史
mrc history -n pre_check
```

### 8. 查看枚举值

```bash
# 查看所有风险类型
mrc risk-types

# 查看所有处理状态
mrc statuses
```

## 数据模型

### 变更记录 (ChangeRecord)
- `id`: 唯一标识
- `batchId`: 批次ID
- `invoiceNumber`: 发票号
- `originalAmount`: 原金额
- `redFlushAmount`: 红冲金额
- `archivePath`: 归档路径
- `operator`: 操作人
- `riskType`: 风险类型
- `status`: 处理状态
- `currentApprovalNode`: 当前审批节点
- `failureReason`: 失败原因
- `materialSummary`: 材料摘要
- `smsRecords`: 短信发送清单

### 人工修正 (ManualCorrection)
- `id`: 唯一标识
- `recordId`: 关联记录ID
- `fieldName`: 修正字段
- `oldValue`: 原值
- `newValue`: 新值
- `operator`: 操作人
- `remark`: 备注
- `approvalNode`: 审批节点
- `correctedAt`: 修正时间

### 批次 (Batch)
- `id`: 唯一标识
- `name`: 批次名称
- `totalRecords`: 总记录数
- `successCount`: 成功数
- `failedCount`: 失败数
- `operator`: 操作人
- `createdAt`: 创建时间
- `completedAt`: 完成时间

## 枚举值

### 风险类型 (RiskType)
- `compression_path_error`: 压缩包路径错误
- `data_inconsistency`: 数据不一致
- `processing_timeout`: 处理超时
- `format_error`: 格式错误
- `duplicate_record`: 重复记录
- `manual_review_required`: 需要人工审核

### 处理状态 (ProcessingStatus)
- `pending`: 待处理
- `processing`: 处理中
- `success`: 成功
- `failed`: 失败
- `manual_corrected`: 已人工修正

### 审批节点 (ApprovalNode)
- `upload`: 上传
- `pre_check`: 预审
- `data_extraction`: 数据提取
- `risk_assessment`: 风险评估
- `final_review`: 终审
- `completed`: 完成

## 项目结构

```
.
├── src/
│   ├── cli.ts                  # CLI 入口
│   ├── types/
│   │   └── index.ts            # 类型定义
│   ├── db/
│   │   └── index.ts            # 数据库层
│   ├── services/
│   │   └── changeIndexService.ts  # 业务逻辑
│   └── data/
│       └── sampleData.ts       # 样例数据
├── package.json
├── tsconfig.json
└── README.md
```

## 技术栈

- **Node.js** + **TypeScript**
- **SQLite** (better-sqlite3) - 数据持久化
- **Commander** - CLI 框架

## 注意事项

1. 数据存储在当前目录下的 `change-index.json` 文件中
2. 人工修正不会直接覆盖系统原始判断，所有修正都会记录在案
3. 导出结果包含完整的短信发送清单和修正前后对比
4. 支持按审批节点追溯修正历史，便于审计和回溯
