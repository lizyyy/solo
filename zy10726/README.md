# 检查预约数据号源释放复盘 CLI

专门用于医院预约数据号源释放复盘的命令行工具，确保重复运行结果稳定、不重复追加、支持文件完整性校验。

## 核心特性

- **结果稳定**：同一批输入重复运行，结果保持一致
- **防重复追加**：自动检测已处理记录，不重复写入结果
- **文件完整性校验**：MD5 哈希校验，防止坏文件中断
- **原始信息保留**：退费延迟、手工改约、重复占号都保留原始文件名和行号
- **业务口径清晰**：明确的未释放和误释放号源检测规则

## 业务规则

### 未释放号源
- 释放状态包含：未释放、未退费、占用中
- 需要重点跟进处理

### 误释放号源
- 释放状态显示已释放/已退费
- 但没有实际的释放时间
- 且有有效的预约ID
- 属于系统异常情况

### 退费延迟
- 释放时间和退费时间相差超过 24 小时
- 需要核查退费流程

### 手工改约
- 操作类型包含：手工改约、人工改约、后台改约
- 需要人工复核

### 重复占号
- 同一患者同一时间同一医生出现多条记录
- 属于异常预约情况

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm start init
```

这会在 `./sample` 目录下创建：
- `sample_appointments.csv` - 样例预约数据
- `config.json` - 配置文件

### 3. 运行复盘分析

```bash
npm start run -i ./sample -o ./output
```

### 4. 验证结果文件完整性

```bash
npm start verify -f ./output/appointment_release_review_result.csv
```

## 完整命令链示例

### 标准工作流程

```bash
# 1. 第一次运行
npm start run -i ./sample -o ./output

# 2. 重复运行同一批数据（不会重复追加）
npm start run -i ./sample -o ./output

# 3. 如果有新文件，只处理新增的
npm start run -i ./sample -o ./output

# 4. 强制覆盖输出（重新开始）
npm start run -i ./sample -o ./output --no-append
```

### 使用自定义配置

```bash
npm start run -i ./data -o ./output -c ./my-config.json
```

### 禁用完整性检查（不推荐）

```bash
npm start run -i ./data -o ./output --no-check-integrity
```

## 输出文件说明

输出文件：`appointment_release_review_result.csv`

| 字段名 | 说明 |
|--------|------|
| 复盘类型 | 未释放号源/误释放号源/退费延迟/手工改约/重复占号 |
| 患者ID | 患者唯一标识 |
| 预约ID | 预约单编号 |
| 科室 | 就诊科室 |
| 医生 | 就诊医生 |
| 预约时间 | 预约就诊时间 |
| 释放状态 | 当前号源状态 |
| 释放时间 | 号源释放时间 |
| 退费时间 | 实际退费时间 |
| 操作类型 | 操作记录类型 |
| 原始文件名 | 来源数据文件名 |
| 原始行号 | 来源数据文件行号 |
| 复盘日期 | 分析运行日期 |

## 状态文件

工具会在输出目录自动创建 `.review_state.json` 状态文件，记录：
- 已处理文件的哈希值
- 已处理记录的唯一标识

这个文件确保：
1. 同一文件重复运行不会被重复处理
2. 同一记录不会被重复写入结果

## 配置说明

`config.json` 可配置项：

```json
{
  "releaseStatusField": "释放状态",
  "appointmentTimeField": "预约时间",
  "releaseTimeField": "释放时间",
  "refundTimeField": "退费时间",
  "operationTypeField": "操作类型",
  "patientIdField": "患者ID",
  "appointmentIdField": "预约ID",
  "doctorField": "医生",
  "departmentField": "科室",
  "unreleasedValues": ["未释放", "未退费", "占用中"],
  "falseReleasedValues": ["已释放", "已退费"],
  "refundDelayThresholdHours": 24,
  "manualRescheduleKeywords": ["手工改约", "人工改约", "后台改约"],
  "duplicateCheckFields": ["患者ID", "预约时间", "医生"]
}
```

## 运行测试

```bash
npm test
```

测试包含：
- 正常路径：样例数据完整分析
- 异常路径：重复追加、损坏文件、空输入等
