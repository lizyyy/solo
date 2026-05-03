# 📷 照片交付包校验工具

一个用于整理和校验旅拍照片交付包的命令行工具，帮助你避免交付前的常见错误。

## 功能特性

- ✅ **照片扫描与元数据解析** - 自动识别文件名中的照片编号、版本、水印状态等
- 📋 **选片表比对** - 将客户选片表与实际文件进行比对
- 🔍 **多重校验** - 检测缺图、多图、重复编号、错误版本、错误水印、尺寸比例问题
- 📄 **报告导出** - 支持 Markdown、HTML、JSON 三种格式的报告
- 📦 **智能打包** - 批量重命名预演，确认后生成交付包

## 安装

```bash
# 克隆项目后，安装依赖
npm install

# 安装为全局命令（可选）
npm link
```

## 快速开始

### 1. 生成示例配置

```bash
# 生成示例的 manifest.json 和 selections.csv
node src/cli.js generate

# 或如果已安装为全局命令
photo-check generate
```

### 2. 校验照片目录

```bash
# 基本校验
node src/cli.js check -d /path/to/photos

# 带选片表和配置文件的校验
node src/cli.js check -d /path/to/photos -s selections.csv -m manifest.json

# 生成报告
node src/cli.js check -d /path/to/photos -s selections.csv -r -f json markdown html
```

### 3. 预览打包计划

```bash
# 预览打包计划
node src/cli.js preview -d /path/to/photos -s selections.csv -m manifest.json

# 保存预演计划
node src/cli.js preview -d /path/to/photos -s selections.csv -o preview_plan.json
```

### 4. 执行打包

```bash
# 执行打包
node src/cli.js package -d /path/to/photos -s selections.csv -m manifest.json

# 指定输出目录
node src/cli.js package -d /path/to/photos -s selections.csv -o ./delivery_package

# 确认执行（即使存在警告）
node src/cli.js package -d /path/to/photos -s selections.csv --confirm

# 覆盖已存在的文件
node src/cli.js package -d /path/to/photos -s selections.csv --overwrite
```

## 命令说明

### check - 校验照片交付包

| 参数 | 说明 | 必需 |
|------|------|------|
| `-d, --directory` | 要扫描的照片目录 | 是 |
| `-m, --manifest` | manifest.json 配置文件路径 | 否 |
| `-s, --selections` | selections.csv 选片表路径 | 否 |
| `-r, --report` | 生成报告 | 否 |
| `-f, --format` | 报告格式: json, markdown, html (默认: json) | 否 |
| `-o, --output` | 报告输出路径 | 否 |

### preview - 预览打包计划

| 参数 | 说明 | 必需 |
|------|------|------|
| `-d, --directory` | 要扫描的照片目录 | 是 |
| `-m, --manifest` | manifest.json 配置文件路径 | 否 |
| `-s, --selections` | selections.csv 选片表路径 | 否 |
| `-o, --output` | 保存预演计划的路径 | 否 |

### package - 执行打包操作

| 参数 | 说明 | 必需 |
|------|------|------|
| `-d, --directory` | 要扫描的照片目录 | 是 |
| `-m, --manifest` | manifest.json 配置文件路径 | 否 |
| `-s, --selections` | selections.csv 选片表路径 | 否 |
| `-o, --output` | 输出目录 (默认: delivery_package) | 否 |
| `--confirm` | 确认执行，即使存在警告 | 否 |
| `--overwrite` | 覆盖已存在的文件 | 否 |

### generate - 生成示例配置文件

| 参数 | 说明 | 必需 |
|------|------|------|
| `-t, --type` | 生成类型: manifest, selections, all (默认: all) | 否 |
| `-o, --output` | 输出目录 | 否 |

## 配置文件说明

### manifest.json - 交付规则配置

```json
{
  "version": "1.0.0",
  "requirements": {
    "photoTypes": [
      {
        "type": "refined_watermark",
        "name": "精修带水印",
        "required": true,
        "watermark": true,
        "categories": ["refined"]
      },
      {
        "type": "refined_nowatermark",
        "name": "精修无水印",
        "required": true,
        "watermark": false,
        "categories": ["refined"]
      }
    ],
    "versionRules": {
      "enabled": true,
      "latestVersionOnly": true,
      "rejectOlderVersions": true
    }
  }
}
```

### selections.csv - 客户选片表

```csv
照片编号,类型,备注
0001,精修,客户指定
0002,精修,需要调整色调
0003,精修,九宫格
```

## 检测的问题类型

| 问题类型 | 严重程度 | 说明 |
|----------|----------|------|
| 缺图 | 严重 | 选片表中存在但目录中缺失的照片 |
| 多图 | 低 | 目录中存在但选片表中没有的照片 |
| 重复编号 | 高 | 同一编号存在多个相同类型的文件 |
| 多个版本 | 中 | 同一编号存在多个版本（建议只保留最新） |
| 水印错误 | 高 | 水印状态与要求不符 |
| 尺寸比例异常 | 中 | 照片比例不符合交付规则 |
| 无法识别编号 | 中 | 文件名中无法识别照片编号 |

## 文件名识别规则

工具会根据以下模式识别照片信息：

- **照片编号**: `IMG_1234`, `DSC_5678`, `0001` 等
- **版本号**: `_v1`, `_v2` 等
- **水印**: `wm`, `watermark`, `带水印`
- **无水印**: `no_wm`, `无水印`, `高清`
- **精修**: `refined`, `精修`, `修图`
- **原片**: `original`, `原片`, `原图`
- **九宫格**: `grid`, `九宫格`, `小红书`
- **打印**: `print`, `打印`

## 示例

### 目录结构示例

```
/my-photos/
├── 精修带水印/
│   ├── IMG_0001_精修_带水印_v1.jpg
│   ├── IMG_0002_精修_带水印_v2.jpg
│   └── IMG_0003_精修_带水印.jpg
├── 精修无水印/
│   ├── IMG_0001_精修_无水印_v1.jpg
│   └── IMG_0002_精修_无水印.jpg
├── 原片/
│   └── IMG_0004_原片.jpg
└── 小红书九宫格/
    └── IMG_0003_九宫格.jpg
```

### 运行校验

```bash
photo-check check \
  -d /my-photos \
  -s ./examples/selections.csv \
  -m ./examples/manifest.json \
  -r -f json markdown html
```

## 测试

```bash
# 运行所有测试
npm test
```

## 常见问题

**Q: 如何自定义文件名识别规则？**

A: 修改 `src/scanner.js` 中的 `DEFAULT_CONFIG` 对象，调整正则表达式模式。

**Q: 如何添加新的照片类型？**

A: 在 `manifest.json` 的 `photoTypes` 数组中添加新的类型配置。

**Q: 工具支持哪些图片格式？**

A: 支持 JPG、PNG、TIFF、RAW 等常见格式，具体列表请参考 `src/scanner.js` 中的 `IMAGE_EXTENSIONS`。

## License

MIT
