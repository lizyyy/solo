# 耳机校准与筛查包核验台

用于流动听力筛查车的本地桌面工具，帮助现场工作人员快速核验筛查数据的完整性和准确性。

## 功能特性

- **多格式导入**：支持导入学生名单CSV、筛查结果JSON、设备日志JSON和校准证书文件
- **智能校验**：自动检测以下问题：
  - 校准证书过期
  - 学生筛查结果缺失
  - 同一学生重复筛查
  - 听力阈值异常
  - 阈值极端值
  - 左右耳通道可能接反
  - 设备日志错误
  - 日志时间漂移
- **人工复核**：问题可人工标记为"确认问题"、"排除问题"、"已解决"状态
- **本地持久化**：复核状态自动保存到本地，重启后不丢失
- **多格式导出**：
  - Markdown 交付报告
  - CSV 问题清单
  - JSON 审计包

## 环境要求

- Python 3.8+
- tkinter (Python标准库，通常随Python一起安装)

## 安装说明

本项目无需额外安装依赖包，仅使用Python标准库。

## 启动方式

### 方式一：直接运行

```bash
cd /path/to/xy4211
python3 main.py
```

### 方式二：添加可执行权限后运行

```bash
chmod +x main.py
./main.py
```

## 使用流程

### 快速验证流程

1. **启动应用**
   ```bash
   python3 main.py
   ```

2. **导入示例数据**
   - 点击左侧导航区的"📂 导入文件"
   - 依次导入 `sample_data/` 目录下的示例文件：
     - 点击"导入学生名单" → 选择 `students.csv`
     - 点击"导入筛查结果" → 选择 `screening_results.json`
     - 点击"导入设备日志" → 选择 `device_logs.json`
     - 点击"导入校准证书" → 选择 `calibration_certificates.json`

3. **查看数据概览**
   - 点击"📊 数据概览"查看已导入的学生、筛查结果、设备与校准信息

4. **执行校验**
   - 点击"⚠️ 校验问题"标签页
   - 点击"开始校验"按钮
   - 查看检测到的问题列表

5. **问题复核**
   - 选中问题列表中的某一行
   - 点击"✅ 问题复核"标签页
   - 选择复核状态（确认问题/排除问题/已解决/重置）
   - 可添加复核备注
   - 点击"保存复核"按钮

6. **导出报告**
   - 点击"📤 导出报告"标签页
   - 选择导出格式：
     - Markdown交付报告
     - CSV问题清单
     - JSON审计包
   - 选择保存位置

## 项目结构

```
xy4211/
├── config.py                    # 应用配置文件
├── main.py                      # 主程序入口
├── models/                      # 数据模型模块
│   ├── __init__.py
│   ├── device.py               # 设备模型
│   ├── student.py              # 学生模型
│   ├── screening_result.py     # 筛查结果模型
│   ├── device_log.py           # 设备日志模型
│   ├── calibration_certificate.py # 校准证书模型
│   └── validation_issue.py     # 校验问题模型
├── parsers/                     # 导入解析模块
│   ├── __init__.py
│   ├── csv_parser.py           # CSV文件解析器
│   ├── json_parser.py          # JSON文件解析器
│   └── certificate_parser.py   # 校准证书解析器
├── validators/                  # 校验规则模块
│   ├── __init__.py
│   ├── base_validator.py       # 基础校验器
│   ├── calibration_validator.py # 校准有效期校验
│   ├── result_validator.py     # 结果缺失/重复校验
│   ├── threshold_validator.py  # 阈值异常校验
│   ├── log_validator.py        # 日志错误校验
│   ├── channel_validator.py    # 通道接反校验
│   └── validator_engine.py     # 校验引擎
├── storage/                     # 存储模块
│   ├── __init__.py
│   └── local_storage.py        # 本地JSON存储
├── exporters/                   # 导出模块
│   ├── __init__.py
│   ├── markdown_exporter.py    # Markdown报告导出
│   ├── csv_exporter.py         # CSV问题清单导出
│   └── json_exporter.py        # JSON审计包导出
├── gui/                         # GUI界面模块
│   ├── __init__.py
│   └── main_window.py          # 主窗口
├── tests/                       # 测试用例
│   ├── __init__.py
│   ├── test_models.py          # 数据模型测试
│   ├── test_parsers.py         # 解析器测试
│   ├── test_validators.py      # 校验器测试
│   ├── test_storage.py         # 存储模块测试
│   └── test_exporters.py       # 导出器测试
└── sample_data/                 # 示例数据
    ├── students.csv            # 学生名单示例
    ├── screening_results.json  # 筛查结果示例
    ├── device_logs.json        # 设备日志示例
    └── calibration_certificates.json # 校准证书示例
```

