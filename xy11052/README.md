# 便利店加盟督导巡店整改API

## 系统概述

本系统为便利店加盟督导巡店整改流程提供后端支持，具备以下核心能力：

- ✅ 批量导入整改项，支持真实便利店业务字段
- ✅ 坏行处理：包含原始字段、错误原因和处理建议
- ✅ 冲突检测：重复照片提交、相似问题检测
- ✅ 人工备注：冲突项可人工确认后继续推进
- ✅ 状态流转：严格的状态变更规则，防止越级操作

## 🚀 验收流程

### 三步完成验收，结果稳定可重复

```bash
# 1. 初始化数据库
npm run init

# 2. 启动API服务（可选，如需HTTP接口）
npm start

# 3. 运行完整验收测试（核心！）
npm test
```

## 测试覆盖场景

| 测试场景 | 验证点 |
|---------|-------|
| **正常单导入** | 3条完整有效数据全部导入成功 |
| **状态越级保护** | pending 不能直接到 approved |
| **状态流转** | pending → rectifying → submitted → approved |
| **详情查询** | 完整的问题信息和操作日志 |
| **冲突检测** | 重复照片URL自动检测并标记 |
| **冲突解决** | 人工备注后可正常推进状态 |
| **缺字段检测** | 必填字段为空时返回明确错误 |
| **日期格式验证** | deadline 必须是 YYYY-MM-DD 格式 |
| **分类验证** | 问题分类必须在允许范围内 |

## 业务字段说明

系统支持便利店巡店整改的真实业务字段：

| 字段 | 说明 | 示例值 |
|------|------|--------|
| `inspection_id` | 巡检单ID | INSPECT20240115001 |
| `store_id` | 门店ID | STORE001 |
| `store_name` | 门店名称 | 全家便利店(中关村店) |
| `problem_category` | 问题分类 | 环境卫生/商品陈列/服务规范/设备设施/消防安全/食品安全/价格标识 |
| `problem_type` | 问题类型 | 地面清洁/货架缺货/着装不规范 |
| `problem_description` | 问题描述 | 入门处地砖有明显污渍，约0.5平米 |
| `problem_location` | 问题位置 | 门店入口左侧区域 |
| `photo_url` | 问题照片 | https://example.com/photos/xxx.jpg |
| `requirement` | 整改要求 | 使用专用清洁剂彻底清除污渍 |
| `deadline` | 整改期限 | 2024-01-20 |
| `responsible_person` | 责任人 | 店长张三 |
| `inspector_id` | 督导ID | INS001 |
| `inspector_name` | 督导姓名 | 王督导 |
| `inspection_date` | 巡检日期 | 2024-01-15 |

## 坏行处理示例

导入缺字段数据时，返回详细错误信息：

```json
{
  "row": 1,
  "originalData": { /* 完整原始数据 */ },
  "errors": [
    {
      "field": "inspection_id",
      "reason": "字段[inspection_id]不能为空",
      "suggestion": "请补充inspection_id的有效信息后重新导入"
    }
  ]
}
```

## 冲突处理示例

检测到重复照片提交时，标记为冲突项：

```json
{
  "row": 1,
  "itemId": "uuid",
  "conflictType": "duplicate_photo",
  "conflictDetail": "该照片已在问题\"入门处地砖有明显污渍\"中使用，存在重复提交嫌疑",
  "suggestion": "请确认是否为同一问题，如需继续可人工备注说明原因"
}
```

调用 `/resolve-conflict` 接口，人工备注后可继续推进。

## 状态流转图

```
pending → rectifying → submitted → approved → closed
                          ↓
                        rejected
                          ↓
                       rectifying
```

## API 接口说明

### 导入整改项
```
POST /api/rectification/import
Content-Type: application/json

{
  "items": [/* 整改项数组 */]
}
```

### 解决冲突（人工备注）
```
POST /api/rectification/resolve-conflict
{
  "itemId": "整改项ID",
  "operatorId": "操作人ID",
  "operatorName": "操作人姓名",
  "remark": "备注说明"
}
```

### 更新状态
```
POST /api/rectification/update-status
{
  "itemId": "整改项ID",
  "newStatus": "rectifying",
  "operatorId": "操作人ID",
  "operatorName": "操作人姓名",
  "remark": "状态变更说明"
}
```

### 查询详情
```
GET /api/rectification/item/:itemId
```

## 项目结构

```
.
├── src/
│   ├── models/
│   │   ├── database.js          # 数据库连接和初始化
│   │   └── rectification.js     # 整改核心逻辑
│   ├── routes/
│   │   └── rectification.js     # API路由
│   ├── utils/
│   │   └── test-data.js         # 验收测试数据
│   └── server.js                # Express服务入口
├── scripts/
│   ├── init.js                  # 数据库初始化脚本
│   └── acceptance-test.js       # 完整验收测试
├── data/                        # SQLite数据库目录
└── package.json
```

## 验收标准

运行 `npm test` 后，必须满足：

- ✅ 9/9 测试全部通过
- ✅ 正常单3条全部导入成功
- ✅ 状态越级被正确拒绝
- ✅ 冲突检测生效
- ✅ 人工解决冲突后可继续
- ✅ 所有错误均包含原因和建议

---

**验收开始！执行 `npm run init && npm test` 即可验证系统。**