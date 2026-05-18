# 运动康复门店康复器械冲突分析工具

## 功能说明

本工具用于自动分析运动康复门店的康复器械使用记录，将正常记录和异常记录分离，并对异常记录进行分类汇总，提供修复建议。

### 异常分类

1. **保养封锁** - 器械因保养、维修等原因无法使用
2. **患者迟到** - 患者未按预约时间到达
3. **可复跑输出** - 需要重新安排预约的情况
4. **其他异常** - 器械占用、预约冲突等

## 目录结构

```
.
├── config/
│   └── default.yaml          # 默认规则配置文件
├── sample_data/              # 样例数据
│   ├── store_202405_01.csv
│   ├── store_202405_02.csv
│   └── corrupted_file.csv    # 损坏文件（测试错误处理）
├── output/
│   ├── normal/               # 正常记录输出目录
│   ├── abnormal/             # 异常记录输出目录
│   ├── abnormal_summary.md   # 异常摘要报告
│   └── error_log.txt         # 错误日志
└── rehab_conflict_cli.py     # 主程序
```

## 使用方法

### 1. 处理单个文件

```bash
python3 rehab_conflict_cli.py path/to/your/file.csv
```

### 2. 处理整个目录

```bash
python3 rehab_conflict_cli.py path/to/your/directory
```

### 3. 使用样例数据测试

```bash
python3 rehab_conflict_cli.py sample_data
```

### 4. 指定自定义配置文件

```bash
python3 rehab_conflict_cli.py sample_data --config your_config.yaml
```

## 配置说明

配置文件位于 `config/default.yaml`，可自定义以下规则：

```yaml
rules:
  # 异常关键词列表
  abnormal_keywords:
    - "保养封锁"
    - "器械故障"
    - "设备维修"
    # ...

  # 正常关键词列表  
  normal_keywords:
    - "正常使用"
    - "已完成"
    # ...

  # 保养封锁分类配置
  maintenance_lockout:
    keywords: ["保养封锁", "维修中", ...]
    suggestion: "修复建议文本..."

  # 患者迟到分类配置
  patient_late:
    keywords: ["患者迟到", "晚到", ...]
    suggestion: "修复建议文本..."

  # 可复跑分类配置
  rerun_available:
    keywords: ["可复跑", "重新安排", ...]
    suggestion: "修复建议文本..."
```

## 特性

1. **配置化规则** - 所有匹配规则和建议文本都在配置文件中，修改口径无需改源码
2. **容错处理** - 单个文件解析失败不影响其他文件处理，错误统一汇总到错误日志
3. **默认配置** - 缺少配置文件时使用内置默认配置，仍可正常运行
4. **详细摘要** - Markdown格式的异常报告，包含分类统计和修复建议
5. **业务定制** - 专门针对运动康复门店业务场景设计

## 输入文件格式

CSV文件需包含以下关键字段之一：
- 记录ID
- 日期
- 门店名称
- 器械名称
- 患者姓名
- 状态
- 备注
