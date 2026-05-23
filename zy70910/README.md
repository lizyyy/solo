# 新能源对账服务

新能源电站电费对账、数据核对和报表生成服务。

## 功能特性

- 电费数据导入和解析（支持 CSV、Excel 格式）
- 自动对账匹配和差异分析
- 对账报表生成和导出
- 电站基础数据管理
- RESTful API 接口

## 技术栈

- Node.js - 运行环境
- Express - Web 框架
- SQLite3 - 数据库
- Multer - 文件上传
- csv-parser - CSV 文件解析
- xlsx - Excel 文件处理
- Joi - 参数校验
- Day.js - 日期处理

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

npm install

### 配置环境变量

复制 .env 文件并根据需要修改配置

### 启动服务

开发模式：npm run dev
生产模式：npm start

服务默认运行在 http://localhost:3000

## 许可证

ISC
