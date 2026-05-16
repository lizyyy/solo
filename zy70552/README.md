# SQL迁移影子回放CLI

## 简介
在带历史数据的影子数据库上验证SQL迁移脚本的命令行工具。

## 关键特性
- SQL执行编排
- 影响行统计
- 回滚校验机制
- 失败保留现场状态
- 多格式报告导出（终端摘要、JSON、Markdown）
- 坏行记录与原始位置追踪
- 每次运行独立输出目录

## 安装
npm install
npm run build

## 使用方法
node dist/cli.js run -m example/migrations -d example/shadow-data -s example/schemas -c example/db-config.json -o output

## 参数说明
-m, --migrations: 迁移脚本目录路径
-d, --shadow-data: 影子数据目录路径
-s, --schemas: 表结构JSON路径
-c, --db-config: 数据库配置JSON路径
-o, --output: 报告输出目录
