# 社区志愿者站志愿签到公示 CLI

社区志愿者签到数据自动化审核与公示工具，帮助社区工作者快速完成签到数据核验，留下状态和证据。

## 功能特性

- ✅ **迟到检测**：根据规定时间和宽限分钟数自动识别迟到人员
- ✅ **提前离场检测**：根据最低服务时长识别提前离场人员
- ✅ **代签嫌疑检测**：同一时间不同服务站签到，疑似代签
- ✅ **坏行容错**：遇到格式错误的行，记录原因继续处理剩余文件
- ✅ **空目录处理**：空目录也能生成报告，不中断流程
- ✅ **可重复执行**：支持多次运行，覆盖输出结果

## 快速开始

### 第一步：预览待处理文件

先查看输入目录中有哪些文件需要处理，不生成输出：

```bash
python3 volunteer_signin.py -i test_data/normal -r rules.json -o output/preview -p
```

输出示例：
```
[预览模式] 仅展示将要处理的文件，不生成输出
============================================================
  - 2026-05-15_幸福邻里服务站.csv
  - 2026-05-15_阳光社区服务站.csv
```

### 第二步：正式执行审核

运行完整的数据审核流程，生成处理结果：

```bash
python3 volunteer_signin.py -i test_data/normal -r rules.json -o output/normal
```

输出示例：
```
处理中: 2026-05-15_幸福邻里服务站.csv
处理中: 2026-05-15_阳光社区服务站.csv

处理完成！结果已保存到: output/normal
有效记录: 6, 问题记录: 4
```

### 第三步：查看处理报告

查看详细的处理报告和问题日志：

```bash
cat output/normal/processing_report.txt
```

或者查看JSON格式的完整报告：
```bash
cat output/normal/processing_report.json
```

报告内容包括：
- 处理时间和统计信息
- 有效记录列表（`valid_records.csv`）
- 问题记录列表（`issue_records.csv`）
- 错误日志（坏行、文件读取错误等）

## 输入文件格式

签到数据采用CSV格式，字段如下：

| 字段 | 说明 | 示例 |
|------|------|------|
| 志愿者ID | 志愿者唯一标识 | V001 |
| 姓名 | 志愿者姓名 | 张明 |
| 服务站 | 签到服务站名称 | 阳光社区服务站 |
| 签到时间 | 签到时间 | 2026-05-15 07:55:00 |
| 签退时间 | 签退时间 | 2026-05-15 12:10:00 |
| 身份证号 | 身份证号码 | 110101199001011234 |
| 联系电话 | 手机号码 | 13800138001 |

## 规则配置

`rules.json` 配置审核规则：

```json
{
  "schedule_time": "08:00",
  "grace_minutes": 15,
  "min_service_hours": 4
}
```

- `schedule_time`: 规定签到时间
- `grace_minutes`: 迟到宽限分钟数
- `min_service_hours`: 最低服务时长（小时）

## 输出文件说明

| 文件名 | 说明 |
|--------|------|
| valid_records.csv | 审核通过的有效签到记录 |
| issue_records.csv | 存在问题的签到记录（迟到、提前离场等） |
| processing_report.json | 完整处理报告（JSON格式） |
| processing_report.txt | 易读的处理报告（文本格式） |

## 测试场景

### 测试空目录处理

```bash
python3 volunteer_signin.py -i test_data/empty -r rules.json -o output/empty
```

### 测试坏行处理

```bash
python3 volunteer_signin.py -i test_data/bad_rows -r rules.json -o output/bad_rows
```

### 测试重复执行

```bash
# 第一次执行
python3 volunteer_signin.py -i test_data/normal -r rules.json -o output/normal

# 第二次执行（可复跑）
python3 volunteer_signin.py -i test_data/normal -r rules.json -o output/normal
```

## 问题类型说明

| 问题类型 | 说明 |
|----------|------|
| 迟到 | 签到时间晚于规定时间+宽限期 |
| 提前离场 | 服务时长少于规定时长 |
| 代签嫌疑 | 同一时间不同服务站签到 |
| 坏行 | 数据格式错误或缺少必要字段 |

## 参数说明

```
-i, --input    输入目录路径（存放签到CSV文件）
-r, --rules    规则文件路径（JSON格式）
-o, --output   输出目录路径（存放处理结果）
-p, --preview  预览模式，仅展示文件不生成输出
```
