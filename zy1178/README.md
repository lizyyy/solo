# 屋顶光伏排布和收益模拟工具

一个用于屋顶光伏系统设计、发电量计算和收益分析的本地小工具。

## 功能特性

### 数据导入
- **屋顶轮廓绘制**：通过Canvas画布绘制屋顶多边形轮廓
- **障碍物绘制**：绘制烟囱、女儿墙、通风口等障碍物并设置高度
- **组件参数设置**：配置光伏组件的功率、效率、尺寸、温度系数等参数
- **逐小时数据导入**：支持CSV格式导入日照辐照度、温度、电价等数据

### 核心计算
- **遮阴分析**：
  - 基于地理位置计算太阳位置（高度角、方位角）
  - 计算障碍物阴影投射区域
  - 生成遮阴热力图
  - 统计年遮阴小时数和遮阴损失率

- **发电量计算**：
  - 计算有效辐照度（考虑倾角和遮阴）
  - 计算组件工作温度
  - 考虑温度系数和系统损耗
  - 生成月度发电量曲线

- **收益计算**：
  - 计算自发自用和上网电量收益
  - 投资回收期计算
  - 净现值(NPV)和内部收益率(IRR)计算
  - 考虑组件衰减率

### 方案管理
- **多方案对比**：支持创建多个排布方案并进行对比分析
- **可视化展示**：
  - 遮阴热力图
  - 月度发电量柱状图
  - 月度收益折线图
  - 关键指标卡片展示

### 报告导出
- 支持导出 **Markdown** 格式报告
- 支持导出 **JSON** 格式数据
- 包含方案对比分析
- 包含风险提示和建议

## 技术栈

### 后端
- **框架**: Python + FastAPI
- **数据库**: SQLite + SQLAlchemy
- **科学计算**: 
  - Shapely (几何计算)
  - Pandas (数据处理)
  - NumPy (数值计算)
- **测试**: pytest

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件**: Ant Design
- **图表库**: ECharts
- **状态管理**: React Query
- **画布**: 原生Canvas API

## 项目结构

```
zy1178/
├── backend/                    # 后端项目
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI应用入口
│   │   ├── database.py        # 数据库配置
│   │   ├── models.py          # SQLAlchemy模型
│   │   ├── schemas.py         # Pydantic模型
│   │   ├── routers/           # API路由
│   │   │   ├── __init__.py
│   │   │   ├── projects.py    # 项目管理API
│   │   │   ├── calculations.py # 计算分析API
│   │   │   └── exports.py     # 报告导出API
│   │   └── calculators/       # 核心计算器
│   │       ├── __init__.py
│   │       ├── shading.py     # 遮阴计算
│   │       ├── generation.py  # 发电量计算
│   │       └── revenue.py     # 收益计算
│   ├── tests/                  # 测试文件
│   │   ├── __init__.py
│   │   ├── conftest.py        # 测试配置
│   │   ├── test_calculators.py# 计算器单元测试
│   │   └── test_api.py        # API接口测试
│   ├── data/                   # 数据文件
│   │   ├── seed_hourly_data.csv          # 标准样本数据
│   │   ├── abnormal_case_1_high_shading.csv   # 高遮阴场景
│   │   ├── abnormal_case_2_low_irradiance.csv # 低辐照度场景
│   │   └── abnormal_case_3_high_electricity_price.csv # 高电价场景
│   └── requirements.txt        # Python依赖
├── frontend/                   # 前端项目
│   ├── src/
│   │   ├── main.tsx            # 入口文件
│   │   ├── App.tsx             # 主应用组件
│   │   ├── index.css           # 全局样式
│   │   ├── types/              # TypeScript类型定义
│   │   │   └── index.ts
│   │   ├── api/                # API服务
│   │   │   └── index.ts
│   │   ├── pages/              # 页面组件
│   │   │   ├── ProjectList.tsx # 项目列表页
│   │   │   └── ProjectDetail.tsx # 项目详情页
│   │   └── components/         # 公共组件
│   │       └── CanvasEditor.tsx # 画布编辑器
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
└── README.md
```

## 安装与运行

### 环境要求
- Python 3.9+
- Node.js 18+
- npm 或 yarn

### 后端安装

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境 (macOS/Linux)
source venv/bin/activate

# 激活虚拟环境 (Windows)
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 运行开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档地址:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 前端安装

```bash
cd frontend

# 安装依赖
npm install

# 运行开发服务器
npm run dev
```

前端访问地址: http://localhost:3000

### 运行测试

```bash
cd backend

# 运行所有测试
pytest

# 运行测试并显示详细输出
pytest -v

# 运行特定测试文件
pytest tests/test_calculators.py
pytest tests/test_api.py
```

## 使用指南

### 1. 创建项目
1. 访问前端页面 http://localhost:3000
2. 点击"新建项目"按钮
3. 填写项目名称、位置、经纬度等信息

### 2. 配置基本信息
进入项目详情页，在"基本设置"标签页中：

#### 2.1 绘制屋顶轮廓
1. 在"屋顶轮廓"画布上点击添加顶点
2. 点击第一个顶点闭合多边形
3. 系统自动计算面积并保存

#### 2.2 绘制障碍物
1. 设置障碍物高度
2. 在"障碍物"画布上绘制障碍物多边形
3. 点击第一个顶点闭合多边形

#### 2.3 设置组件参数
1. 填写组件型号、功率、效率
2. 设置组件尺寸（宽、高）
3. 配置温度系数、设计寿命等参数

