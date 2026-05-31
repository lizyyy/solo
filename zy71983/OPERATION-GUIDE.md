# 报表导出限流 - 迁移清单操作指南

## 快速开始

### 1. 查看迁移清单
直接在浏览器打开 `migration-viewer.html` 即可查看完整的迁移清单和结论追踪。

### 2. 迁移清单样例放置
将迁移清单文件（如 Excel、CSV）上传后，在 `migration-data.json` 的 `sourceMaterials.migrationLists` 数组中添加记录：

```json
{
  "id": "ML003",
  "fileName": "your-migration-file.xlsx",
  "uploadTime": "2024-05-31T10:00:00",
  "uploader": "你的名字",
  "contentSummary": "文件内容简要说明",
  "isBackfill": false
}
```

**注意**：如果是后补材料，设置 `"isBackfill": true` 会在界面上明确标注。

### 3. 关联结论到来源材料
在 `conclusions` 数组中，每个结论通过 `sourceRefs` 关联依据：

```json
{
  "conclusionId": "C005",
  "content": "结论内容",
  "changeType": "CONCLUSION_CHANGE",
  "sourceRefs": [
    {
      "sourceType": "MIGRATION_LIST",
      "sourceId": "ML003",
      "sourcePath": "#source-ML003",
      "description": "简要说明"
    }
  ]
}
```

支持的 `sourceType`：
- `MIGRATION_LIST` - 迁移清单
- `ALARM_RECORD` - 报警记录  
- `OLD_DOCUMENT` - 旧接口文档
- `CLIENT_CHECK` - 客户端参数检查

## 变更类型说明

| 类型 | 标识 | 说明 |
|------|------|------|
| **结论变更** | `CONCLUSION_CHANGE` | 真实影响迁移结论的变更，需要重点关注 |
| **补材料** | `MATERIAL_SUPPLEMENT` | 仅补充参考材料，不影响结论本身 |
| **文档更新** | `DOCUMENT_UPDATE` | 旧接口文档手工改动，历史完整留存 |

## 旧客户端参数被破坏检查

### 在哪看
1. 打开 `migration-viewer.html`
2. 点击「🔧 客户端参数」标签页
3. **红色高亮** 且标注 `⚠️ 被破坏` 的参数即为异常

### 如何记录
在 `clientParams` 数组中：

```json
{
  "paramName": "export.maxConcurrent",
  "oldValue": "5",
  "newValue": "3",
  "isBroken": true,
  "checkTime": "2024-05-30T14:00:00"
}
```

- `isBroken: true` 表示参数值与预期不符，可能被意外修改
- 保留 `oldValue` 便于回溯原始配置

## 导出迁移报告前复核流程

### 复核清单（必须全部通过）

| 检查项 | 位置 | 说明 |
|--------|------|------|
| 迁移清单已核验 | 复核清单页 | 确认所有迁移清单完整且版本正确 |
| 报警记录已核验 | 复核清单页 | 确认报警记录真实且关联正确 |
| 客户端参数已检查 | 复核清单页 | 检查所有客户端参数是否被意外破坏 |
| 文档历史一致性 | 复核清单页 | 迁移报告与文档明细历史一致，无矛盾 |

### 执行复核命令

```bash
# 检查文档历史与迁移报告一致性
node document-history.js check-consistency DOC001 migration-data.json
```

输出示例：
```json
{
  "consistent": true,
  "inconsistencies": [],
  "totalManualChanges": 1
}
```

### 导出历史报告

```bash
# 导出 Markdown 格式的文档历史报告
node document-history.js export DOC001 markdown
```

## 旧接口文档手工改动历史记录

### 记录文档变更

```bash
# 1. 添加新文档（首次）
node document-history.js add DOC001 "报表导出API文档 v1.0"

# 2. 记录手工修改
node document-history.js change DOC001 "张三" "rate_limit字段" "未定义" "每小时5次" "根据迁移结论更新文档"
```

### 查看变更历史

```bash
# 查看完整历史
node document-history.js history DOC001

# 比较两个版本差异
node document-history.js diff DOC001 1 2
```

### 确保一致性的关键

1. **修改文档前**：先在迁移结论中记录 `DOCUMENT_UPDATE` 类型的变更
2. **修改文档时**：使用 `document-history.js` 记录变更
3. **修改文档后**：运行一致性检查确保两边同步

## 文件说明

| 文件名 | 用途 |
|--------|------|
| `migration-schema.json` | 数据结构定义，确保格式统一 |
| `migration-viewer.html` | 可视化查看器，支持链接跳转 |
| `migration-data.json` | 实际迁移数据（复制 example 后修改） |
| `migration-data-example.json` | 示例数据，参考格式 |
| `document-history.js` | 文档历史管理工具 |
| `OPERATION-GUIDE.md` | 本操作指南 |

## 常见问题

### Q: 报警记录晚补怎么办？
A: 在报警记录条目中设置 `"isBackfill": true`，界面会自动标注「晚补记录」。

### Q: 迁移清单早到但还没出结论怎么办？
A: 先录入迁移清单，等结论确定后，在结论的 `sourceRefs` 中关联即可。

### Q: 如何区分真实修改和补材料？
A: 通过 `changeType` 区分，查看器用不同颜色标识：
- 🟠 **结论变更** - 真实修改
- 🔵 **补材料** - 仅补充
- 🟢 **文档更新** - 文档改动

### Q: 接手时不知道谁改过怎么办？
A: 每条结论和每个文档变更都记录了 `operator`（操作人）和 `timestamp`（时间），一目了然。
