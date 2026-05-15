# 异常码覆盖检查工具

## 启动方式

### 环境准备
```bash
pip install -r requirements.txt
```

### 基本命令
```bash
# 查看帮助
python error_checker.py --help

# 查看子命令帮助
python error_checker.py check --help
python error_checker.py query --help
```

## 样例来源

本工具的测试样例来源于**高峰药房配送回执**数据处理流程，主要针对以下异常场景：
- 压缩包路径为空或不存在
- 压缩包格式不支持（仅支持 .zip, .rar, .7z）
- 压缩包已损坏（文件大小为0）
- 数据解析异常
- 配送回执信息校验失败

## 主流程（成功路径）

```bash
# 1. 检查一个有效的压缩包路径
python error_checker.py check "/valid/path/to/delivery.zip" --operator zhangsan

# 2. 查询历史记录（按操作者）
python error_checker.py query --operator zhangsan

# 3. 导出检查结果
python error_checker.py export BATCH20260515120000 --format excel
```

**成功返回码**: `0`
- 命令输出清晰的批次ID、时间、操作者信息
- 提示"检查通过，无异常"

## 失败路径示例

### 场景：压缩包路径不存在

```bash
python error_checker.py check "/nonexistent/path.zip" --operator lisi
```

**失败返回码**: `1`

**错误输出**:
```
正在检查压缩包路径: /nonexistent/path.zip

批次ID: BATCH20260515120100
检查时间: 2026-05-15T12:01:00.123456
操作者: lisi
检查结果: 失败

发现的错误:
  [E002] 压缩包路径不存在 - 风险等级: high
```

## 命令详解

### 1. 异常检查 (check)
```bash
python error_checker.py check <zip_path> [--operator <name>]
```

### 2. 历史查询 (query)
```bash
# 按批次ID查询
python error_checker.py query --batch-id BATCH20260515120000

# 按操作者查询
python error_checker.py query --operator zhangsan

# 按风险类型查询
python error_checker.py query --risk-type "压缩包路径异常"

# 按风险等级回查
python error_checker.py query --risk-level high
python error_checker.py query --risk-level normal

# 组合查询
python error_checker.py query --operator zhangsan --risk-level high
```
*支持组合查询，成功路径和失败路径统一入口，支持按风险等级回查*

### 3. 候选清理清单 (candidates)
```bash
# 查看最近7天的异常记录
python error_checker.py candidates

# 查看最近30天高风险记录
python error_checker.py candidates --days 30 --risk-level high
```
*先生成清单，确认后再操作，避免误伤*

### 4. 未覆盖错误码 (uncovered)
```bash
python error_checker.py uncovered
```
*按模块分组显示未覆盖的错误码*

### 5. 导出结果 (export)
```bash
# 按批次导出（Excel格式）
python error_checker.py export BATCH20260515120000 --format excel

# 按批次导出（CSV格式）
python error_checker.py export BATCH20260515120000 --format csv

# 按风险等级筛选导出（支持 high/medium/low/normal）
python error_checker.py export --risk-level high --format csv

# 导出所有记录
python error_checker.py export --all --format csv
```
*导出文件包含：批次ID、字段名、修正前后值、风险等级、错误码、操作者、检查时间*
*支持按风险等级回查并批量导出外包验收单*

## 验收要点

1. **返回码清晰**:
   - 成功: `exit code 0`
   - 失败: `exit code 1`
   
2. **错误体清楚**:
   - 包含错误码（如 E002）
   - 包含错误消息（如 "压缩包路径不存在"）
   - 包含风险等级（high/medium/low）

3. **统一查询入口**:
   - 成功路径和失败路径均可通过 `query` 命令查看

4. **导出完整性**:
   - 保留"修正前"和"修正后"字段值
   - 支持按风险等级回查

## 目录结构
```
.
├── error_checker.py      # 主程序
├── requirements.txt      # 依赖包
├── README.md            # 使用文档
├── data/                # 数据目录
├── history/             # 历史记录（check_history.json）
└── exports/             # 导出文件目录
```
