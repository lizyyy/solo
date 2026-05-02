# 固件校准包投递员

一款专为现场设备维护工程师设计的本地命令行工具，用于管理离线设备的固件升级、校准参数和回滚包投递。

## 功能特性

- **设备清单管理**：导入和管理设备型号、区域、当前版本等信息
- **包验证系统**：自动校验manifest、SHA256哈希、签名、校准包有效期
- **隔离区机制**：验证失败的包自动进入隔离区，防止错误投递
- **投递计划**：生成dry-run计划，支持区域灰度发布
- **阻断项检测**：自动识别跨版本跳升、缺少回滚包、版本未知等风险
- **安全执行**：复制后重新计算哈希校验，确保数据完整性
- **回滚机制**：根据journal生成安全回滚计划，检测目录人工修改
- **审计报告**：导出Markdown报告、CSV结果和JSON审计包
- **历史查询**：按设备号、区域、版本和日期查询投递记录

## 项目结构

```
firmware_delivery/
├── __init__.py          # 包版本信息
├── cli.py               # CLI命令入口
├── config.py            # 配置模型和持久化
├── device.py            # 设备模型和CSV解析
├── manifest.py          # Manifest解析
├── signature.py         # 签名校验
├── package_validator.py # 包验证器
├── package_registry.py  # 有效包注册表
├── quarantine.py        # 隔离区管理
├── planner.py           # 投递计划生成
├── executor.py          # 投递执行器
├── rollback.py          # 回滚管理
├── reporter.py          # 报告导出
├── history.py           # 历史查询
└── utils.py             # 工具函数

examples/
├── devices.csv              # 示例设备清单
└── packages/
    └── 巡检终端X1_v1.1.0/   # 示例升级包
        ├── manifest.json
        ├── firmware_v1.1.0.bin
        ├── calibration_v1.1.json
        └── rollback_v1.0.0.bin
```

## 安装方式

### 方式一：开发模式安装

```bash
cd /path/to/project
pip install -e .
```

### 方式二：直接运行

```bash
python -m firmware_delivery.cli --help
```

## 快速开始

### 1. 创建工作目录

```bash
mkdir -p ~/firmware-workspace
cd ~/firmware-workspace
```

### 2. 初始化项目配置

```bash
firmware-delivery init \
    --project-name "现场设备升级项目" \
    --device-model "巡检终端X1" \
    --device-model "传感器网关G2" \
    --device-model "手持采集器H3" \
    --region "华东区域" \
    --region "华北区域" \
    --region "华南区域" \
    --firmware-version "v1.1.0" \
    --calibration-validity 365 \
    --delivery-dir "./delivery" \
    --audit-dir "./audit"
```

### 3. 导入设备清单

使用示例数据测试：

```bash
firmware-delivery import-device /path/to/project/examples/devices.csv
```

查看导入的设备清单：

```bash
cat devices.csv
```

### 4. 导入升级包

导入示例升级包：

```bash
firmware-delivery import-package /path/to/project/examples/packages/巡检终端X1_v1.1.0
```

成功导入后，包会被复制到 `.registry` 目录。

**验证失败的包**会自动进入 `.quarantine` 隔离区，并记录失败原因。

### 5. 生成投递计划（Dry Run）

```bash
firmware-delivery plan --output plan.json
```

#### 按区域灰度发布

```bash
firmware-delivery plan --region "华东区域" --output plan.json
```

#### 需要负责人确认

```bash
firmware-delivery plan --require-owner --output plan.json
```

计划会检查以下阻断项：
- 跨版本跳升（当前版本不在依赖列表中）
- 缺少回滚包（升级且当前版本与目标版本不同）
- 设备当前版本未知
- 同一设备被多个包命中
- 负责人未确认

### 6. 执行投递

**方式一：执行计划文件**

```bash
firmware-delivery apply --plan-id "PLAN-xxxx" --plan-file plan.json
```

**方式二：重新生成计划并执行**

```bash
firmware-delivery apply --plan-id "PLAN-20260501"
```

执行过程：
1. 验证计划无阻断项
2. 复制固件、校准参数、回滚包到设备目录
3. 复制后重新计算SHA256哈希校验
4. 写入journal到审计目录

查看投递结果：

