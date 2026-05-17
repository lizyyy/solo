# JSON Patch 预演报告

生成时间: 2026-05-17T04:47:49.291Z

## 摘要

- **处理文件**: 2 个
- **补丁总数**: 4 个
- **成功文件**: 2 个
- **有变更**: 2 个
- **错误**: 0 个
- **警告**: 0 个
- **冲突**: 0 个

---

## 文件: `test-data/configs/app1.json`

**状态**: ✅ 成功

### 🔄 变更详情

1. 🔄 **REPLACE** `/version`
   - 旧值: `"1.0.0"`
   - 新值: `"2.0.0"`

2. ➕ **ADD** `/features/3`
   - 新值: `"analytics"`

### 📝 补丁预览

```json
{
  "name": "my-app",
  "version": "2.0.0",
  "database": {
    "host": "localhost",
    "port": 5432,
    "credentials": {
      "username": "admin",
      "password": "secret"
    }
  },
  "features": [
    "auth",
    "logging",
    "monitoring",
    "analytics"
  ],
  "settings": {
    "debug": false,
    "maxConnections": 10
  }
}
```

### 📜 补丁列表

| # | 操作 | 路径 | 值 |
|---|------|------|----|
| 0 | replace | `/version` | "2.0.0" |
| 1 | add | `/features/-` | "analytics" |

---

## 文件: `test-data/configs/app2.json`

**状态**: ✅ 成功

### 🔄 变更详情

1. 🔄 **REPLACE** `/version`
   - 旧值: `"1.0.0"`
   - 新值: `"2.0.0"`

2. ➕ **ADD** `/features/3`
   - 新值: `"analytics"`

### 📝 补丁预览

```json
{
  "name": "my-app",
  "version": "2.0.0",
  "database": {
    "host": "localhost",
    "port": 5432,
    "credentials": {
      "username": "admin",
      "password": "secret"
    }
  },
  "features": [
    "auth",
    "logging",
    "monitoring",
    "analytics"
  ],
  "settings": {
    "debug": false,
    "maxConnections": 10
  }
}
```

### 📜 补丁列表

| # | 操作 | 路径 | 值 |
|---|------|------|----|
| 0 | replace | `/version` | "2.0.0" |
| 1 | add | `/features/-` | "analytics" |
