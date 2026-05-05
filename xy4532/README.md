# 海上风电运维 AI 初筛工具

一个用于海上风电运维的本地 AI 初筛工具，帮助运维人员快速识别叶片裂纹、雷击点等风险，判断是否属于同一台机组，以及哪些需要立刻停机。

## 功能特性

- 📸 **图像特征分析**：基于图像特征的简单 AI 检测（裂纹、雷击点等）
- 🗺️ **无人机航迹关联**：导入无人机航迹 JSON，关联照片位置
- 🚨 **SCADA 告警整合**：自动关联 SCADA 告警数据
- 📋 **工单历史匹配**：与历史维修工单进行关联匹配
- 🎯 **规则评分引擎**：多维度综合风险评估
- ✋ **人工改判**：支持人工干预，保存改判记录
- 📄 **Markdown 导出**：导出格式化的复核单
- 📊 **JSON 明细导出**：导出完整的结构化数据

## 项目结构

```
xy4532/
├── backend/                    # 后端项目 (Python FastAPI)
│   ├── routers/                # API 路由
│   │   ├── __init__.py
│   │   ├── data_management.py  # 数据管理（导入/导出）
│   │   ├── inspections.py      # 巡检记录
│   │   ├── risk_assessments.py # 风险评估
│   │   └── turbines.py         # 风机管理
│   ├── config.py               # 配置文件
│   ├── database.py             # 数据库连接
│   ├── feature_extractor.py    # 图像特征提取
│   ├── main.py                 # 应用入口
│   ├── models.py               # 数据模型
│   ├── risk_scoring.py         # 风险评分引擎
│   ├── schemas.py              # Pydantic 模式
│   ├── requirements.txt        # Python 依赖
│   ├── uploads/                # 上传文件目录
│   └── exports/                # 导出文件目录
├── frontend/                   # 前端项目 (Vue3 + TypeScript)
│   ├── src/
│   │   ├── api/                # API 接口
│   │   │   ├── dashboard.ts
│   │   │   ├── data_management.ts
│   │   │   ├── index.ts
│   │   │   ├── inspections.ts
│   │   │   ├── risk_assessments.ts
│   │   │   └── turbines.ts
│   │   ├── router/             # 路由配置
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── types/              # TypeScript 类型
│   │   ├── views/              # 页面组件
│   │   │   ├── Dashboard/      # 首页仪表盘
│   │   │   ├── Turbines/       # 风机管理
│   │   │   ├── RiskAssessments/# 风险评估
│   │   │   ├── Import/         # 数据导入
│   │   │   └── Export/         # 数据导出
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── sample_data/                # 示例数据
│   ├── flight_path_20240115.json
│   ├── scada_alarms_20240115.json
│   └── work_orders_20240115.json
└── README.md                   # 本文档
```

## 快速开始

### 环境要求

- Python 3.9+
- Node.js 18+
- SQLite (默认使用，无需额外安装)

### 1. 安装后端

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt

# 启动后端服务 (数据库会自动初始化)
python main.py
# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端服务将运行在 http://localhost:8000

API 文档：http://localhost:8000/docs

### 2. 安装前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将运行在 http://localhost:3000

### 3. 访问应用

打开浏览器访问 http://localhost:3000

## 验证流程

### 步骤 1：初始化示例数据

后端提供了一个 API 接口用于初始化示例数据：

```bash
# 启动后端服务后，调用初始化接口
curl -X POST http://localhost:8000/api/init-sample-data
```

或在前端启动后，通过 API 直接初始化。

### 步骤 2：准备示例数据

项目已提供示例数据文件位于 `sample_data/` 目录：

- `flight_path_20240115.json` - 无人机航迹数据
- `scada_alarms_20240115.json` - SCADA 告警数据
- `work_orders_20240115.json` - 维修工单数据

### 步骤 3：导入数据

