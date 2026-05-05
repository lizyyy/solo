# 微塑料滤膜初筛台 - Microplastic Filter Screener

一个用于环境检测实验室的微塑料滤膜初筛系统，帮助实验室人员快速分类显微镜照片中的颗粒（纤维、气泡、划痕、颗粒），支持人工复核和报告导出。

## 功能特性

- 🔬 **智能分类**: 基于形态特征的规则分类器，自动区分纤维、气泡、划痕和颗粒
- 👀 **人工复核**: 可视化界面对颗粒进行复核和改判
- 📊 **批次管理**: 按采样批次组织数据，支持快速查询
- 📄 **报告导出**: 生成 Markdown 质检单、CSV 风险清单、JSON 审计包
- 📁 **数据导入**: 支持 CSV 文件导入，包含显微镜照片、标注数据、空白对照
- 🔒 **审计追踪**: 完整的操作日志记录，满足实验室合规要求

## 项目结构

```
xy4469/
├── backend/                    # 后端代码
│   ├── app.py                  # Flask 应用入口
│   ├── config.py               # 配置文件
│   ├── requirements.txt        # Python 依赖
│   ├── models/                 # 数据模型
│   │   ├── __init__.py
│   │   └── database.py         # SQLAlchemy 模型定义
│   ├── routes/                 # API 路由
│   │   ├── __init__.py
│   │   ├── batches.py          # 批次管理 API
│   │   ├── particles.py        # 颗粒管理 API
│   │   └── exports.py          # 导出 API
│   └── services/               # 业务逻辑
│       ├── __init__.py
│       ├── classifier.py       # 分类器
│       ├── data_import.py      # 数据导入
│       └── exporter.py         # 数据导出
├── frontend/                   # 前端代码
│   ├── index.html              # 主页面
│   └── static/
│       ├── css/
│       │   └── style.css       # 样式文件
│       └── js/
│           ├── api.js          # API 客户端
│           └── app.js          # 应用逻辑
├── data/                       # 数据目录
│   ├── examples/               # 示例数据
│   │   ├── batch_info.csv      # 批次信息
│   │   ├── annotations.csv     # 颗粒标注
│   │   └── controls.csv        # 空白对照
│   ├── uploads/                # 上传文件
│   └── images/                 # 图像文件
└── README.md                   # 本文档
```

## 快速开始

### 1. 环境要求

- Python 3.8+
- pip 包管理器

### 2. 安装依赖

```bash
cd /path/to/xy4469/backend
pip install -r requirements.txt
```

### 3. 启动服务

