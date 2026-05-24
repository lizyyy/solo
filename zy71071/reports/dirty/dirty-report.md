# 会议室冲突检测报告

**生成时间**: 2026-05-24 20:32:52 (GMT+8)
**时区**: Asia/Shanghai

## 执行摘要

| 指标 | 数值 |
|------|------|
| 解析事件总数 | 12 |
| 有效事件数 | 11 |
| 取消事件数 | 1 |
| 发现冲突数 | 6 |
| 取消未生效 | 1 |

## 冲突类型统计

- **时间重叠**: 3 个
- **跨天会议**: 2 个
- **隐藏冲突**: 1 个

## 冲突严重程度

- 🔴 **高**: 2 个
- 🟡 **中**: 3 个
- 🟢 **低**: 2 个

## 按会议室分类

### 🔴 会议室A - 3F

- 事件数: 4
- 冲突数: 2

#### 冲突详情

##### 1. 时间重叠 - 🔴 高

**描述**: Events overlap by 30 minutes

```
Overlap Duration: 30 minutes
Event A: "周例会 - 会议室A" (2026-06-02 09:00 - 10:00)
Event B: "冲突会议1 - 会议室A" (2026-06-02 09:30 - 10:30)
Location A: 会议室A - 3F
Location B: 会议室A - 3F
Organizer A: zhangsan@example.com
Organizer B: lisi@example.com
```

##### 2. 时间重叠 - 🟢 低

**描述**: Events overlap by 5 minutes

```
Overlap Duration: 5 minutes
Event A: "冲突会议1 - 会议室A" (2026-06-02 09:30 - 10:30)
Event B: "5分钟小会议 - 会议室A" (2026-06-02 10:00 - 10:05)
Location A: 会议室A - 3F
Location B: 会议室A - 3F
Organizer A: lisi@example.com
Organizer B: wangwu@example.com
```

### 🔴 会议室B - 2F

- 事件数: 1
- 冲突数: 1

#### 冲突详情

##### 1. 跨天会议 - 🟡 中

**描述**: Event spans 2 days

```
Days Spanned: 2
Local Start: 2026-06-02 22:00:00 (GMT+8)
Local End: 2026-06-03 02:00:00 (GMT+8)
Event: "跨天会议 - 会议室B"
Location: 会议室B - 2F
Organizer: wangwu@example.com
```

### 🔴 大会议室 - 5F

- 事件数: 2
- 冲突数: 3

#### 冲突详情

##### 1. 时间重叠 - 🔴 高

**描述**: Events overlap by 60 minutes

```
Overlap Duration: 60 minutes
Event A: "全天培训日 - 大会议室" (2026-06-03 00:00 - 00:00)
Event B: "隐藏冲突会议 - 大会议室" (2026-06-03 10:00 - 11:00)
Location A: 大会议室 - 5F
Location B: 大会议室 - 5F
Organizer A: hr@example.com
Organizer B: zhaoliu@example.com
```

##### 2. 跨天会议 - 🟡 中

**描述**: Event spans 2 days

```
Days Spanned: 2
Local Start: 2026-06-03 00:00:00 (GMT+8)
Local End: 2026-06-04 00:00:00 (GMT+8)
Event: "全天培训日 - 大会议室"
Location: 大会议室 - 5F
Organizer: hr@example.com
```

##### 3. 隐藏冲突 - 🟡 中

**描述**: Regular event scheduled during all-day event

```
All-day event date: 2026-06-03
Regular event time: 2026-06-03 10:00
All-day: "全天培训日 - 大会议室"
Regular: "隐藏冲突会议 - 大会议室"
Note: All-day events may indicate room is reserved for entire day
```

### ✅ 虚拟会议室

- 事件数: 2
- 冲突数: 0

### ✅ 会议室C - 4F

- 事件数: 2
- 冲突数: 0

## 取消未生效报告

### 1. 已取消的过去会议

**位置**: 会议室A - 3F
**组织者**: zhangsan@example.com
**时间**: 2026-05-20 09:00 - 10:00
**严重程度**: 🟢 低

```
Event: "已取消的过去会议"
Location: 会议室A - 3F
Organizer: zhangsan@example.com
Scheduled Time: 2026-05-20 09:00:00 (GMT+8) - 2026-05-20 10:00:00 (GMT+8)
Last Modified: 2026-05-20 23:00:00 (GMT+8)
Sequence: 2
⚠️  WARNING: This event has already ended
   Cancellation was recorded AFTER the event ended
```

---

*报告由 iCal Meeting Conflict CLI 生成*