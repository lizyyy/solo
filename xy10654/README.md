# 诊所耗材召回冻结系统

一个完整的诊所耗材召回冻结管理系统，包含后端服务和前端界面。

## 功能特性

### 核心业务逻辑
- **耗材批号管理**：创建和管理耗材批号，包含生产日期、有效期、数量等信息
- **效期预警校验**：自动检测耗材有效期，7天内到期的耗材创建召回时会被拦截
- **科室领用记录**：记录各科室耗材领用情况
- **召回通知管理**：创建召回通知，自动计算风险科室和退回验收项
- **退回验收记录**：记录各科室退回耗材的验收情况，支持修改追溯
- **风险科室统计**：根据领用数量自动计算风险等级
- **操作日志追溯**：完整记录所有操作，支持按操作人和时间筛选

### 四大业务场景
1. **正常完成流程**：批号正常 → 创建召回 → 人工审核 → 退回验收 → 完成
2. **规则拦截场景**：批号即将过期 → 创建召回 → 系统自动拦截 → 人工复核
3. **人工复核场景**：被拦截的召回 → 人工复核通过 → 继续处理流程
4. **重复提交拦截**：同一批号已有进行中的召回 → 系统阻止重复创建

### 导出功能
- 支持导出 Excel 报表
- 报表包含：汇总统计、退回验收记录、修改历史、操作日志、风险科室统计
- 支持按责任人和处理时间筛选导出

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- ExcelJS 报表导出
- moment 时间处理

### 前端
- React 18
- React Router
- Ant Design
- Axios

## 快速开始

### 环境要求
- Node.js >= 14
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

### 启动开发环境

```bash
# 方式一：分别启动（推荐）
# 终端1 - 启动后端服务（端口 3001）
npm run server

# 终端2 - 启动前端服务（端口 3000）
cd client
npm start

# 方式二：使用 concurrently 同时启动
npm run dev
```

### 访问地址
- 前端界面：http://localhost:3000
- 后端 API：http://localhost:3001

## 测试流程

建议按以下步骤测试完整功能：

1. **创建耗材批号**
   - 在"召回列表"页面点击"创建耗材批号"
   - 建议创建两个批号：
     - 一个有效期较远（用于正常流程）
     - 一个有效期在7天内（用于测试拦截场景）

2. **添加科室领用记录**（需要使用 API 或数据库直接添加）
   - 为不同科室添加领用数量

3. **创建召回通知**
   - 选择有效期较远的批号：应正常创建
   - 选择7天内到期的批号：应被系统拦截
   - 重复创建同一批号的召回：应提示"已有进行中的召回"

4. **人工复核**
   - 在召回列表中对"已拦截"状态的召回点击"复核"按钮
   - 可以通过或取消

5. **退回验收**
   - 进入召回详情页面
   - 对各科室进行退回验收
   - 修改时需要填写修改原因

6. **查看操作日志**
   - 在"操作日志"页面查看所有操作记录
   - 支持按操作人和时间筛选

7. **导出报表**
   - 在"导出报表"页面预览和导出 Excel
   - 查看修改历史记录和影响的记录

## API 接口

### 耗材批号
- `POST /api/batches` - 创建批号
- `GET /api/batches` - 获取所有批号

### 科室领用
- `POST /api/department-usages` - 创建领用记录

### 召回通知
- `POST /api/recalls` - 创建召回
- `GET /api/recalls` - 获取召回列表
- `POST /api/recalls/:id/review` - 复核召回
- `GET /api/recalls/:id/timeline` - 获取召回时间线
- `GET /api/recalls/:id/risks` - 获取风险科室
- `GET /api/recalls/:id/acceptances` - 获取退回验收

### 退回验收
- `PUT /api/return-acceptances/:id` - 更新退回验收

### 操作日志
- `GET /api/operation-logs` - 获取操作日志

### 导出
- `GET /api/export` - 导出 Excel 报表
- `GET /api/export/json` - 获取 JSON 格式报表数据

## 数据库结构

主要数据表：
- `consumable_batches` - 耗材批号
- `expiry_alerts` - 效期预警
- `department_usages` - 科室领用
- `recall_notices` - 召回通知
- `return_acceptances` - 退回验收
- `risk_departments` - 风险科室
- `operation_logs` - 操作日志
- `modification_history` - 修改历史

## 项目结构

```
.
├── server/                 # 后端代码
│   ├── index.js           # 入口文件
│   ├── database.js        # 数据库配置
│   ├── routes.js          # API 路由
│   └── services/
│       └── recallService.js  # 业务逻辑
├── client/                # 前端代码
│   ├── public/
│   └── src/
│       ├── pages/         # 页面组件
│       │   ├── RecallsList.js
│       │   ├── RecallDetail.js
│       │   ├── OperationLogs.js
│       │   └── ExportPage.js
│       ├── App.js
│       └── index.js
├── data/                  # 数据库文件目录
└── package.json
```

## 注意事项

1. 数据库文件会自动创建在 `data/clinic.db`
2. 修改退回验收记录时必须填写修改原因，以便追溯
3. 导出的 Excel 文件包含多个工作表，涵盖所有相关数据
4. 所有操作都会记录到操作日志中，包括修改前后的值
