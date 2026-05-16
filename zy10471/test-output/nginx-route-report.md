# Nginx 路由冲突检测报告

生成时间: 2026-05-17 03:56:05

## 统计摘要

| 指标 | 数值 |
|------|------|
| Server 块数 | 1 |
| Location 规则数 | 8 |
| 检测到冲突 | 2 |
| 错误级冲突 | 0 |
| 警告级冲突 | 2 |

## Server 配置详情

### example.com

- 文件: `/Users/lzy/pro/solo/workspaces/zy10471/test-conf/example.conf`
- 监听: 80
- 域名: example.com
- Location 规则数: 8

#### Location 规则列表

| 优先级 | 匹配类型 | 规则 | 文件位置 |
|--------|----------|------|----------|
| 4 | exact | `= /health` | `example.conf:13` |
| 3 | regex_case_insensitive | `~* \.(jpg|jpeg|png|gif)$` | `example.conf:25` |
| 3 | regex_case_sensitive | `~ \.php$` | `example.conf:21` |
| 2 | prefix_no_regex | `^~ /static/` | `example.conf:17` |
| 1 | prefix | `/admin/api` | `example.conf:33` |
| 1 | prefix | `/api/v2` | `example.conf:9` |
| 1 | prefix | `/admin` | `example.conf:29` |
| 1 | prefix | `/api` | `example.conf:5` |

## 冲突详情

### 🟡 冲突 #1: subset

- **Server**: `example.com`
- **严重级别**: warning
- **影响**: 中 - 可能导致意外的路由行为
- **说明**: /api/v2 是 /api 的子集，请求时按配置顺序匹配

#### 涉及的 Location 规则

| # | 规则 | 匹配类型 | 优先级 | 文件位置 |
|---|------|----------|--------|----------|
| 1 | `/api` | prefix | 1 | `/Users/lzy/pro/solo/workspaces/zy10471/test-conf/example.conf:5` |
| 2 | `/api/v2` | prefix | 1 | `/Users/lzy/pro/solo/workspaces/zy10471/test-conf/example.conf:9` |

---

### 🟡 冲突 #2: subset

- **Server**: `example.com`
- **严重级别**: warning
- **影响**: 中 - 可能导致意外的路由行为
- **说明**: /admin/api 是 /admin 的子集，请求时按配置顺序匹配

#### 涉及的 Location 规则

| # | 规则 | 匹配类型 | 优先级 | 文件位置 |
|---|------|----------|--------|----------|
| 1 | `/admin` | prefix | 1 | `/Users/lzy/pro/solo/workspaces/zy10471/test-conf/example.conf:29` |
| 2 | `/admin/api` | prefix | 1 | `/Users/lzy/pro/solo/workspaces/zy10471/test-conf/example.conf:33` |

---

## 修复建议

### 对于被覆盖的规则 (shadowed)
- 检查是否确实需要该规则，如不需要可删除
- 如需保留，调整修饰符提高优先级 (如使用 `^~` 或 `=`)

### 对于相同路径的规则 (identical)
- 删除重复配置
- 合并配置内容

### 对于路径子集冲突 (subset)
- 将更具体的路径放在更一般的路径之前
- 使用 `=` 精确匹配修饰符提高优先级

### 对于正则表达式重叠 (regex_overlap)
- 简化正则表达式
- 使用 `^~` 前缀匹配阻止正则匹配

## Nginx Location 优先级参考

| 修饰符 | 类型 | 优先级 | 说明 |
|--------|------|--------|------|
| `=` | 精确匹配 | 4 | 最高优先级，完全匹配后停止搜索 |
| `^~` | 前缀匹配(禁用正则) | 3 | 匹配成功后不再检查正则 |
| `~` / `~*` | 正则匹配 | 2 | 按配置顺序匹配 |
| (无) | 前缀匹配 | 1 | 最长前缀优先 |
