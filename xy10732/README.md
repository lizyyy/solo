# 定时任务日历中心

一个完整的全栈Web应用，用于管理和监控定时任务的执行日历。

## 功能特性

### 核心功能
- **执行日历**：按日历视图展示任务执行情况，支持月份切换
- **任务管理**：创建、查看、管理定时任务，支持Cron表达式
- **图表看板**：可视化展示任务执行统计数据
- **四种状态路径**：成功、拦截、补偿、人工复核

### 高级功能
- **依赖资源追踪**：记录任务依赖的资源变化
- **错过执行检测**：自动标记错过的执行
- **补跑窗口管理**：支持标记补偿执行
- **差异预览**：对比原始数据与重新计算的数据
- **导出面板**：支持Excel格式导出执行日历

## 技术栈

### 后端
- **FastAPI**：高性能Web框架
- **SQLAlchemy**：ORM框架
- **SQLite**：数据库
- **Pandas + OpenPyXL**：Excel导出
- **Croniter**：Cron表达式解析

### 前端
- **Vue 3**：渐进式JavaScript框架
- **Element Plus**：UI组件库
- **ECharts**：数据可视化图表
- **Day.js**：日期处理
- **Axios**：HTTP客户端

## 快速开始

### 一键启动
```bash
chmod +x start.sh
./start.sh
```

### 手动启动

#### 后端服务
```bash
cd backend
pip install -r requirements.txt
python init_data.py  # 初始化示例数据
python main.py
```
- 后端地址: http://localhost:8000
- API文档: http://localhost:8000/docs

#### 前端服务
```bash
cd frontend
npm install
npm run dev
```
- 前端地址: http://localhost:3000

## API接口

### 任务管理
- `POST /api/tasks` - 创建新任务
- `GET /api/tasks` - 获取任务列表

### 日历查询
- `GET /api/calendar/{year}/{month}` - 获取指定月份的执行日历

### 执行管理
- `POST /api/executions/{id}/status` - 更新执行状态
- `POST /api/executions/{id}/compensate` - 标记为补偿执行
- `POST /api/executions/{id}/review` - 标记为需要人工复核

### 统计导出
- `GET /api/stats/dashboard` - 获取看板统计数据
- `GET /api/export/{year}/{month}` - 导出执行日历Excel

## 使用说明

1. **创建任务**：进入"任务管理"页面，点击"新建任务"，填写任务名称、Cron表达式、描述和依赖资源
2. **查看日历**：进入"执行日历"页面，按月份查看任务执行情况
3. **管理执行**：点击日历中的执行项，可标记为成功、拦截、补偿或人工复核
4. **查看统计**：进入"图表看板"页面，查看任务执行的统计图表
5. **导出数据**：在日历页面点击"导出"按钮，选择月份导出Excel

## 验收要点

1. 页面操作：通过页面创建任务、更新执行状态，确认结果正确显示
2. 接口重复提交：通过API文档重复提交相同请求，确认不会重复写入
3. 前后端对齐：页面显示的数据与API返回的数据一致
4. 依赖资源变化：相关记录支持重新计算与差异预览

## 项目结构

```
.
├── backend/
│   ├── main.py          # FastAPI主程序
│   ├── init_data.py     # 示例数据初始化
│   ├── requirements.txt # Python依赖
│   └── task_calendar.db # SQLite数据库 (自动生成)
├── frontend/
│   ├── src/
│   │   ├── main.js      # 入口文件
│   │   ├── App.vue      # 根组件
│   │   ├── router/      # 路由配置
│   │   ├── api/         # API封装
│   │   └── views/       # 页面组件
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── start.sh             # 一键启动脚本
└── README.md
```
