# 数据库性能调优演练台

一个用于本地演练和分析数据库性能瓶颈的综合平台。

## 功能特性

- **慢 SQL 分析**: 解析慢查询日志，识别慢查询模式和优化建议
- **索引分析**: 检测索引缺失、过多、重复等问题
- **连接池分析**: 分析连接池配置，检测饱和、泄漏、超时等问题
- **读写分离分析**: 分析读写比例，检测读写路由问题
- **分库分表分析**: 检测分片键风险、数据倾斜、热点问题
- **批量写入分析**: 检测单条写入过多、批量过大等问题
- **报告导出**: 支持导出 Markdown 和 JSON 格式报告

## 项目结构

```
├── client/                # 前端 Vue 应用
│   ├── src/
│   │   ├── api/          # API 调用
│   │   ├── components/   # 组件
│   │   ├── router/       # 路由配置
│   │   └── views/        # 页面视图
│   ├── package.json
│   └── vite.config.js
├── server/                # 后端 Node.js 服务
│   ├── src/
│   │   ├── controllers/  # 控制器
│   │   ├── database/     # 数据库配置
│   │   ├── engines/      # 分析引擎
│   │   ├── middleware/   # 中间件
│   │   ├── models/       # 数据模型
│   │   └── routes/       # 路由
│   ├── tests/            # 测试文件
│   └── package.json
├── samples/               # 示例数据
│   ├── schema_bad_examples.sql    # 坏样例 Schema
│   ├── schema_good_examples.sql   # 好样例 Schema
│   ├── slow_log_examples.log      # 慢查询日志示例
│   ├── db_profile_example.json    # 数据库配置示例
│   ├── write_sample_single.json   # 单条写入样例
│   └── write_sample_hotspot.json  # 热点写入样例
└── package.json
```

## 快速开始

### 前置要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
# 安装所有依赖
npm run install:all
```

或者分别安装：

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 启动开发环境

```bash
# 同时启动前后端
npm run dev
```

或者分别启动：

```bash
# 启动后端服务 (端口 3001)
cd server
npm run dev

# 启动前端服务 (端口 3000)
cd client
npm run dev
```

### 访问应用

- 前端页面: http://localhost:3000
- 后端 API: http://localhost:3001

## 使用说明

### 1. 创建演练

1. 点击"新建演练"按钮
2. 填写演练名称和描述
3. 上传以下类型的文件：
   - **Schema 文件** (.sql): 数据库表结构定义
   - **慢查询日志** (.log, .txt): PostgreSQL 慢查询日志
   - **数据库配置** (.json): 连接池、索引等配置信息
   - **写入样例** (.json, .csv, .sql): 写入操作的样例数据

### 2. 运行分析

1. 进入演练详情页
2. 点击"运行性能分析"按钮
3. 系统将自动分析以下方面：
   - 慢查询问题
   - 索引问题
   - 连接池配置
   - 读写比例
   - 分片风险
   - 批量写入

### 3. 查看分析结果

- **概览**: 查看总体评分和统计数据
- **性能分析**: 查看雷达图和详细分析
- **瓶颈排序**: 按严重程度查看所有瓶颈问题
- **优化建议**: 查看 SQL、索引、连接池等优化建议
- **报告导出**: 导出 Markdown 或 JSON 格式报告

## 示例数据使用

项目提供了丰富的示例数据，位于 `samples/` 目录：

### 坏样例测试

使用 `schema_bad_examples.sql` 可以测试以下问题检测：

- 表无主键
- 索引过多 (9个索引)
- 外键无索引
- 缺少必要的索引
- 热点数据设计问题

### 慢查询日志测试

使用 `slow_log_examples.log` 可以测试以下问题：

- 全表扫描
- 无 LIMIT 的 SELECT
- SELECT *
- 前置通配符 LIKE
- ORDER BY 无索引
- 长事务
- 热点更新

### 连接池配置测试

使用 `db_profile_example.json` 可以测试：

- 连接池饱和
- 连接获取超时
- 等待时间过长

### 写入样例测试

使用 `write_sample_hotspot.json` 可以测试：

- 热点数据更新
- 分片热点风险

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/drills | 获取演练列表 |
| POST | /api/drills | 创建演练 |
| GET | /api/drills/:id | 获取演练详情 |
| PUT | /api/drills/:id | 更新演练 |
| DELETE | /api/drills/:id | 删除演练 |
| POST | /api/drills/:id/analyze | 运行分析 |
| GET | /api/drills/:id/analysis | 获取分析结果 |
| GET | /api/drills/:id/report/markdown | 导出 Markdown 报告 |
| GET | /api/drills/:id/report/json | 导出 JSON 报告 |

## 测试

运行后端单元测试：

```bash
cd server
npm test
```

## 技术栈

### 前端

- Vue 3 (Composition API)
- Vue Router 4
- Pinia (状态管理)
- Element Plus (UI 组件库)
- Vite (构建工具)
- ECharts (图表)
- Axios (HTTP 客户端)

### 后端

- Node.js + Express
- better-sqlite3 (SQLite 数据库)
- Multer (文件上传)
- Jest (测试框架)

## 支持的数据库

- PostgreSQL (主要支持)
- 可扩展支持其他数据库

## 常见问题

### 1. 分析结果不准确？

确保上传的文件格式正确：
- Schema 文件应为标准的 SQL DDL 语句
- 慢查询日志应为 PostgreSQL 格式
- JSON 文件应为有效的 JSON 格式

### 2. 如何扩展支持其他数据库？

可以在 `server/src/engines/` 目录下添加新的分析器：
- `slowLogParser.js` - 扩展日志解析
- `schemaAnalyzer.js` - 扩展 Schema 分析
- 添加新的分析引擎

### 3. 数据存储在哪里？

使用 SQLite 本地数据库，文件位于：
- `data/trainer.db` - 主数据库
- `uploads/` - 上传的文件存储

## License

MIT
