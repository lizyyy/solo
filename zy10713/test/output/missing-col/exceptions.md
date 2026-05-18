# 机器人消息样本模板灰度差异 - 异常报告

> 生成工具: 机器人消息样本模板灰度差异CLI
> 生成时间: 2026/5/18 16:44:22

## 一、解析错误

### 旧版本解析错误

#### MISSING_REQUIRED_FIELDS
- 文件: test/data/missing-col/old/bad_data.csv
- 描述: 缺少必需字段: variables
- 缺失字段: variables

## 二、解析警告

✅ 无解析警告

## 三、需关注的业务差异

共 1 个关键差异需要关注:

### TOUCH_STATUS_CHANGED
- 模板: 周报提醒 (TPL_002)
- 群: 运营部主群 (CHAT_001)
- 描述: 触达状态变化: 周报提醒 -> 运营部主群: pending → success
- 旧状态: pending
- 新状态: success