```bash
ls -la ./delivery/
```

每个设备会有一个独立的目录，包含投递的文件和manifest。

### 7. 校验哈希

投递完成后，工具会自动校验文件完整性。也可以手动检查：

```bash
# 查看某个设备目录的文件
ls -la ./delivery/INS001/

# 查看执行日志
ls -la ./audit/
```

### 8. 回滚操作

#### 查看回滚计划（Dry Run）

```bash
firmware-delivery rollback --dry-run
```

#### 指定Journal ID回滚

```bash
firmware-delivery rollback --journal-id "JNL-xxxxxxxx" --dry-run
```

#### 执行回滚

```bash
firmware-delivery rollback
```

**安全检测**：回滚前会检查目标目录是否被人工修改：
- 检查所有文件是否存在
- 检查文件哈希是否与记录一致
- 如果被修改，停止并提示

### 9. 导出审计报告

```bash
firmware-delivery report --journal-id "JNL-xxxxxxxx" --output-dir ./reports
```

报告包含：
- **Markdown报告**：完整的投递/回滚报告（`report-xxx.md`）
- **CSV设备结果**：每个设备的执行详情（`devices-xxx.csv`）
- **JSON审计包**：包含计划和journal的完整数据（`audit-xxx.json`）

### 10. 查询历史记录

#### 查询所有记录

```bash
firmware-delivery history
```

#### 按设备号查询

```bash
firmware-delivery history --device-id "INS001"
```

#### 按区域查询

```bash
firmware-delivery history --region "华东区域"
```

#### 按日期范围查询

```bash
firmware-delivery history --start-date "2026-04-01" --end-date "2026-04-30"
```

#### JSON格式输出

```bash
firmware-delivery history --device-id "INS001" --format json
```

## Manifest文件格式

升级包必须包含 `manifest.json` 文件，格式如下：

```json
{
  "manifest_version": "1.0",
  "package_name": "巡检终端X1升级包",
  "package_version": "v1.1.0",
  "target_device_models": ["巡检终端X1"],
  "target_regions": null,
  
  "firmware": {
    "filename": "firmware_v1.1.0.bin",
    "sha256": "文件的SHA256哈希",
    "size": 102400,
    "file_type": "firmware"
  },
  "firmware_version": "v1.1.0",
  
  "calibration": {
    "filename": "calibration_v1.1.json",
    "sha256": "文件的SHA256哈希",
    "size": 2048,
    "file_type": "calibration"
  },
  "calibration_version": "v1.1",
  "calibration_date": "2026-04-01T00:00:00",
  "calibration_validity_days": 365,
  
  "rollback": {
    "filename": "rollback_v1.0.0.bin",
    "sha256": "文件的SHA256哈希",
    "size": 100352,
    "file_type": "rollback"
  },
  "rollback_from_version": "v1.0.0",
  
  "dependencies": ["v1.0.0"],
  
  "signature": "可选的Base64编码签名",
  "signed_by": "签名者",
  "signature_algorithm": "SHA256withRSA",
  
  "created_at": "2026-04-25T10:00:00",
  "description": "包描述"
}
```

### 关键字段说明

| 字段 | 说明 |
|------|------|
| `target_device_models` | 目标设备型号列表 |
| `target_regions` | 目标区域列表（null表示全部区域） |
| `dependencies` | 允许的前置版本（用于检测版本跳升） |
| `calibration_date` | 校准日期（用于有效期检查） |
| `rollback_from_version` | 回滚包适用的源版本 |
| `signature` | Manifest的签名（可选） |

## 设备清单CSV格式

```csv
设备号,型号,区域,当前固件,当前校准版本,最后上线时间,负责人
INS001,巡检终端X1,华东区域,v1.0.0,v1.0,2026-04-20T08:30:00,张工
INS002,巡检终端X1,华东区域,v1.0.0,v1.0,2026-04-19T14:20:00,张工
INS003,传感器网关G2,华北区域,v2.1.0,v2.0,2026-04-21T10:00:00,李工
```

### 字段说明

