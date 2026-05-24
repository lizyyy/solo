# Kafka Topic 配额报告

> 生成时间: 2026-05-24T20:36:45.755528

## 输入文件

- **topics**: `examples/topics.yaml`
- **teams**: `examples/teams.yaml`

## 📊 总览

| 指标 | 数值 |
|------|------|
| Topic 总数 | 14 |
| 已分配团队 | 12 |
| 未分配团队 | 2 |
| 总分区数 | 258 |

## ⚠️ 异常汇总

| 等级 | 数量 |
|------|------|
| 🔴 CRITICAL | 0 |
| 🟠 ERROR | 3 |
| 🟡 WARNING | 2 |
| 🔵 INFO | 16 |

## 👥 团队配额详情

### 推荐系统

#### 配额使用情况

| 指标 | 数值 |
|------|------|
| Topic 数量 | 3 |
| 总分区数 | 136 |
| 分区配额 | 500 |
| 使用率 | 27.2% |

#### Topic 列表

| Topic | 分区 | 保留时间 | 异常数 |
|-------|------|----------|--------|
| rec.item.rank | 24 | 3d | 1 |
| rec.realtime.feed | 64 | 2d | 3 |
| rec.user.interest | 48 | 7d | 2 |

### 支付系统

#### 配额使用情况

| 指标 | 数值 |
|------|------|
| Topic 数量 | 3 |
| 总分区数 | 36 |
| 分区配额 | 100 |
| 使用率 | 36.0% |

#### Topic 列表

| Topic | 分区 | 保留时间 | 异常数 |
|-------|------|----------|--------|
| pay.order.created | 6 | 60d | 1 |
| pay.refund.request | 6 | 90d | 1 |
| pay.transaction.success | 24 | 90d | 3 |

### 数据平台

#### 配额使用情况

| 指标 | 数值 |
|------|------|
| Topic 数量 | 4 |
| 总分区数 | 56 |
| 分区配额 | 200 |
| 使用率 | 28.0% |

#### Topic 列表

| Topic | 分区 | 保留时间 | 异常数 |
|-------|------|----------|--------|
| dp.event.stream | 32 | 3d | 3 |
| dp.page.view | 6 | 30d | 1 |
| dp.user.click | 6 | 7d | 0 |
| dp.user.login | 12 | 14d | 2 |

### 用户中心

#### 配额使用情况

| 指标 | 数值 |
|------|------|
| Topic 数量 | 2 |
| 总分区数 | 18 |
| 分区配额 | 150 |
| 使用率 | 12.0% |

#### Topic 列表

| Topic | 分区 | 保留时间 | 异常数 |
|-------|------|----------|--------|
| user.activity.log | 12 | 14d | 2 |
| user.profile.updated | 6 | 7d | 0 |

## ❓ 未分配团队的Topic

- `orphan.topic.no.team` (分区: 6, 保留: 365d)
- `unknown.mystery.topic` (分区: 6, 保留: 7d)

## 📋 异常详情

### 🟠 ERROR

- **dp.event.stream** - `PARTITIONS_EXCEED_PER_TOPIC`: 分区数 32 超过单Topic限制 24
- **rec.realtime.feed** - `PARTITIONS_EXCEED_PER_TOPIC`: 分区数 64 超过单Topic限制 48
- **pay.transaction.success** - `PARTITIONS_EXCEED_PER_TOPIC`: 分区数 24 超过单Topic限制 12

### 🟡 WARNING

- **unknown.mystery.topic** - `NO_TEAM_ASSIGNED`: 无法匹配所属团队
- **orphan.topic.no.team** - `NO_TEAM_ASSIGNED`: 无法匹配所属团队

### 🔵 INFO

- **dp.user.login** - `NON_STANDARD_PARTITIONS`: 分区数 12 不符合团队默认值 6
- **dp.user.login** - `NON_STANDARD_RETENTION`: 保留时间 14d 不符合团队默认值 7d
- **dp.page.view** - `NON_STANDARD_RETENTION`: 保留时间 30d 不符合团队默认值 7d
- **dp.event.stream** - `NON_STANDARD_PARTITIONS`: 分区数 32 不符合团队默认值 6
- **dp.event.stream** - `NON_STANDARD_RETENTION`: 保留时间 3d 不符合团队默认值 7d
- **rec.item.rank** - `NON_STANDARD_PARTITIONS`: 分区数 24 不符合团队默认值 12
- **rec.user.interest** - `NON_STANDARD_PARTITIONS`: 分区数 48 不符合团队默认值 12
- **rec.user.interest** - `NON_STANDARD_RETENTION`: 保留时间 7d 不符合团队默认值 3d
- **rec.realtime.feed** - `NON_STANDARD_PARTITIONS`: 分区数 64 不符合团队默认值 12
- **rec.realtime.feed** - `NON_STANDARD_RETENTION`: 保留时间 2d 不符合团队默认值 3d
- **pay.order.created** - `NON_STANDARD_RETENTION`: 保留时间 60d 不符合团队默认值 7d
- **pay.transaction.success** - `NON_STANDARD_PARTITIONS`: 分区数 24 不符合团队默认值 6
- **pay.transaction.success** - `NON_STANDARD_RETENTION`: 保留时间 90d 不符合团队默认值 7d
- **pay.refund.request** - `NON_STANDARD_RETENTION`: 保留时间 90d 不符合团队默认值 7d
- **user.activity.log** - `NON_STANDARD_PARTITIONS`: 分区数 12 不符合团队默认值 6
- **user.activity.log** - `NON_STANDARD_RETENTION`: 保留时间 14d 不符合团队默认值 7d
