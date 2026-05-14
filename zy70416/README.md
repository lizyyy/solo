# 依赖许可证巡检工具

一个命令行工具，用于扫描和审计依赖包的许可证，支持多源审计取证、人工修正备注、数据持久化等功能。

## 功能特性

- ✅ **多源审计取证目录** - 所有字段都能追溯到原始输入位置
- ✅ **检测规则过宽变体** - 支持过宽规则检测，便于对比分析
- ✅ **人工修正备注** - 不直接覆盖系统判断，保留人工审核痕迹
- ✅ **本地持久化存储** - 重启后之前的处理结论和材料摘要仍然可查
- ✅ **错误字段定位** - 坏记录的错误提示可精确到具体字段和源文件位置
- ✅ **环境名称查询** - 可通过环境名称（如门店设备台账）找到原始输入和处理依据

## 快速开始

### 查看帮助

```bash
python main.py --help
```

### 查看所有可用命令

```bash
python main.py
```

### 查看检测规则

```bash
python main.py rules
```

### 扫描正常样例

```bash
python main.py scan --input samples/normal_dependencies.json --name normal_scan
```

### 使用过宽规则扫描（产生坏记录）

```bash
python main.py scan --input samples/overbroad_dependencies.json --name overbroad_scan --overbroad
```

### 查看所有扫描结果

```bash
python main.py list
```

### 按环境名称查询审计记录

```bash
python main.py query --environment "北京朝阳门店-设备台账系统"
```

### 人工修正审计记录

```bash
python main.py correct \
    --result overbroad_scan \
    --record-id bad-lib-gpl2 \
    --status confirmed \
    --remark "经审核，该GPL库仅在后端使用，不涉及分发，风险可控" \
    --operator "张三"
```

## 项目结构

```
.
├── license_audit/          # 核心模块
│   ├── __init__.py        # 包初始化
│   ├── models.py          # 数据模型定义
│   ├── storage.py         # 数据持久化存储
│   ├── detector.py        # 许可证检测引擎
│   ├── reporter.py        # 报告生成器
│   └── cli.py             # 命令行接口
├── samples/                # 样例数据
│   ├── normal_dependencies.json      # 正常材料样例
│   └── overbroad_dependencies.json   # 触发过宽规则的坏材料样例
├── data/                   # 数据存储目录
│   ├── raw/               # 原始依赖数据
│   ├── audit/             # 审计记录和取证数据
│   └── results/           # 扫描结果
├── reports/                # 生成的报告目录
└── main.py                 # 主入口脚本
```

## 数据模型说明

### Dependency（依赖项）
- `name`: 依赖包名称
- `version`: 版本号
- `license`: 许可证类型
- `source`: 来源
- `environment_name`: 环境名称
- `source_location`: 原始文件位置（可追溯）
- `raw_input`: 完整原始输入数据

### AuditRecord（审计记录）
- `dependency_id`: 关联的依赖ID
- `detection_rule_name`: 应用的检测规则
- `system_status`: 系统自动判断结果
- `system_reason`: 系统判断原因
- `manual_status`: 人工审核状态（不覆盖系统状态）
- `manual_remark`: 人工审核备注
- `operator`: 操作人
- `field_errors`: 字段级错误信息（含位置信息）

### EvidenceItem（取证项）
- `audit_record_id`: 关联的审计记录ID
- `field_name`: 取证字段名称
- `original_value`: 原始值
- `source_location`: 原始位置信息

## 检测规则

系统内置两类规则：

### 正常规则
- `GPL-3.0-check` - 检测GPL-3.0高风险许可证
- `AGPL-check` - 检测AGPL高风险许可证
- `MIT-license` - MIT宽松许可证检测
- `Apache-2.0-check` - Apache许可证检测
- `BSD-check` - BSD许可证检测

### 过宽规则（用于测试和对比）
- `OVERBROAD-any-GPL` - 只要包含GPL字样就标记失败（包括GPL-2.0、LGPL等）
- `OVERBROAD-non-MIT` - 不是MIT许可证就标记失败

## 样例数据说明

### 正常材料（samples/normal_dependencies.json）
包含10个使用宽松许可证（MIT、Apache、BSD）的依赖项，分布在两个环境中：
- 北京朝阳门店-设备台账系统（5个）
- 上海浦东店-会员管理系统（5个）

### 坏材料（samples/overbroad_dependencies.json）
在正常材料基础上添加了会触发过宽规则的坏记录：
- `bad-lib-gpl2` - GPL-2.0许可证（会被过宽规则标记）
- `bad-lib-lgpl` - LGPL-2.1许可证（会被过宽规则标记）
- `bad-lib-agpl` - AGPL-3.0许可证（高风险）
- `bad-lib-empty-license` - 空许可证字段（产生警告）

## 典型工作流

1. **导入依赖数据** - 准备JSON格式的依赖清单
2. **执行扫描** - 使用 `scan` 命令进行许可证检测
3. **查看报告** - 检查生成的审计报告和取证目录
4. **人工审核** - 对系统标记的记录进行人工审核
5. **添加修正** - 使用 `correct` 命令添加人工判断和备注
6. **追溯查询** - 通过环境名称查询历史记录和原始输入

## 报告输出

每次扫描会生成两个报告文件：
- `reports/{name}_report.txt` - 详细的巡检报告
- `reports/{name}_audit_directory.txt` - 多源审计取证目录（含完整追溯链）
