# REST 分页一致性检查报告

**生成时间**: 5/17/2026, 11:44:22 PM
**OpenAPI 文件**: `/Users/lzy/pro/solo/workspaces/zy10584/example-openapi.yaml`

## 📊 概览统计

| 指标 | 数值 |
|------|------|
| 总接口数 | 4 |
| 分页接口数 | 3 |
| 存在问题的接口数 | **1** |
| 严重错误数 | 🔴 2 |
| 警告数 | 🟡 3 |
| 提示数 | 🔵 0 |

## 🔴 严重问题详情

### 🔴 缺少分页参数: pageSize

- **位置**: `get /api/products`
- **期望命名**: `pageSize`, `size`, `per_page`, `limit`, `count`
- **建议**: 建议添加 pageSize 参数

### 🔴 缺少总数字段: total

- **位置**: `get /api/products`
- **期望命名**: `total`, `totalCount`, `total_count`, `totalElements`
- **建议**: 建议添加 total 字段


## 🟡 警告详情

### 🟡 分页参数命名不一致: "pageNum" (期望 "page")

- **位置**: `get /api/orders`
- **参数**: `pageNum`
- **期望命名**: `page`
- **实际命名**: `pageNum`
- **建议**: 建议重命名为 page

### 🟡 分页参数命名不一致: "limit" (期望 "pageSize")

- **位置**: `get /api/orders`
- **参数**: `limit`
- **期望命名**: `pageSize`
- **实际命名**: `limit`
- **建议**: 建议重命名为 pageSize

### 🟡 数据列表字段命名不一致: "items" (期望 "data")

- **位置**: `get /api/products`
- **字段**: `items`
- **期望命名**: `data`
- **实际命名**: `items`
- **建议**: 建议重命名为 data


## 📋 需要修复的接口列表

| 接口 | 错误数 | 警告数 | 问题描述 |
|------|--------|--------|----------|
| `GET /api/products` | 2 | 1 | 缺少分页参数: pageSize; 缺少总数字段: total |

## 📑 所有分页接口详情

| 接口 | 分页参数 | 响应字段 | 状态 |
|------|----------|----------|------|
| `GET /api/users` | `page, pageSize` | `data, total` | ✅ 正常 |
| `GET /api/orders` | `pageNum, limit` | `data, total` | 🟡 有警告 |
| `GET /api/products` | `page` | `items` | 🔴 有错误 |

## ⚙️ 检查配置

### 期望的分页参数命名
- 页码: `page`, `pageNum`, `page_number`, `current`
- 页大小: `pageSize`, `size`, `per_page`, `limit`, `count`

### 期望的响应字段命名
- 数据列表: `data`, `items`, `list`, `records`, `rows`
- 总数: `total`, `totalCount`, `total_count`, `totalElements`
- 页码: `page`, `pageNum`, `current`, `page_number`
- 页大小: `pageSize`, `size`, `per_page`, `limit`
- 总页数: `totalPages`, `pages`, `page_count`, `total_pages`
