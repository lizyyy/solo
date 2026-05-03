# ISP Audit CLI

端侧相机团队 ISP 标定参数包预检 CLI 工具，用于发版前验证 ISP 标定参数包的完整性和正确性。

## 功能特性

- ✅ 曝光/增益曲线单调性校验
- ✅ 白平衡矩阵维度校验 (3x4)
- ✅ 镜头阴影表覆盖校验
- ✅ 机型适配校验
- ✅ 重复标定检测
- ✅ 缺失分辨率档位检测
- ✅ 数值 NaN/Infinity 校验
- ✅ 参数越界警告
- 📊 导出 Markdown 审计报告
- 📊 导出违规记录 CSV
- 📊 导出包清单 JSON

## 安装

```bash
npm install
```

## 使用方法

### 基本命令

```bash
npm run dev -- check <release_policy.yaml>
```

### 示例

```bash
npm run dev -- check samples/release_policy.yaml
```

### 查看可用校验规则

```bash
npm run dev -- list
```

### 指定输出目录

```bash
npm run dev -- check samples/release_policy.yaml -o ./my_output
```

## 输入文件结构

工具需要以下输入文件：

```
release_package/
├── release_policy.yaml     # 发版策略配置
├── camera_profiles.yaml    # 相机机型配置
├── sensor_modes.csv        # 传感器模式列表
└── calibration/            # 标定参数目录
    ├── phone_model_x_4080x3060.json
    ├── phone_model_x_1920x1080.json
    └── ...
```

### release_policy.yaml

```yaml
version: "1.2.0"
release_date: "2026-05-01"
camera_profiles: "camera_profiles.yaml"
sensor_modes: "sensor_modes.csv"
calibration_dir: "calibration"

allowed_models:
  - "phone_model_x"
  - "phone_model_y"

target_platforms:
  - "android_14"
  - "android_15"
```

### camera_profiles.yaml

```yaml
phone_model_x:
  model: "phone_model_x"
  sensor: "IMX766"
  lens: "f/1.8"
  isp_version: "ISP_v5.0"
  is_front_camera: false

phone_model_y:
  model: "phone_model_y"
  sensor: "IMX890"
  lens: "f/2.0"
  isp_version: "ISP_v5.1"
  is_front_camera: false
```

### sensor_modes.csv

```csv
mode_id,width,height,fps,bit_depth,binning,model
0,4080,3060,30,10,1x1,phone_model_x
1,1920,1080,30,10,2x2,phone_model_x
2,1920,1080,60,10,2x2,phone_model_x
```

### calibration/*.json

标定 JSON 文件应包含以下字段：

```json
{
  "model": "phone_model_x",
  "resolution": {
    "width": 4080,
    "height": 3060
  },
  "exposure_curve": [
    { "exposure_time": 100, "iso": 100 },
    { "exposure_time": 200, "iso": 100 },
    { "exposure_time": 400, "iso": 100 }
  ],
  "gain_curve": [
    { "analog_gain": 1.0, "iso": 100 },
    { "analog_gain": 2.0, "iso": 200 }
  ],
  "white_balance_matrix": [
    [1.2, 0.0, -0.1, 0.0],
    [-0.05, 1.0, 0.05, 0.0],
    [-0.1, 0.0, 1.3, 0.0]
  ],
  "ccm": [
    [1.8, -0.6, -0.2, 0.0],
    [-0.3, 1.5, -0.2, 0.0],
    [-0.1, -0.4, 1.5, 0.0]
  ],
  "lens_shading_table": [
    {
      "width": 4080,
      "height": 3060,
      "channels": {
        "r": { "grid": [[...]] },
        "gr": { "grid": [[...]] },
        "gb": { "grid": [[...]] },
        "b": { "grid": [[...]] }
      }
    }
  ]
}
```

## 输出文件

运行检查后会在输出目录生成以下文件：

### 1. isp_audit.md

完整的 Markdown 格式审计报告，包含：
- 包健康状态 (HEALTHY/CAUTION/UNHEALTHY)
- 校验结果概览
- 包内容概览
- 错误详情（必须修复）
- 警告详情（建议检查）
- 各校验器结果

### 2. violations.csv

