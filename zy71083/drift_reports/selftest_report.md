# Ansible Inventory 漂移检测报告

**生成时间**: 2026-05-24 23:03:27

## 📊 概览

| 来源 | 主机数量 |
|------|----------|
| Inventory | 5 |
| CMDB | 4 |

## ⚠️ 风险等级汇总

| 风险等级 | 数量 |
|----------|------|
| 🔴 CRITICAL | 1 |
| 🟠 HIGH | 2 |
| 🟡 MEDIUM | 2 |
| 🟢 LOW | 3 |

## 📋 漂移类型统计

| 漂移类型 | 数量 | 说明 |
|----------|------|------|
| label_mismatch | 3 | 标签不一致 |
| role_mismatch | 1 | 角色标签不一致 |
| environment_mismatch | 1 | 环境标签不一致 |
| missing_in_cmdb | 1 | CMDB 缺失 |
| decommissioned_still_present | 1 | 退役主机残留 |
| missing_in_inventory | 1 | Inventory 缺失 |

## 🔍 问题详情

### 🔴 1. web02-prod - 环境标签不一致

- **风险等级**: CRITICAL
- **漂移类型**: environment_mismatch
- **描述**: 环境标签不一致: Inventory='production', CMDB='staging' - 这是高风险问题！
- **Inventory 值**: `production`
- **CMDB 值**: `staging`

### 🟠 2. app01-stg - CMDB 缺失

- **风险等级**: HIGH
- **漂移类型**: missing_in_cmdb
- **描述**: 主机 'app01-stg' 在 Inventory 中存在，但在 CMDB 中找不到
- **Inventory 值**: `app01-stg`

### 🟠 3. web02-prod - 角色标签不一致

- **风险等级**: HIGH
- **漂移类型**: role_mismatch
- **描述**: 角色标签不一致: Inventory=['web'], CMDB=['database']
- **Inventory 值**:
  ```json
  [
  "web"
]
  ```
- **CMDB 值**:
  ```json
  [
  "database"
]
  ```
- **详细信息**:
  ```json
  {
  "missing_in_inventory": [
    "database"
  ],
  "missing_in_cmdb": [
    "web"
  ]
}
  ```

### 🟡 4. new-server-01 - Inventory 缺失

- **风险等级**: MEDIUM
- **漂移类型**: missing_in_inventory
- **描述**: 主机 'new-server-01' 在 CMDB 中存在，但在 Inventory 中找不到
- **CMDB 值**: `new-server-01`

### 🟡 5. old-server-deprecated - 退役主机残留

- **风险等级**: MEDIUM
- **漂移类型**: decommissioned_still_present
- **描述**: 主机 'old-server-deprecated' 已标记为退役，但仍存在于 Inventory 中
- **Inventory 值**: `old-server-deprecated`

### 🟢 6. db01-prod - 标签不一致

- **风险等级**: LOW
- **漂移类型**: label_mismatch
- **描述**: 存在 3 个标签不一致
- **Inventory 值**:
  ```json
  {
  "ansible_host": "192.168.1.20",
  "env": "production",
  "region": "cn-north-1",
  "role": "database"
}
  ```
- **CMDB 值**:
  ```json
  {
  "hostname": "db01-prod",
  "ip": "192.168.1.20",
  "role": "db",
  "environment": "production",
  "status": "active"
}
  ```
- **详细信息**:
  ```json
  {
  "mismatched_labels": {
    "ansible_host": {
      "inventory": "192.168.1.20",
      "cmdb": null
    },
    "status": {
      "inventory": null,
      "cmdb": "active"
    },
    "region": {
      "inventory": "cn-north-1",
      "cmdb": null
    }
  }
}
  ```

### 🟢 7. web01-prod - 标签不一致

- **风险等级**: LOW
- **漂移类型**: label_mismatch
- **描述**: 存在 3 个标签不一致
- **Inventory 值**:
  ```json
  {
  "ansible_host": "192.168.1.10",
  "env": "production",
  "region": "cn-north-1",
  "role": "web"
}
  ```
- **CMDB 值**:
  ```json
  {
  "hostname": "web01-prod",
  "ip": "192.168.1.10",
  "role": "www",
  "environment": "prod",
  "status": "active"
}
  ```
- **详细信息**:
  ```json
  {
  "mismatched_labels": {
    "ansible_host": {
      "inventory": "192.168.1.10",
      "cmdb": null
    },
    "status": {
      "inventory": null,
      "cmdb": "active"
    },
    "region": {
      "inventory": "cn-north-1",
      "cmdb": null
    }
  }
}
  ```

### 🟢 8. web02-prod - 标签不一致

- **风险等级**: LOW
- **漂移类型**: label_mismatch
- **描述**: 存在 3 个标签不一致
- **Inventory 值**:
  ```json
  {
  "ansible_host": "192.168.1.11",
  "role": "web",
  "env": "production",
  "region": "cn-north-1"
}
  ```
- **CMDB 值**:
  ```json
  {
  "hostname": "web02-prod",
  "ip": "192.168.1.11",
  "role": "database",
  "environment": "staging",
  "status": "active"
}
  ```
- **详细信息**:
  ```json
  {
  "mismatched_labels": {
    "ansible_host": {
      "inventory": "192.168.1.11",
      "cmdb": null
    },
    "status": {
      "inventory": null,
      "cmdb": "active"
    },
    "region": {
      "inventory": "cn-north-1",
      "cmdb": null
    }
  }
}
  ```

## 💡 建议措施

1. 【紧急】存在 1 个严重问题，包括环境不一致或别名冲突，请立即处理！
2. 环境标签不一致可能导致运维脚本跑错机器，请核对 Inventory 和 CMDB 的环境配置。
3. 有 1 台主机未录入 CMDB，建议补充 CMDB 记录或从 Inventory 移除退役主机。
4. 有 1 台已退役主机仍在 Inventory 中，建议清理。
5. 有 1 台主机角色不一致，这可能影响运维剧本的执行目标。

---
*本报告由 inventory-drift 工具自动生成*