```bash
cd /path/to/xy4469/backend
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 4. 访问系统

打开浏览器访问: http://localhost:5000

## 验证流程

### 步骤 1: 导入示例数据

1. 启动服务后，访问 http://localhost:5000
2. 在"批次管理"标签页，点击右上角"导入示例数据"按钮
3. 确认导入后，系统会自动加载预设的示例数据

示例数据包含:
- 1 个批次: 长江口表层水样 (SAMPLE-2024-001)
- 15 个颗粒: 包含纤维、气泡、划痕、颗粒等各类
- 3 组空白对照: 实验室、现场、流程对照

### 步骤 2: 查看批次列表

1. 在"批次管理"标签页，查看已导入的批次
2. 点击"查看"按钮或切换到"颗粒复核"标签页

### 步骤 3: 筛选和复核颗粒

1. 在"颗粒复核"标签页，选择批次
2. 使用筛选条件:
   - 分类: 纤维/颗粒/气泡/划痕/未明确
   - 风险: 高/中/低
   - 状态: 已复核/未复核
3. 点击任意颗粒卡片查看详情
4. 在详情弹窗中:
   - 查看自动分类结果和置信度
   - 查看形态特征数据（面积、周长、高宽比、圆形度等）
   - 选择人工分类判定
   - 调整置信度滑块
   - 填写复核人姓名和备注
   - 点击"提交复核"保存

### 步骤 4: 导出报告

1. 切换到"导出报告"标签页
2. 选择要导出的批次
3. 选择导出格式:
   - **Markdown 质检单**: 完整的质检报告，包含统计摘要、分类统计、风险分析、高风险颗粒列表
   - **CSV 风险清单**: 所有颗粒的详细风险信息，便于后续分析
   - **JSON 审计包**: 完整的审计数据包，包含所有特征数据和操作历史

## 分类说明

### 分类类型

| 分类 | 图标 | 特征说明 | 风险等级 |
|------|------|----------|----------|
| 纤维 | 🔴 | 细长条形，高宽比 > 3，圆形度 < 0.4 | 高风险 |
| 颗粒 | 🟡 | 不规则形状，面积较大 | 中风险 |
| 气泡 | 🔵 | 圆形/近圆形，圆形度 > 0.85，亮度高 | 低风险 |
| 划痕 | ⚪ | 极细长条形，高宽比 > 5，滤膜缺陷 | 低风险 |
| 未明确 | ⚫ | 特征不明显，需人工确认 | 中风险 |

### 风险等级

- **高风险 (High)**: 纤维类微塑料，需要重点关注
- **中风险 (Medium)**: 大型颗粒，需进一步分析
- **低风险 (Low)**: 气泡、划痕等非微塑料

## 数据格式说明

### 批次表 (batch_info.csv)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| batch_id | string | 是 | 批次唯一标识 |
| sample_name | string | 是 | 样本名称 |
| collection_date | date | 否 | 采样日期 |
| location | string | 否 | 采样地点 |
| sample_type | string | 否 | 样本类型 |
| technician | string | 否 | 检测人员 |
| notes | string | 否 | 备注 |

### 标注表 (annotations.csv)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| particle_id | string | 是 | 颗粒唯一标识 |
| image_path | string | 否 | 图像路径 |
| x_coordinate | float | 否 | X 坐标 |
| y_coordinate | float | 否 | Y 坐标 |
| area | float | 否 | 面积 |
| perimeter | float | 否 | 周长 |
| aspect_ratio | float | 否 | 高宽比 |
| circularity | float | 否 | 圆形度 |
| solidity | float | 否 | 实心度 |
| extent | float | 否 | 延伸度 |
| mean_intensity | float | 否 | 平均亮度 |
| max_intensity | float | 否 | 最大亮度 |
| min_intensity | float | 否 | 最小亮度 |
| color_r | int | 否 | 红色通道值 |
| color_g | int | 否 | 绿色通道值 |
| color_b | int | 否 | 蓝色通道值 |
| manual_classification | string | 否 | 已有复核分类 |
| manual_confidence | float | 否 | 已有复核置信度 |
| reviewed_by | string | 否 | 复核人 |
| review_notes | string | 否 | 复核备注 |

### 对照表 (controls.csv)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| control_type | string | 否 | 对照类型 |
| control_name | string | 是 | 对照名称 |
| particle_count | int | 否 | 颗粒数 |
| fiber_count | int | 否 | 纤维数 |
| bubble_count | int | 否 | 气泡数 |
| notes | string | 否 | 备注 |

## API 文档

### 健康检查

```
GET /api/health
```

### 批次管理

```
GET    /api/batches                     # 列表批次
GET    /api/batches/{batch_id}          # 获取批次详情
GET    /api/batches/{batch_id}/particles # 获取批次颗粒
POST   /api/batches/import              # 导入数据
POST   /api/batches/import-examples     # 导入示例数据
DELETE /api/batches/{batch_id}          # 删除批次
```

### 颗粒管理

```
GET    /api/particles/{particle_id}          # 获取颗粒详情
POST   /api/particles/{particle_id}/review   # 复核颗粒
POST   /api/particles/{particle_id}/flag     # 标记/取消标记
```

### 报告导出

```
GET /api/exports/{batch_id}/quality-report   # Markdown 质检报告
GET /api/exports/{batch_id}/risk-list        # CSV 风险清单
GET /api/exports/{batch_id}/audit-package    # JSON 审计包
GET /api/exports/{batch_id}/preview          # 预览报告
```

## 分类器原理

本系统使用基于规则的分类器，通过形态特征进行分类：

### 关键特征

1. **高宽比 (Aspect Ratio)**: 长轴与短轴之比
   - 纤维: > 3.0
   - 划痕: > 5.0
   - 气泡/颗粒: < 2.0

2. **圆形度 (Circularity)**: 4π × 面积 / 周长²
   - 气泡: > 0.85
   - 纤维: < 0.4
   - 划痕: < 0.2

3. **实心度 (Solidity)**: 轮廓面积 / 凸包面积
   - 气泡: > 0.9
   - 纤维: < 0.85
   - 划痕: < 0.7

4. **亮度 (Intensity)**: 灰度平均值
   - 气泡: > 150 (透明/反光)

### 置信度计算

分类器会计算每个类别匹配度分数，选择最高分作为自动分类结果，置信度为该分数（0-0.95）。

## 注意事项

1. **数据备份**: 数据库文件存储在 `backend/microplastic.db`，定期备份
2. **文件存储**: 上传的文件存储在 `data/uploads/`，定期清理
3. **性能优化**: 大量颗粒数据建议分批导入
4. **浏览器兼容**: 建议使用 Chrome、Firefox、Safari 最新版本

## 技术栈

- **后端**: Python 3.8+, Flask, SQLAlchemy, pandas, scikit-learn
- **前端**: HTML5, CSS3, JavaScript (原生)
- **数据库**: SQLite
- **通信**: RESTful API + CORS

## 许可证

本项目仅供教育和研究用途。

## 联系方式

如有问题或建议，请联系开发团队。
