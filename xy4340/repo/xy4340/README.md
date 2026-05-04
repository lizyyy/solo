# 🌌 夜巡观测记录台

社区天文观测队专用的本地夜巡观测记录管理系统。

## 功能特性

- **数据录入**: 支持手动添加观测记录，包括观测点、设备、目标天体、云量、视宁度、设备电量、曝光计划和实际文件路径
- **CSV 导入**: 批量导入现有表格数据，自动创建关联的观测点、设备和目标
- **智能风险检测**: 自动检测以下风险：
  - 云量超标（默认 > 30%）
  - 设备电量不足（默认 < 20%）
  - 目标重复拍摄
  - 实际拍摄文件缺失
- **人工复核**: 支持复核人修改记录状态（通过/驳回/需重新复核），状态影响导出结果
- **数据导出**:
  - Markdown 观测简报（便于分享和存档）
  - JSON 审计包（完整结构化数据，适用于备份和迁移）
- **数据持久化**: 本地 SQLite 数据库存储

## 技术栈

- **后端**: Python 3 + Flask + SQLite
- **前端**: 原生 HTML/CSS/JavaScript（无框架依赖）
- **运行环境**: 本地桌面环境

## 快速开始

### 1. 环境准备

确保系统已安装 Python 3.7 或更高版本：

```bash
python3 --version
```

### 2. 安装依赖

在项目根目录下运行：

```bash
cd /path/to/xy4340
pip3 install -r requirements.txt
```

或者使用虚拟环境（推荐）：

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境 (macOS/Linux)
source venv/bin/activate

# 激活虚拟环境 (Windows)
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 启动应用

```bash
python3 app.py
```

或者：

```bash
python app.py
```

启动成功后，您将看到类似输出：

```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:8080
 * Running on http://192.168.x.x:8080
```

### 4. 访问应用

打开浏览器，访问：

```
http://localhost:8080
```

## 使用指南

### 首次使用流程

1. **添加基础数据**
   - 进入「基础数据」标签页
   - 添加观测点（如：天台观测点、南山观测站）
   - 添加设备（如：信达小黑望远镜、高桥EM200）
   - 添加目标天体（如：M42 猎户座大星云、M31 仙女座星系）

2. **添加观测记录**
   - 进入「添加记录」标签页
   - 填写观测日期、时间、观测点、设备、目标等信息
   - 云量、视宁度、电量会影响风险检测
   - 实际文件路径为空时会标记为「文件缺失」风险

3. **导入现有数据**
   - 进入「导入导出」标签页
   - 点击「下载示例」获取 CSV 模板
   - 按模板格式填写数据后拖拽上传

4. **复核记录**
   - 进入「观测记录」标签页
   - 点击记录的「查看」按钮
   - 在详情页输入复核人姓名，选择「通过/驳回/需重新复核」

### 风险检测规则

系统会自动检测以下风险：

| 风险类型 | 触发条件 | 严重程度 |
|---------|---------|---------|
| 云量超标 | 云量 > 30% | 高 |
| 设备电量不足 | 电量 < 20% | 中 |
| 目标重复拍摄 | 同一目标已有记录 | 低 |
| 文件缺失 | 实际文件路径为空 | 高 |

状态说明：
- **待复核**: 新记录默认状态
- **已通过**: 复核确认可用
- **已驳回**: 数据不可用
- **需重新复核**: 需要补充信息

## 验证流程

### 1. 功能验证清单

- [ ] 服务启动正常，浏览器可访问首页
- [ ] 仪表盘显示统计数据
- [ ] 基础数据页面可添加观测点、设备、目标
- [ ] 添加记录页面表单正常工作
- [ ] 记录显示在观测记录列表中
- [ ] 风险检测正常（测试云量 > 30% 或电量 < 20%）
- [ ] 详情弹窗正常显示
- [ ] 复核状态更新功能正常
- [ ] CSV 导入功能正常（使用示例数据测试）
- [ ] Markdown 导出功能正常
- [ ] JSON 导出功能正常

### 2. 测试数据

您可以使用以下测试数据验证功能：

**测试记录 1（无风险）:**
- 观测日期: 2024-01-15
- 观测时间: 22:30:00
- 云量: 15%
- 电量: 85%
- 实际文件: /Volumes/Data/2024-01-15/M42/

**测试记录 2（有风险）:**
- 观测日期: 2024-01-16
- 观测时间: 21:00:00
- 云量: 45% （超标）
- 电量: 15% （不足）
- 实际文件: （空，文件缺失）

### 3. CSV 测试

