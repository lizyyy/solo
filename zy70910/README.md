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

```bash
npm install
```

### 配置环境变量

复制 `.env` 文件并根据需要修改配置

### 初始化数据库

```bash
npm run init-db
```

### 启动服务

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

服务默认运行在 http://localhost:3000

## API 接口

### Base URL
```
http://localhost:3000/api/v1
```

### 数据导入接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/import/orders/csv` | POST | 导入订单CSV |
| `/import/charger-logs/json` | POST | 导入桩端日志JSON |
| `/import/payment-records` | POST | 导入支付记录 |

### 对账任务接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/reconciliation` | POST | 创建对账任务 |
| `/reconciliation` | GET | 获取对账任务列表 |
| `/reconciliation/:taskId` | GET | 获取对账任务详情 |
| `/reconciliation/:taskId/execute` | POST | 执行对账任务 |

### 差异管理接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/discrepancies` | GET | 获取差异列表 |
| `/discrepancies/:discrepancyId` | GET | 获取差异详情 |

### 复核管理接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/review/discrepancies/:discrepancyId/approve` | POST | 通过差异 |
| `/review/discrepancies/:discrepancyId/reject` | POST | 驳回差异 |
| `/review/discrepancies/:discrepancyId/request-info` | POST | 请求补充信息 |
| `/review/discrepancies/:discrepancyId/history` | GET | 获取复核历史 |

### 报告管理接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/reports/:taskId/generate` | POST | 生成对账报告 |
| `/reports/:reportId/download` | GET | 下载报告 |

### 健康检查

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 服务健康检查 |

## 使用示例

运行完整测试流程：
```bash
cd examples
./test-flow.sh
```

详细文档请查看 [API文档](docs/API.md) 和 [使用指南](docs/使用指南.md)

## 许可证

ISC
