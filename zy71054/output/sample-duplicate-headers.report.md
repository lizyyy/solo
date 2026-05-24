# CSV 修复报告

> 生成时间: 2026/5/24 18:57:03

## 📁 文件信息

| 项目 | 值 |
|------|-----|
| 文件名 | sample-duplicate-headers.csv |
| 完整路径 | /Users/lzy/pro/solo/workspaces/zy71054/tests/sample-duplicate-headers.csv |
| 处理状态 | ✅ 成功 |
| 退出码 | 0 |

## 🔍 检测结果

| 项目 | 值 |
|------|-----|
| 编码格式 | UTF-8  |
| 编码置信度 | 100.0% |
| 分隔符 | , (逗号) |

### 编码候选列表

| 编码 | 置信度 |
|------|--------|
| UTF-8 | 100.0% |

## 📈 统计信息

| 项目 | 值 |
|------|-----|
| 总行数 | 4 |
| 正常记录 | 2 |
| 坏记录 | 0 |
| 坏记录率 | 0.0% |
| 表头数量 | 6 |

## 🏷️ 表头信息

### 原始表头

1. id  
2. name  
3. email  
4. phone  
5. name  
6. email

### 处理后表头

1. id  
2. name  
3. email  
4. phone  
5. name_1  
6. email_1

## ⚠️ 警告信息

- **duplicate_headers**: 发现 2 个重复表头
  - 重复表头 "name" 出现在列 2 和 5
  - 重复表头 "email" 出现在列 3 和 6

## 📋 数据预览

| id | name | email | phone | name_1 | email_1 |
|---|---|---|---|---|---|
| 1 | 张三 | zhangsan@test.com | 13800138000 | 张先生 | zhang@example.com |
| 2 | 李四 | lisi@test.com | 13900139000 | 李先生 | li@example.com |

---

*本报告由 CSV Fixer CLI 自动生成*