CSV 格式的违规记录，包含：
- level: 级别 (error/warning)
- validator: 校验器名称
- category: 违规类别
- message: 描述信息
- context: 上下文数据
- timestamp: 时间戳

### 3. package_manifest.json

JSON 格式的包清单，包含：
- 版本信息
- 发版策略摘要
- 相机配置信息
- 传感器模式列表
- 标定文件详细信息
- 校验结果摘要
- 包健康评分

## 校验规则说明

| 校验项 | 说明 | 级别 |
|--------|------|------|
| 曝光曲线单调性 | 确保曝光时间曲线严格递增 | 错误 |
| 增益曲线单调性 | 确保模拟增益曲线严格递增 | 错误 |
| 白平衡矩阵维度 | 确保 WB 矩阵为 3x4 维度 | 错误 |
| CCM 矩阵维度 | 确保颜色校正矩阵为 3x4 维度 | 错误 |
| 镜头阴影覆盖 | 确保所有分辨率有对应的 LSC 表 | 错误 |
| 机型匹配 | 确保标定文件与相机配置机型一致 | 错误 |
| 分辨率覆盖 | 确保所有传感器模式有标定数据 | 错误 |
| 数值有效性 | 检查 NaN、Infinity 等无效数值 | 错误 |
| 重复标定 | 检查同一机型是否存在多份标定 | 警告 |
| 参数范围 | 检查参数是否在合理范围内 | 警告 |

## 示例数据

项目包含 `samples/` 目录下的示例数据，用于演示工具功能。

**注意**: 示例数据中 `phone_model_y_3840x2160.json` 故意包含错误，用于测试校验器的检测能力：
- 曝光曲线非单调
- 增益曲线非单调  
- 白平衡矩阵维度错误 (3x3 而非 3x4)
- CCM 矩阵维度错误

运行示例命令会检测到这些错误。

## 项目结构

```
isp-audit-cli/
├── src/
│   ├── cli/
│   │   └── index.js           # CLI 入口
│   ├── config/
│   │   ├── index.js
│   │   └── parser.js          # 配置解析 (YAML/JSON/CSV)
│   ├── core/
│   │   └── auditor.js         # 核心审计引擎
│   ├── manifest/
│   │   └── index.js           # 包清单生成
│   ├── reporters/
│   │   └── index.js           # 报告输出 (Markdown/CSV)
│   └── validators/
│       ├── base.js            # 校验器基类
│       ├── exposureGainValidator.js
│       ├── whiteBalanceValidator.js
│       ├── lensShadingValidator.js
│       ├── modelValidator.js
│       ├── resolutionValidator.js
│       └── index.js
├── samples/                   # 示例数据
│   ├── release_policy.yaml
│   ├── camera_profiles.yaml
│   ├── sensor_modes.csv
│   └── calibration/
│       └── *.json
├── package.json
└── README.md
```

## 模块说明

### 1. 配置解析模块 (src/config/)

- `ConfigParser`: 解析 YAML、JSON、CSV 格式的配置文件
- 支持递归解析 calibration 目录下的所有 JSON 文件

### 2. 规则校验模块 (src/validators/)

- `ExposureGainValidator`: 曝光/增益曲线单调性校验
- `WhiteBalanceValidator`: 白平衡矩阵和 CCM 矩阵维度校验
- `LensShadingValidator`: 镜头阴影表覆盖和数值校验
- `ModelValidator`: 机型适配和重复标定检测
- `ResolutionValidator`: 分辨率档位覆盖和数值越界校验

### 3. 包清单生成模块 (src/manifest/)

- `ManifestGenerator`: 生成 package_manifest.json
- 包含完整的包元数据和校验结果摘要

### 4. 报告输出模块 (src/reporters/)

- `ReportGenerator`: 生成 isp_audit.md 和 violations.csv
- 支持结构化的 Markdown 报告和机器可读的 CSV 记录

### 5. CLI 模块 (src/cli/)

- 使用 Commander.js 构建命令行界面
- 支持 `check` 和 `list` 子命令

## 依赖

- Node.js >= 18.0.0
- commander: CLI 框架
- js-yaml: YAML 解析
- csv-parser: CSV 解析

## License

MIT