在「导入导出」页面点击「下载示例」，然后直接导入该示例文件，验证：
- 成功导入 2 条记录
- 自动创建观测点、设备、目标
- 第二条记录应有多个风险标记

## API 接口

### 基础数据

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | `/api/observation-points` | 获取所有观测点 |
| POST | `/api/observation-points` | 添加观测点 |
| GET | `/api/devices` | 获取所有设备 |
| POST | `/api/devices` | 添加设备 |
| GET | `/api/targets` | 获取所有目标 |
| POST | `/api/targets` | 添加目标 |

### 观测记录

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | `/api/exposure-batches` | 获取所有记录（支持 status/date_from/date_to 参数筛选） |
| POST | `/api/exposure-batches` | 添加记录 |
| GET | `/api/exposure-batches/<id>` | 获取单条记录详情 |
| PUT | `/api/exposure-batches/<id>` | 更新记录（含状态） |

### 导入导出

| 方法 | 路径 | 描述 |
|-----|------|------|
| POST | `/api/import/csv` | 导入 CSV 文件 |
| GET | `/api/export/markdown` | 导出 Markdown 简报 |
| GET | `/api/export/json` | 导出 JSON 审计包 |
| GET | `/api/stats` | 获取统计数据 |

## 数据模型

### observation_points（观测点）

| 字段 | 类型 | 描述 |
|-----|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 名称（唯一） |
| description | TEXT | 描述 |
| created_at | TIMESTAMP | 创建时间 |

### devices（设备）

| 字段 | 类型 | 描述 |
|-----|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 名称（唯一） |
| type | TEXT | 类型 |
| description | TEXT | 描述 |
| created_at | TIMESTAMP | 创建时间 |

### targets（目标天体）

| 字段 | 类型 | 描述 |
|-----|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 名称 |
| type | TEXT | 类型 |
| ra | TEXT | 赤经 |
| dec | TEXT | 赤纬 |
| description | TEXT | 描述 |
| created_at | TIMESTAMP | 创建时间 |

### exposure_batches（曝光批次/观测记录）

| 字段 | 类型 | 描述 |
|-----|------|------|
| id | INTEGER | 主键 |
| observation_point_id | INTEGER | 观测点ID |
| device_id | INTEGER | 设备ID |
| target_id | INTEGER | 目标ID |
| observation_date | TEXT | 观测日期 |
| observation_time | TEXT | 观测时间 |
| cloud_cover | REAL | 云量 (%) |
| seeing | REAL | 视宁度 |
| device_battery | REAL | 设备电量 (%) |
| exposure_plan | TEXT | 曝光计划 |
| actual_files | TEXT | 实际文件路径 |
| status | TEXT | 状态（pending/approved/rejected/needs_review） |
| risk_flags | TEXT | 风险标记（JSON数组） |
| notes | TEXT | 备注 |
| reviewed_by | TEXT | 复核人 |
| reviewed_at | TIMESTAMP | 复核时间 |
| created_at | TIMESTAMP | 创建时间 |

## 项目结构

```
xy4340/
├── app.py                 # Flask 主应用
├── requirements.txt       # Python 依赖
├── observations.db        # SQLite 数据库（运行时自动创建）
├── README.md             # 本文档
├── templates/
│   └── index.html        # 前端页面
└── static/
    ├── css/
    │   └── style.css     # 样式文件
    └── js/
        └── app.js        # 前端交互逻辑
```

## 常见问题

### Q: 数据库文件在哪里？

数据库文件 `observations.db` 会在应用首次启动时自动创建在项目根目录下。

### Q: 如何备份数据？

直接复制 `observations.db` 文件即可完整备份。或者使用「导入导出」功能导出 JSON 审计包。

### Q: 如何修改风险检测阈值？

编辑 `app.py` 中的 `RISK_CONFIG` 常量：

```python
RISK_CONFIG = {
    'max_cloud_cover': 30.0,   # 云量阈值（%）
    'min_battery': 20.0,        # 最低电量阈值（%）
}
```

修改后重启应用。

### Q: 服务如何停止？

在终端中按 `Ctrl + C` 即可停止 Flask 服务。

### Q: 如何在其他设备访问？

启动时应用会显示 `Running on http://192.168.x.x:5000`，在同一局域网内的其他设备可以通过该 IP 地址访问。

## 更新日志

### v1.0.0
- 初始版本发布
- 支持数据录入、CSV 导入
- 自动风险检测
- 人工复核流程
- Markdown/JSON 导出

## 许可证

本项目仅供社区天文观测队内部使用。