#### 2.4 导入逐小时数据
1. 准备CSV格式的数据文件（参考 `backend/data/seed_hourly_data.csv`）
2. 拖拽或点击上传CSV文件
3. 必需字段: `timestamp`, `global_irradiance`, `electricity_price`

### 3. 创建排布方案
切换到"排布方案"标签页：
1. 在画布上点击放置光伏组件
2. 可通过"撤销"按钮移除最后一个组件
3. 点击"保存方案"，输入方案名称
4. 可创建多个方案进行对比

### 4. 运行计算
1. 在"排布方案"列表中，点击"运行计算"按钮
2. 系统将计算：
   - 遮阴小时数和遮阴损失率
   - 可安装容量和实际装机容量
   - 年发电量和月度发电量
   - 年收益和月度收益
   - 投资回收期、NPV、IRR等财务指标
   - 风险因子评估

### 5. 查看结果
切换到"计算结果"标签页：
1. 查看各方案的关键指标对比卡片
2. 点击方案卡片查看详细信息
3. 查看月度发电量与收益图表
4. 查看遮阴分析和风险提示

### 6. 导出报告
切换到"报告导出"标签页：
1. 选择要导出的方案（可多选）
2. 选择导出格式（Markdown 或 JSON）
3. 点击"导出报告"按钮下载

## 数据格式说明

### 逐小时数据CSV格式

```csv
timestamp,global_irradiance,direct_irradiance,diffuse_irradiance,temperature,wind_speed,electricity_price,feed_in_tariff
2024-01-01 06:00:00,10,5,5,5,1.5,0.6,0.45
2024-01-01 07:00:00,150,100,50,5,2,0.6,0.45
2024-01-01 08:00:00,350,280,70,8,2.5,0.65,0.45
```

字段说明:
| 字段 | 类型 | 说明 |
|------|------|------|
| timestamp | string | 时间戳 (YYYY-MM-DD HH:MM:SS) |
| global_irradiance | float | 总辐照度 (W/m²) |
| direct_irradiance | float | 直接辐照度 (W/m²), 可选 |
| diffuse_irradiance | float | 散射辐照度 (W/m²), 可选 |
| temperature | float | 环境温度 (°C), 可选 |
| wind_speed | float | 风速 (m/s), 可选 |
| electricity_price | float | 用电电价 (元/kWh) |
| feed_in_tariff | float | 上网电价 (元/kWh), 可选 |

### 异常场景说明

项目提供了3个异常场景样例数据：

1. **高遮阴场景** (`abnormal_case_1_high_shading.csv`)
   - 直射辐射比例低
   - 散射辐射比例高
   - 模拟建筑物密集遮挡场景

2. **低辐照度场景** (`abnormal_case_2_low_irradiance.csv`)
   - 整体日照水平低
   - 模拟高纬度或阴雨连绵地区

3. **高电价场景** (`abnormal_case_3_high_electricity_price.csv`)
   - 电价是标准值的2-3倍
   - 模拟商业用电或峰时电价

## API 接口说明

### 项目管理
- `POST /api/projects/` - 创建项目
- `GET /api/projects/` - 获取项目列表
- `GET /api/projects/{id}` - 获取项目详情
- `PUT /api/projects/{id}` - 更新项目
- `DELETE /api/projects/{id}` - 删除项目

### 屋顶与障碍物
- `POST /api/projects/roofs/` - 创建屋顶轮廓
- `GET /api/projects/{project_id}/roofs/` - 获取项目屋顶列表
- `POST /api/projects/obstacles/` - 创建障碍物
- `GET /api/projects/{project_id}/obstacles/` - 获取项目障碍物列表

### 组件与数据
- `POST /api/projects/panels/` - 创建组件参数
- `GET /api/projects/{project_id}/panels/` - 获取组件参数列表
- `POST /api/projects/hourly-data/csv/` - 导入逐小时CSV数据
- `GET /api/projects/{project_id}/hourly-data/` - 获取逐小时数据列表

### 排布方案
- `POST /api/projects/layouts/` - 创建排布方案
- `GET /api/projects/{project_id}/layouts/` - 获取排布方案列表
- `PUT /api/projects/layouts/{layout_id}/activate` - 激活方案

### 计算分析
- `POST /api/calculations/run` - 运行计算
- `GET /api/calculations/results/{result_id}` - 获取计算结果
- `GET /api/calculations/project/{project_id}/results` - 获取项目所有计算结果

### 报告导出
- `POST /api/exports/report` - 导出分析报告

## 核心算法说明

### 遮阴计算
1. **太阳位置计算**：基于日期、时间、经纬度计算太阳高度角和方位角
2. **阴影投射计算**：根据障碍物高度和太阳位置计算阴影多边形
3. **几何交集计算**：使用Shapely计算组件与阴影区域的交集
4. **热力图生成**：对屋顶区域进行网格采样，计算各点遮阴比例

### 发电量计算
1. **有效辐照度**：考虑屋顶倾角和遮阴损失
2. **组件温度**：基于环境温度、辐照度、风速计算
3. **功率输出**：考虑温度系数、系统损耗、性能比(PR)
4. **月度汇总**：按月份统计发电量

### 收益计算
1. **小时收益**：区分自发自用和上网电量
2. **财务指标**：
   - 投资回收期：累计现金流回正时间
   - 净现值(NPV)：考虑折现率的现金流量现值
   - 内部收益率(IRR)：NPV为0时的折现率
3. **风险评估**：基于遮阴率、容量利用率、单位发电量、回收期等指标

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至开发者邮箱