1. 启动后端和前端服务
2. 打开浏览器访问 http://localhost:3000
3. 点击导航栏「数据导入」
4. 按以下顺序导入数据：

   **a. 导入 SCADA 告警**
   - 选择「SCADA告警」类型
   - 上传 `sample_data/scada_alarms_20240115.json`
   - 点击「上传并导入」

   **b. 导入维修工单**
   - 选择「维修工单」类型
   - 上传 `sample_data/work_orders_20240115.json`
   - 点击「上传并导入」

   **c. 导入无人机航迹**
   - 选择「无人机航迹」类型
   - 上传 `sample_data/flight_path_20240115.json`
   - 点击「上传并导入」

   **d. 导入叶片照片** (可选，需要准备实际图片)
   - 选择「叶片照片」类型
   - 上传 JPG/PNG 格式的叶片照片
   - 系统会自动进行图像特征分析和风险评估

### 步骤 4：查看风险评估

1. 点击导航栏「风险评估」
2. 查看所有风险评估记录
3. 可以按风险等级筛选
4. 点击「详情」查看完整的风险评估信息

### 步骤 5：人工改判

1. 在风险评估详情页面
2. 右侧找到「人工改判」表单
3. 选择新的风险等级
4. 输入改判原因
5. 点击「提交改判」
6. 系统会记录改判历史

### 步骤 6：导出数据

1. 点击导航栏「数据导出」
2. 选择导出格式（Markdown 或 JSON）
3. 设置导出范围和筛选条件
4. 点击导出按钮
5. 下载生成的文件

## API 接口说明

### 后端 API (端口 8000)

#### 首页与健康检查
- `GET /` - 根路径，返回系统信息
- `GET /api/health` - 健康检查
- `GET /api/dashboard` - 获取仪表盘统计数据
- `GET /api/dashboard/trends` - 获取趋势数据
- `POST /api/init-sample-data` - 初始化示例数据

#### 风机管理
- `GET /api/turbines/` - 获取风机列表
- `GET /api/turbines/{turbine_id}` - 获取风机详情
- `POST /api/turbines/` - 创建风机
- `PUT /api/turbines/{turbine_id}` - 更新风机
- `DELETE /api/turbines/{turbine_id}` - 删除风机

#### 风险评估
- `GET /api/risk-assessments/` - 获取评估列表
- `GET /api/risk-assessments/{assessment_id}` - 获取评估详情
- `POST /api/risk-assessments/manual-judgment` - 提交人工改判
- `POST /api/risk-assessments/{assessment_id}/reassess` - 重新评估
- `POST /api/risk-assessments/batch-reassess` - 批量重新评估
- `GET /api/risk-assessments/statistics/summary` - 获取风险统计

#### 数据导入
- `POST /api/data/upload-photos` - 导入叶片照片
- `POST /api/data/import-alarms` - 导入 SCADA 告警
- `POST /api/data/import-work-orders` - 导入维修工单
- `POST /api/data/import-flight-path` - 导入无人机航迹

#### 数据导出
- `POST /api/data/export/markdown` - 导出 Markdown 复核单
- `POST /api/data/export/json` - 导出 JSON 明细

## 风险评分规则

### 图像特征评分 (权重 40%)

| 特征类型 | 检测到 | 未检测到 |
|---------|-------|---------|
| 裂纹 | 0.90 | 0.10 |
| 雷击点 | 0.85 | 0.10 |
| 腐蚀 | 0.60 | 0.10 |
| 分层 | 0.80 | 0.10 |
| 表面磨损 | 0.30 | 0.10 |

### SCADA 告警评分 (权重 30%)

| 严重程度 | 活跃 | 已解决 |
|---------|------|-------|
| 严重 | 0.95 | 0.50 |
| 高 | 0.80 | 0.40 |
| 中 | 0.50 | 0.20 |
| 低 | 0.20 | 0.05 |

### 维修工单评分 (权重 20%)

| 优先级 | 待处理 | 处理中 | 已完成 |
|-------|-------|-------|-------|
| 紧急 | 0.90 | 0.70 | 0.20 |
| 高 | 0.70 | 0.50 | 0.15 |
| 中 | 0.40 | 0.30 | 0.10 |
| 低 | 0.20 | 0.15 | 0.05 |

### 时间衰减评分 (权重 10%)

| 最近检测时间 | 衰减系数 |
|-------------|---------|
| 1天内 | 1.00 |
| 3天内 | 0.80 |
| 7天内 | 0.60 |
| 30天内 | 0.30 |
| 超过30天 | 0.10 |

### 风险等级划分

