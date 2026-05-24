# 字体资产授权审计报告

> 生成时间: 2026/5/24 22:14:25
> 工具版本: 1.0.0
> 项目目录: /Users/lzy/pro/solo/workspaces/zy71068/self-test-output/test-data

## 📊 审计摘要

| 指标 | 数值 |
|------|------|
| 字体文件数 | 6 |
| 字体引用数 | 5 |
| 授权记录数 | 2 |
| 缺失授权 | 0 |
| 远程字体 | 1 |
| 版本冲突 | 1 |
| 过期授权 | 1 |

## ⚠️ 风险统计

| 风险等级 | 数量 |
|----------|------|
| 🔴 CRITICAL | 1 |
| 🟠 HIGH | 0 |
| 🟡 MEDIUM | 2 |
| 🔵 LOW | 1 |
| ⚪ INFO | 1 |

## 🚨 风险详情

### 🔴 CRITICAL: expired_license

字体 "Open Sans" 的授权已过期 1970 天

**详细信息:**
```json
{
  "licenseType": "SIL OFL",
  "expiredDays": 1970
}
```

### 🟡 MEDIUM: remote_font

检测到 1 个远程字体引用，需要确认是否符合授权条款

**详细信息:**
```json
{
  "remoteFontCount": 1
}
```

### 🟡 MEDIUM: version_conflict

字体 "roboto" 存在多个版本: unknown, 2.0.0, 1.0.0

**详细信息:**
```json
{
  "familyName": "roboto",
  "versions": [
    "unknown",
    "2.0.0",
    "1.0.0"
  ]
}
```

### 🔵 LOW: unmatched_reference

字体引用 "Remote Font" 未找到对应的本地字体文件

**详细信息:**
```json
{
  "familyName": "Remote Font"
}
```

### ⚪ INFO: compliance

所有字体都有对应的授权记录

## 📁 字体文件清单

| 字体名称 | 格式 | 大小 | 版本 | 字重 | 样式 |
|----------|------|------|------|------|------|
| OpenSans | WOFF2 | 100 B | - | 400 | - |
| OpenSans | WOFF | 100 B | - | 700 | - |
| Roboto | TTF | 100 B | - | 400 | - |
| Roboto | TTF | 100 B | 2.0.0 | - | italic |
| Roboto | TTF | 100 B | 1.0.0 | - | italic |
| Roboto | TTF | 100 B | - | 700 | - |

## 🔗 字体引用清单

| 字体名称 | 来源 | 类型 | 格式 | 远程 |
|----------|------|------|------|------|
| Roboto | css | 本地 | - | ❌ |
| Roboto | css | 本地 | - | ❌ |
| Open Sans | css | 本地 | woff2, woff | ❌ |
| Inline Font | inline | 本地 | woff | ❌ |

## ❓ 未匹配的引用

- `Remote Font` in `css/styles.css`

## 📜 授权清单

| 字体名称 | 授权类型 | 有效期至 | 状态 |
|----------|----------|----------|------|
| Roboto | Apache 2.0 | 2099/12/31 | ✅ |
| Open Sans | SIL OFL | 2020/12/31 | ❌ |

---

*本报告由 font-license-audit 工具自动生成*