| 字段 | 必需 | 说明 |
|------|------|------|
| 设备号 | 是 | 设备唯一标识 |
| 型号 | 是 | 设备型号（用于匹配升级包） |
| 区域 | 是 | 设备所属区域（用于灰度发布） |
| 当前固件 | 是 | 当前固件版本（用于版本依赖检查） |
| 当前校准版本 | 否 | 当前校准参数版本 |
| 最后上线时间 | 否 | 设备最后在线时间 |
| 负责人 | 否 | 设备负责人（用于确认机制） |

## 完整验证流程

使用临时目录快速验证所有功能：

```bash
# 1. 创建临时目录
mkdir -p /tmp/firmware-test && cd /tmp/firmware-test

# 2. 复制示例数据
cp -r /path/to/project/examples/* .

# 3. 初始化配置
firmware-delivery init \
    --device-model "巡检终端X1" \
    --device-model "传感器网关G2" \
    --device-model "手持采集器H3" \
    --region "华东区域" \
    --region "华北区域" \
    --region "华南区域"

# 4. 导入设备清单
firmware-delivery import-device devices.csv

# 5. 导入升级包
firmware-delivery import-package packages/巡检终端X1_v1.1.0

# 6. 生成投递计划
firmware-delivery plan --output plan.json

# 7. 执行投递
firmware-delivery apply --plan-id "TEST-PLAN-001" --plan-file plan.json

# 8. 查看投递目录
ls -la delivery/

# 9. 导出报告
firmware-delivery report --output-dir reports

# 10. 查看回滚计划
firmware-delivery rollback --dry-run

# 11. 查询历史
firmware-delivery history

# 12. 执行回滚（可选）
# firmware-delivery rollback
```

## 常见问题

### Q: 包导入失败怎么办？

检查 `.quarantine/quarantine.json` 文件，查看失败原因：

```bash
cat .quarantine/quarantine.json
```

常见失败原因：
- `MISSING_FILE`：manifest中声明的文件不存在
- `HASH_MISMATCH`：文件哈希与manifest声明不匹配
- `MANIFEST_VERSION_MISMATCH`：manifest版本不兼容
- `CALIBRATION_EXPIRED`：校准包已过期
- `INVALID_SIGNATURE`：签名验证失败

### Q: 计划包含阻断项怎么办？

根据阻断项代码处理：

| 代码 | 说明 | 处理方式 |
|------|------|----------|
| `UNKNOWN_VERSION` | 设备当前版本未知 | 更新设备清单 |
| `MISSING_ROLLBACK` | 缺少回滚包 | 升级包需包含回滚包 |
| `VERSION_JUMP` | 版本跳升 | 检查dependencies配置 |
| `MULTIPLE_PACKAGE_HITS` | 多包冲突 | 检查包的target配置 |
| `OWNER_NOT_CONFIRMED` | 缺少负责人 | 启用--require-owner时需要 |

### Q: 如何启用签名验证？

1. 在init时指定公钥：

```bash
firmware-delivery init --public-key /path/to/public_key.pem
```

或直接在 `firmware-config.json` 中配置：

```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
}
```

2. Manifest中包含签名：

```json
{
  "signature": "Base64编码的签名",
  "signed_by": "签名者ID",
  "signature_algorithm": "SHA256withRSA"
}
```

### Q: 回滚失败怎么办？

如果回滚提示"目标目录已被人工修改"，说明设备目录下的文件已被修改。此时：

1. 检查 `.audit` 目录下的journal文件
2. 手动核实设备目录状态
3. 如需强制回滚，可手动删除或替换文件

## 命令参考

```bash
firmware-delivery init          # 初始化项目配置
firmware-delivery import-device # 导入设备清单CSV
firmware-delivery import-package # 导入升级包（带验证）
firmware-delivery plan          # 生成dry-run投递计划
firmware-delivery apply         # 执行投递计划
firmware-delivery rollback      # 执行回滚
firmware-delivery report        # 导出审计报告
firmware-delivery history       # 查询历史记录
```

查看详细帮助：

```bash
firmware-delivery --help
firmware-delivery init --help
firmware-delivery plan --help
```

## 依赖库

- `click` - 命令行框架
- `pydantic` - 数据验证
- `python-dateutil` - 日期处理
- `cryptography` - 签名验证（可选）

安装依赖：

```bash
pip install click pydantic python-dateutil cryptography
```

## 许可证

本项目仅供内部使用。
