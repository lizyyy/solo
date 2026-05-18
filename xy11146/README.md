# 公益助餐点助餐券核销稽核 CLI

专为公益助餐场景设计的助餐券核销数据稽核工具，支持跨日补传检测、等级变更检测、重复执行检测等功能。

## 快速开始

```bash
# 安装依赖
npm install

# 运行样例稽核
npm run sample

# 运行测试
npm test
```

## 使用方法

```bash
# 稽核单个文件
node src/cli.js audit data/sample.csv

# 稽核目录下所有CSV
node src/cli.js audit data/

# 指定输出目录
node src/cli.js audit data/sample.csv -o output/
```

## 稽核规则说明

详见 [config/rules.json](file:///Users/mac/pro/solo/workspaces/xy11146/config/rules.json)

- **跨日补传**: 核销日期与上传日期相差超过1天
- **等级变更**: 同一助餐券服务等级不一致
- **可复跑输出**: 同一助餐券同一日期多次核销
- **格式错误**: 必填字段缺失或格式错误

## 目录结构

```
.
├── config/          # 规则配置
├── data/            # 样例数据
├── src/             # 源代码
├── test/            # 测试脚本
└── output/          # 稽核结果
```
