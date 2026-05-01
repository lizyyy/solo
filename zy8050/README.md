# 电子价签发布预检 CLI 工具

这是一个用于电子价签发布前预检的 Node/TypeScript CLI 工具，可以帮助你检查产品数据、多语言、字体和设备兼容性等问题。

## 功能

- ✅ 解析产品 CSV、多语言 JSON、字体覆盖 JSON 和设备配置 YAML
- 🔍 检查重复 SKU
- 🌍 检查缺失的翻译
- 🔤 检查字体缺失字符
- 💲 检查价格格式
- 📐 估算像素宽度溢出
- 🎨 检查设备模板匹配
- 🚥 检查三色屏促销标签支持
- 📦 生成字体子集清单
- 📊 导出问题报告、预览和清单

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

## 运行 Demo

```bash
npm run demo
```

这将使用 `sample/` 目录下的示例数据运行预检，并将报告输出到 `output/` 目录。

## 手动运行

```bash
npm run build
node dist/cli.js \
  --products sample/products.csv \
  --locales sample/locales.json \
  --font-coverage sample/font_coverage.json \
  --device-profiles sample/device_profiles.yaml \
  --output output
```

## 命令行参数

- `--products, -p`: 产品 CSV 文件路径 (必填)
- `--locales, -l`: 多语言 JSON 文件路径 (必填)
- `--font-coverage, -f`: 字体覆盖 JSON 文件路径 (必填)
- `--device-profiles, -d`: 设备配置 YAML 文件路径 (必填)
- `--output, -o`: 输出目录 (默认: `output`)

## 输入文件格式

### products.csv

```csv
sku,name,price,original_price,tags,template_id,device_profile
SKU001,有机牛奶,¥19.9,¥29.9,促销|新品,template_square,device_2.13
```

### locales.json

```json
{
  "zh-CN": {
    "name": "简体中文",
    "translations": {
      "促销": "促销",
      "新品": "新品"
    }
  }
}
```

### font_coverage.json

```json
{
  "default_font": {
    "name": "NotoSansSC",
    "supported_chars": "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ¥$€. ,-|有牛草奶全面包新鲜草品特促销价热"
  }
}
```

### device_profiles.yaml

```yaml
device_2.13:
  width: 250
  height: 122
  color_mode: black_red
  supported_templates:
    - template_square
    - template_slim
  max_pixel_width: 240
  char_width: 12
```

## 输出文件

- `issues.csv`: 所有发现的问题列表
- `subset_manifest.json`: 字体子集清单
- `preview.md`: 完整的预览报告

## 运行测试

```bash
npm test
```

## 项目结构

```
├── src/
│   ├── types/           # 类型定义
│   ├── parsers/         # 文件解析模块
│   ├── validators/      # 规则校验模块
│   ├── layout/          # 布局估算模块
│   ├── exporters/       # 导出模块
│   └── cli.ts           # CLI 入口
├── sample/              # 示例数据
├── output/              # 输出目录
└── package.json
```

## License

MIT
