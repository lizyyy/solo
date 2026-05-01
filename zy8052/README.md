# CAM 派单预检工具

义齿技工所 CAM 派单预检工具，用于检查病例订单、STL 文件和材料规则的一致性。

## 功能特性

- 读取病例订单 CSV 文件
- 读取 STL 文件清单 JSON 文件
- 读取材料与牙位规则 YAML 文件
- 按患者、牙位、修复类型合并检查
- 处理边界情况：
  - 同一病例左右牙位混写检测
  - STL 文件名牙位不一致检测
  - 材料不支持某类修复检测
- 输出：
  - risk_report.md - 风险报告
  - missing_files.csv - 缺失文件清单
  - cam_manifest.json - CAM派单清单

## 安装依赖

```bash
pip install pyyaml
```

## 快速开始

### Demo 命令

使用示例数据运行预检：

```bash
python main.py --orders examples/orders.csv --stls examples/stl_files.json --rules examples/material_rules.yaml --output-dir output
```

### 参数说明

- `--orders`: 病例订单 CSV 文件路径
- `--stls`: STL 文件清单 JSON 文件路径
- `--rules`: 材料与牙位规则 YAML 文件路径
- `--output-dir`: 输出目录（可选，默认当前目录）

## 输入文件格式

### 病例订单 CSV

| 字段 | 说明 |
|------|------|
| case_id | 病例ID |
| patient_name | 患者姓名 |
| tooth_number | 牙位号 |
| restoration_type | 修复类型 |
| material | 材料 |
| doctor | 医生 |
| clinic | 诊所 |

### STL 文件清单 JSON

```json
[
  {
    "filename": "CASE001_11_prep.stl",
    "tooth_number": "11",
    "type": "prep",
    "case_id": "CASE001"
  }
]
```

### 材料与牙位规则 YAML

```yaml
materials:
  氧化锆:
    supported_restorations:
      - 全瓷冠
      - 贴面
    supported_teeth:
      - 11
      - 12
      - 13
```

## 项目结构

```
cam_checker/
├── parsers/          # 数据解析模块
├── validators/       # 规则校验模块
├── generators/       # 派单生成模块
└── exporters/        # 报告导出模块
examples/             # 示例数据
main.py               # CLI入口
```
