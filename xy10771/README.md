# 前端构建产物巡检系统

一个可本地运行的 API 项目，用于前端构建产物的质量巡检。

## 功能特性

- 📦 **版本管理**：录入和管理构建版本信息
- 🔍 **SourceMap 检查**：根据 JS 资源大小判断是否需要 SourceMap
- 🗄️ **缓存策略检查**：验证文件哈希和 Cache-Control 配置
- 🔄 **回滚机制**：缓存策略失败时支持回滚并记录原因
- ✅ **修正路径**：提供缓存问题的修正方案并记录
- 📋 **巡检记录**：生成完整的巡检报告
- 📊 **图表看板**：可视化展示状态分布
- ⏱️ **时间线追踪**：完整记录每个版本的处理历程
- 🛡️ **防重复提交**：避免重复点击或刷新导致的状态混乱

## 技术栈

- **后端**：Python Flask
- **前端**：原生 HTML + JavaScript + Chart.js
- **数据存储**：JSON 文件

## 安装运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

### 3. 访问系统

打开浏览器访问：`http://localhost:5000`

## 业务流程

1. **录入版本**：质量负责人录入构建版本信息
2. **SourceMap 检查**：系统根据 JS 资源大小判断是否需要 SourceMap
3. **缓存策略检查**：验证文件哈希和 Cache-Control 配置
4. **处理分支**：
   - 检查通过 → 生成巡检记录
   - 检查失败 → 选择回滚或修正
5. **修正后流程**：修正后可继续生成巡检记录

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/build-versions | 获取所有构建版本 |
| POST | /api/build-versions | 创建新构建版本 |
| POST | /api/build-versions/:id/check-sourcemap | 检查 SourceMap |
| POST | /api/build-versions/:id/check-cache | 检查缓存策略 |
| POST | /api/build-versions/:id/rollback | 执行回滚 |
| POST | /api/build-versions/:id/correct | 应用修正方案 |
| GET | /api/inspection-records | 获取巡检记录 |
| POST | /api/inspection-records | 创建巡检记录 |
| GET | /api/timeline/:buildId | 获取版本时间线 |
| GET | /api/stats | 获取统计数据 |

## 项目结构

```
.
├── app.py                 # Flask 应用主文件
├── requirements.txt       # Python 依赖
├── static/
│   ├── index.html        # 前端页面
│   └── app.js            # 前端逻辑
└── data/                 # 数据存储目录（自动创建）
    ├── build_versions.json
    ├── inspection_records.json
    └── timeline.json
```