| 评分范围 | 等级 | 建议动作 |
|---------|------|---------|
| 0.80 - 1.00 | 严重 | 立即停机检查 |
| 0.60 - 0.80 | 高 | 优先安排检修 |
| 0.40 - 0.60 | 中 | 计划内检修 |
| 0.00 - 0.40 | 低 | 持续监控 |

## 前端页面说明

### 首页仪表盘
- 统计概览：风机总数、风险评估数、活跃告警、处理工单
- 风险评估趋势图
- 风险等级分布饼图
- 待处理高风险列表
- 活跃告警列表
- 快速操作入口

### 风机管理
- 风机列表展示
- 按状态筛选
- 新增/删除风机
- 查看风机详情

### 风险评估
- 评估列表展示
- 按风险等级筛选
- 按人工改判筛选
- 批量选择导出
- 查看详情
- 人工改判

### 数据导入
- 三步引导式导入
- 支持文件上传
- 导入结果展示

### 数据导出
- Markdown 复核单导出
- JSON 明细导出
- 多种筛选条件

## 开发说明

### 后端开发

```bash
cd backend

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 运行服务
python main.py
# 或
uvicorn main:app --reload --port 8000
```

### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 开发模式
npm run dev

# 类型检查
npm run build  # 会自动进行类型检查

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 配置说明

### 后端配置 (config.py)

默认配置已设置好，可通过环境变量覆盖：

```env
# 数据库配置
DATABASE_URL=sqlite:///./wind_power.db

# 文件存储配置
UPLOAD_DIR=./uploads
EXPORT_DIR=./exports

# 风险评分配置
CRITICAL_RISK_THRESHOLD=0.8
HIGH_RISK_THRESHOLD=0.6
MEDIUM_RISK_THRESHOLD=0.3
```

### 前端配置 (vite.config.ts)

```typescript
// 代理配置
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
  '/uploads': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
}
```

## 注意事项

1. **图像分析**：当前实现使用基于图像特征的简单分析（颜色、边缘、亮度等），如需更精确的检测，建议集成深度学习模型（如 YOLO、ResNet 等）

2. **数据关联**：系统通过风机编号 (turbine_id) 和照片文件名进行数据关联，请确保导入的数据格式正确

3. **文件存储**：上传的文件存储在 `backend/uploads/` 目录，建议定期备份

4. **数据库**：使用 SQLite 数据库，文件名为 `wind_power.db`，存储在 backend 目录下

5. **安全性**：生产环境请启用身份验证、HTTPS、文件类型限制等安全措施

## 故障排除

### 后端无法启动

```bash
# 检查 Python 版本
python --version

# 检查依赖是否完整
pip list

# 查看详细错误信息
uvicorn main:app --reload --log-level debug
```

### 前端无法连接后端

```bash
# 检查后端是否正常运行
curl http://localhost:8000/api/health

# 检查 vite 代理配置
# 确保 vite.config.ts 中的 proxy 配置正确
```

### 图片上传失败

```bash
# 检查上传目录权限
ls -la backend/uploads/

# 检查文件大小
# 默认无明确限制，建议不超过 10MB

# 检查文件格式
# 支持 JPG、PNG
```

## 示例数据格式说明

### SCADA 告警数据格式

```json
{
  "data_source": "SCADA-System",
  "alarms": [
    {
      "alarm_id": "ALARM-001",
      "turbine_id": "WT-015",
      "alarm_code": "BLADE_VIB_001",
      "alarm_name": "叶片振动异常",
      "severity": "严重",
      "description": "描述信息",
      "trigger_time": "2024-01-15T14:32:15Z",
      "is_active": true
    }
  ]
}
```

### 维修工单数据格式

```json
{
  "data_source": "CMMS-System",
  "work_orders": [
    {
      "work_order_id": "WO-001",
      "turbine_id": "WT-015",
      "issue_type": "叶片裂纹",
      "description": "描述信息",
      "priority": "高",
      "status": "待处理"
    }
  ]
}
```

### 无人机航迹数据格式

```json
{
  "mission_id": "FLIGHT-001",
  "turbine_id": "WT-015",
  "waypoints": [
    {
      "id": 1,
      "segment": "LE",
      "photo_path": "WT-015_LE_root.jpg",
      "timestamp": "2024-01-15T08:32:15Z"
    }
  ]
}
```

## 许可证

本项目仅供学习和交流使用。

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。
