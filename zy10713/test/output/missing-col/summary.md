# 机器人消息样本模板灰度差异报告

> 生成工具: 机器人消息样本模板灰度差异CLI
> 生成时间: 2026/5/18 16:44:22
> 版本: 1.0.0

## 一、总体概览

| 指标 | 旧版本 | 新版本 | 差异 |
|------|--------|--------|------|
| 总记录数 | 2 | 6 | +4 |
| 差异总数 | - | - | 10 |

## 二、差异类型分布

| 差异类型 | 数量 | 说明 |
|----------|------|------|
| VARIABLE_ADDED | 5 | 新增模板变量 |
| TOUCH_STATUS_CHANGED | 1 | 触达状态发生变化 |
| NEW_RECORD_ADDED | 4 | 新版本新增记录 |

## 三、触达状态统计

| 触达状态 | 旧版本 | 新版本 | 差异 |
|----------|--------|--------|------|
| success | 1 | 6 | +5 |
| pending | 1 | 0 | -1 |

## 四、模板维度差异

### 活动运营通知 (TPL_001)
- 差异总数: 4
- 差异分布:
  - VARIABLE_ADDED: 3
  - NEW_RECORD_ADDED: 1

### 周报提醒 (TPL_002)
- 差异总数: 4
- 差异分布:
  - TOUCH_STATUS_CHANGED: 1
  - VARIABLE_ADDED: 2
  - NEW_RECORD_ADDED: 1

### 数据日报 (TPL_003)
- 差异总数: 1
- 差异分布:
  - NEW_RECORD_ADDED: 1

### 新用户欢迎 (TPL_004)
- 差异总数: 1
- 差异分布:
  - NEW_RECORD_ADDED: 1

## 五、群维度差异

### 运营部主群 (CHAT_001)
- 差异总数: 7
- 差异分布:
  - VARIABLE_ADDED: 5
  - TOUCH_STATUS_CHANGED: 1
  - NEW_RECORD_ADDED: 1

### 市场部工作群 (CHAT_002)
- 差异总数: 1
- 差异分布:
  - NEW_RECORD_ADDED: 1

### 技术研发群 (CHAT_004)
- 差异总数: 1
- 差异分布:
  - NEW_RECORD_ADDED: 1

### 新人群 (CHAT_005)
- 差异总数: 1
- 差异分布:
  - NEW_RECORD_ADDED: 1
