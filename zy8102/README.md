# 移动端截图本地化遮挡预检工具

一个本地运行的 CLI 工具，用于检测多语言截图中的文字遮挡、安全区违规和截断风险。

## 功能特性

- 按设备/页面/语言分组比对截图
- 检测文字区域占位变化
- 验证状态栏安全区合规性
- 检测底部按钮遮挡风险
- 识别明显截断风险
- 输出 issues.csv、review.md 和交互式 HTML 预览

## 安装

```bash
npm install
```

## 快速开始

### 运行演示

```bash
npm run demo
```

演示会自动生成示例数据并输出报告到 `demo_output/` 目录。

### 分析自定义截图

1. 将截图文件放入 `screenshots/` 目录
2. 创建 `screen_manifest.csv` 配置文件
3. 创建 `layout_rules.yaml` 规则配置
4. 运行分析命令：

```bash
npm run analyze
```

或使用完整参数：

```bash
node cli.js analyze \
  --input screenshots \
  --output output \
  --manifest screenshots/screen_manifest.csv \
  --rules screenshots/layout_rules.yaml
```

## 配置文件格式

### screen_manifest.csv

| 字段 | 说明 | 必填 |
|------|------|------|
| device | 设备名称 | ✓ |
| page | 页面名称 | ✓ |
| language | 语言代码 | ✓ |
| filename | 截图文件名 | ✓ |
| base_language | 基准语言（默认为 en） | |
| dpr | 设备像素密度 | |

示例：
```csv
device,page,language,filename,base_language,dpr
iPhone15,home,en,home_en.png,en,3
iPhone15,home,zh,home_zh.png,en,3
iPhone15,home,ja,home_ja.png,en,3
```

### layout_rules.yaml

```yaml
safe_areas:
  iPhone15:
    top: 47
    bottom: 34
    left: 0
    right: 0
  iPhone14:
    top: 47
    bottom: 30
    left: 0
    right: 0

text_regions:
  - device: iPhone15
    page: home
    x: 50
    y: 200
    width: 280
    height: 40

button_regions:
  - device: iPhone15
    page: home
    x: 50
    y: 750
    width: 280
    height: 50

truncation_checks:
  - device: iPhone15
    page: home
    region:
      x: 250
      y: 200
      width: 80
      height: 40
```

## 输出文件

| 文件 | 说明 |
|------|------|
| issues.csv | 问题列表（CSV 格式） |
| review.md | 详细报告（Markdown 格式） |
| preview.html | 交互式预览（可在浏览器中打开） |

## 问题类型

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| missing_base | critical | 缺少基准图 |
| missing_image | critical | 截图文件不存在 |
| size_mismatch | warning | DPR/尺寸不一致 |
| text_expansion | warning | 文字区域可能扩展 |
| button_occlusion | error | 文字可能遮挡按钮 |
| safe_area_violation | warning | 文字区域超出安全区 |
| truncation_risk | warning | 存在截断风险 |

## 目录结构

```
.
├── cli.js                    # CLI 命令入口
├── package.json              # 项目配置
├── README.md                 # 文档
├── demo_screenshots/         # 演示截图目录
├── demo_output/              # 演示输出目录
├── screenshots/              # 用户截图目录
├── output/                   # 用户输出目录
├── src/
│   ├── config-parser.js      # 配置解析模块
│   ├── image-analyzer.js     # 图像分析模块
│   ├── rule-engine.js        # 规则引擎模块
│   └── report-renderer.js    # 报告渲染模块
└── test/
    └── rule-engine.test.js   # 测试用例
```

## 运行测试

```bash
npm test
```