## 测试说明

### 运行所有测试

```bash
cd /path/to/xy4211
python3 -m pytest tests/ -v
```

或使用unittest：

```bash
python3 -m unittest discover -s tests -v
```

### 运行单个测试文件

```bash
python3 -m pytest tests/test_validators.py -v
python3 -m pytest tests/test_models.py -v
```

### 测试覆盖范围

- **test_models.py**: 测试所有数据模型的序列化和反序列化
- **test_parsers.py**: 测试CSV、JSON文件解析功能
- **test_validators.py**: 测试所有校验规则
- **test_storage.py**: 测试本地存储的保存和加载功能
- **test_exporters.py**: 测试三种格式的导出功能

## 配置说明

配置文件 `config.py` 中的参数可根据实际需求调整：

```python
# 应用信息
APP_NAME = "耳机校准与筛查包核验台"
APP_VERSION = "1.0.0"

# 校准有效期（天）
CALIBRATION_VALIDITY_DAYS = 365

# 听力阈值配置
THRESHOLD_NORMAL_MAX = 25      # 正常阈值上限 (dB)
THRESHOLD_EXTREME_MIN = 0      # 极端值下限 (dB)
THRESHOLD_EXTREME_MAX = 120    # 极端值上限 (dB)

# 日志时间漂移阈值（秒）
LOG_TIME_DRIFT_THRESHOLD = 300

# 通道接反检测阈值（dB）
CHANNEL_SWAP_DIFF_THRESHOLD = 20
```

## 数据格式说明

### 学生名单 CSV 格式

```csv
student_id,name,gender,age,grade,class_name,school
S001,张三,男,8,三年级,1班,实验小学
S002,李四,女,9,三年级,1班,实验小学
```

### 筛查结果 JSON 格式

```json
[
    {
        "screening_id": "SR001",
        "student_id": "S001",
        "device_id": "AUD001",
        "screening_date": "2025-04-15 09:30:00",
        "status": "normal",
        "left_ear": {"500": 15, "1000": 10, "2000": 15, "4000": 20, "8000": 15},
        "right_ear": {"500": 10, "1000": 15, "2000": 10, "4000": 15, "8000": 20},
        "left_ear_status": "normal",
        "right_ear_status": "normal",
        "tester": "李医生",
        "location": "流动筛查车A"
    }
]
```

### 设备日志 JSON 格式

```json
[
    {
        "log_id": "LOG001",
        "device_id": "AUD001",
        "timestamp": "2025-04-15 08:00:00",
        "level": "info",
        "event_type": "device_start",
        "message": "设备启动完成",
        "details": {"firmware_version": "2.1.0"}
    }
]
```

### 校准证书 JSON 格式

```json
[
    {
        "certificate_id": "CAL2025001",
        "device_id": "AUD001",
        "calibration_date": "2025-01-20",
        "valid_until": "2026-01-19",
        "issued_by": "国家计量科学研究院",
        "certificate_number": "JL2025-0120-001",
        "left_ear": {"500": 0.3, "1000": 0.2},
        "right_ear": {"500": 0.2, "1000": 0.3}
    }
]
```

## 问题类型说明

| 问题类型 | 严重程度 | 说明 |
|---------|---------|------|
| CALIBRATION_EXPIRED | CRITICAL | 校准证书已过期 |
| CALIBRATION_MISSING | CRITICAL | 设备缺少校准证书 |
| RESULT_MISSING | ERROR | 学生缺少筛查结果 |
| DUPLICATE_SCREENING | WARNING | 同一学生多次筛查 |
| THRESHOLD_ABNORMAL | WARNING | 听力阈值异常 |
| THRESHOLD_EXTREME | ERROR | 听力阈值极端值 |
| CHANNEL_SWAP | WARNING | 左右耳通道可能接反 |
| LOG_ERROR | ERROR | 设备日志错误 |
| LOG_TIME_DRIFT | WARNING | 日志时间漂移 |

## 复核状态说明

| 状态 | 说明 |
|-----|------|
| PENDING | 待复核（默认状态） |
| CONFIRMED | 已确认问题 |
| DISMISSED | 已排除问题 |
| RESOLVED | 已解决 |

## 许可证

仅供内部使用。

## 技术支持

如有问题，请检查：
1. Python 版本是否为 3.8+
2. 是否有读取/写入文件的权限
3. 导入文件格式是否正确
