# 🩺 急救培训复盘工具

一个专为急救培训老师设计的本地全栈小工具，用于课后分析学员的胸外按压和 AED 操作数据。

## 功能特性

- 📁 **多类型数据导入**：支持导入学员名单、分组表、假人按压数据（CSV）、AED 操作日志（JSON）
- 📊 **智能数据分析**：
  - 自动计算每个学员的按压深度/频率达标情况
  - 检测 AED 操作步骤遗漏和顺序错误
  - 识别设备被重复占用的冲突情况
  - 自动识别需要补训的人员
- 🔍 **数据复核与备注**：按班级复核，给误判结果添加备注说明
- 💾 **数据持久化**：数据存储在 SQLite 数据库，刷新后不丢失
- 📋 **多格式导出**：
  - 导出 Markdown 格式复盘报告
  - 导出 JSON 格式审计数据包

## 技术栈

- **后端**：Python Flask + SQLite (Flask-SQLAlchemy)
- **前端**：原生 HTML + CSS + JavaScript
- **数据处理**：Pandas

## 快速开始

### 1. 环境准备

确保你的电脑已安装 Python 3.8 或更高版本。

### 2. 安装依赖

```bash
# 进入项目目录
cd /path/to/this/project

# 创建虚拟环境（可选但推荐）
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows

# 安装依赖包
pip install -r requirements.txt
```

### 3. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 4. 访问应用

打开浏览器访问：**http://localhost:5000**

---

## 完整操作流程指南

### 第一步：创建新班级

1. 打开首页后，点击右上角 **"新建班级"** 按钮
2. 填写班级信息：
   - **班级名称**：例如 "2024年第5期急救培训"
   - **培训日期**：选择培训日期
   - **讲师**：（可选）填写讲师姓名
   - **培训地点**：（可选）填写培训地点
3. 点击 **"创建"** 完成班级创建

### 第二步：导入数据

点击班级列表中的 **"查看详情"** 进入班级详情页，切换到 **"数据导入"** 标签页。

按以下顺序导入四个数据文件：

#### 1. 学员名单 (CSV)

点击 **"学员名单"** 区域，选择 CSV 文件。

**文件格式要求：**

| 学号 | 姓名 | 性别 | 年龄 |
|------|------|------|------|
| S001 | 张三 | 男 | 25 |
| S002 | 李四 | 女 | 28 |

**支持的字段名（中英文均可）：**
- 学号 / student_id / id
- 姓名 / name
- 性别 / gender
- 年龄 / age

#### 2. 分组表 (CSV)

点击 **"分组表"** 区域，选择 CSV 文件。

**文件格式要求：**

| 组号 | 组名 | 学号 | 设备ID |
|------|------|------|--------|
| 1 | 第一组 | S001 | MANNEQUIN_01 |
| 1 | 第一组 | S002 | MANNEQUIN_01 |
| 2 | 第二组 | S003 | MANNEQUIN_02 |

**支持的字段名：**
- 组号 / group_number / 组编号
- 组名 / group_name
- 学号 / student_id
- 设备ID / device_id / 假人ID / aed_id

#### 3. 假人按压数据 (CSV)

点击 **"假人按压数据"** 区域，选择 CSV 文件。

**文件格式要求：**

| 设备ID | 按压序号 | 深度(cm) | 频率(次/分) | 时间戳 | 会话ID |
|--------|----------|----------|-------------|--------|--------|
| MANNEQUIN_01 | 1 | 5.2 | 108 | 2024-05-01 09:00:01 | SESSION_001 |
| MANNEQUIN_01 | 2 | 5.5 | 110 | 2024-05-01 09:00:02 | SESSION_001 |

**支持的字段名：**
- 设备ID / device_id / 假人ID
- 按压序号 / press_number / 序号
- 深度(cm) / depth_cm / 深度
- 频率(次/分) / rate / 频率
- 时间戳 / timestamp / 时间
- 会话ID / session_id / 训练ID

#### 4. AED 操作日志 (JSON)

点击 **"AED操作日志"** 区域，选择 JSON 文件。

**文件格式要求：**

```json
{
  "logs": [
    {
      "device_id": "MANNEQUIN_01",
      "session_id": "AED_SESSION_001",
      "step_code": "power_on",
      "step_name": "开机",
      "timestamp": "2024-05-01 09:05:00",
      "duration_seconds": 2.5,
      "success": true
    }
  ]
}
```

**AED 预期步骤顺序：**
1. `power_on` - 开机
2. `attach_pads` - 粘贴电极片
3. `analyze_heart_rhythm` - 分析心律
4. `clear_for_shock` - 请远离患者
5. `deliver_shock` - 除颤
6. `resume_cpr` - 继续CPR

**支持的字段名：**
- device_id / 设备ID / aed_id
- session_id / 会话ID / 训练ID
- step_code / 步骤代码 / code
- step_name / 步骤名称 / name
- timestamp / 时间戳 / time
- duration / 持续时间 / duration_seconds
- success / 成功

### 第三步：运行数据分析

所有数据导入完成后，点击页面底部的 **"🚀 开始数据分析"** 按钮。

系统将自动执行以下分析：

1. **按压数据分析**
   - 计算按压深度达标率（标准：5-6cm）
   - 计算按压频率达标率（标准：100-120次/分）
   - 检查是否存在连续30次达标按压
   - 总体达标判定：深度达标率≥70% 且 频率达标率≥60% 且 有连续30次达标

2. **AED 操作分析**
   - 检查是否遗漏关键步骤
   - 检查步骤执行顺序是否正确
   - 检查是否有步骤执行失败
   - 总体达标判定：无遗漏、无顺序错误、无失败步骤

3. **设备冲突检测**
   - 检测同一设备在同一会话中是否被多个学员使用

4. **补训名单生成**
   - 自动识别未达标的学员
   - 标记补训优先级（高/普通）
   - 列出需要补训的内容

### 第四步：查看分析结果

切换到 **"分析结果"** 标签页，可以查看四个子标签页：

#### 1. 按压达标

显示所有学员的按压数据统计：
- 总按压次数
- 深度达标率（进度条显示）
- 频率达标率（进度条显示）
- 平均深度、平均频率
- 是否有连续30次达标
- 总体达标状态

**未达标的行会以黄色高亮显示。**

#### 2. AED 操作

显示所有学员的 AED 操作数据：
- 完成步骤数
- 遗漏步骤数
- 总耗时
- 总体达标状态

#### 3. 设备冲突

显示检测到的设备冲突：
- 冲突类型
- 涉及学员
- 持续时间
- 状态（已处理/待处理）

#### 4. 补训名单

显示需要补训的学员：
- 学员姓名
- 优先级（高优先级/普通）
- 补训原因
- 补训内容
- 状态（待补训/已完成）

### 第五步：数据复核与添加备注

切换到 **"数据复核"** 标签页，可以对系统判定的未达标结果进行复核。

#### 1. 按压复核

显示所有按压未达标的学员，可以：
- 查看未达标原因
- 查看已有备注
- 点击 **"添加备注"** 按钮添加复核说明

#### 2. AED 复核

显示所有 AED 操作未达标的学员，可以：
- 查看未达标原因
- 查看已有备注
- 点击 **"添加备注"** 按钮添加复核说明

**添加的备注将在导出的复盘报告中体现。**

### 第六步：导出报告

切换到 **"导出报告"** 标签页，可以导出两种格式的报告：

#### 1. Markdown 复盘单

- 点击 **"👁️ 预览报告"** 可以在页面预览报告内容
- 点击 **"📥 下载 MD"** 下载 Markdown 格式的复盘报告

**报告内容包含：**
- 班级基本信息
- 统计概览
- 胸外按压达标情况（含备注）
- AED 操作情况（含备注）
- 设备冲突记录
- 需要补训人员（分优先级）
- 其他备注

#### 2. JSON 审计包

点击 **"📥 下载 JSON"** 下载完整的结构化数据 JSON 文件。

**包含的数据：**
- 班级信息
- 学员信息
- 分组信息
- 按压分析结果（详细数据）
- AED 分析结果（详细数据）
- 设备冲突记录
- 补训记录
- 所有备注信息

**适用于数据审计、备份和二次开发。**

---

## 示例数据

项目目录下的 `sample_data/` 文件夹包含完整的示例数据，可以用于测试：

- `students.csv` - 8名学员的名单
- `groups.csv` - 4个小组的分组信息
- `compression_data.csv` - 4组假人的按压数据（包含达标、不达标、过度按压三种情况）
- `aed_logs.json` - 4组AED操作日志（包含完整执行、遗漏步骤、步骤失败三种情况）

**示例数据预期分析结果：**
- **张三/李四**（设备MANNEQUIN_01）：按压达标，AED操作完整 → 无需补训
- **王五/赵六**（设备MANNEQUIN_02）：按压深度不够、频率偏慢，AED遗漏"分析心律"步骤 → 需要补训
- **钱七/孙八**（设备MANNEQUIN_03）：按压过深、频率过快，AED"分析心律"步骤失败 → 需要补训（高优先级）
- **周九/吴十**（设备MANNEQUIN_04）：按压达标，AED操作完整 → 无需补训

---

## 配置说明

可以通过修改 `config.py` 文件自定义参数：

### 按压标准配置

```python
COMPRESSION_STANDARDS = {
    'min_depth_cm': 5.0,      # 最小深度(cm)
    'max_depth_cm': 6.0,      # 最大深度(cm)
    'min_rate': 100,          # 最小频率(次/分)
    'max_rate': 120,          # 最大频率(次/分)
    'min_consecutive_presses': 30  # 需要连续达标按压数
}
```

### AED 预期步骤

```python
AED_EXPECTED_STEPS = [
    'power_on',           # 开机
    'attach_pads',        # 粘贴电极片
    'analyze_heart_rhythm',  # 分析心律
    'clear_for_shock',    # 请远离患者
    'deliver_shock',      # 除颤
    'resume_cpr'          # 继续CPR
]
```

---

## 项目结构

```
xy4406/
├── app.py                  # Flask 应用入口
├── config.py               # 配置文件（按压标准、AED步骤等）
├── models.py               # 数据库模型定义
├── requirements.txt        # Python 依赖包
├── routes/                 # API 路由模块
│   ├── __init__.py
│   ├── classes.py          # 班级管理 API
│   ├── upload.py           # 文件上传 API
│   ├── analysis.py         # 数据分析 API
│   ├── export.py           # 导出功能 API
│   └── notes.py            # 备注管理 API
├── templates/              # HTML 模板
│   ├── index.html          # 首页（班级列表）
│   └── class_detail.html   # 班级详情页
├── static/                 # 静态文件
│   ├── css/
│   │   └── style.css       # 样式文件
│   └── js/
│       └── app.js          # 前端 JavaScript
├── sample_data/            # 示例数据
│   ├── students.csv
│   ├── groups.csv
│   ├── compression_data.csv
│   └── aed_logs.json
├── instance/               # SQLite 数据库目录（自动创建）
├── uploads/                # 上传文件临时目录（自动创建）
└── exports/                # 导出文件目录（自动创建）
```

---

## API 接口文档

### 班级管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/classes/ | 获取所有班级列表 |
| POST | /api/classes/ | 创建新班级 |
| GET | /api/classes/<id> | 获取班级详情 |
| PUT | /api/classes/<id> | 更新班级信息 |
| DELETE | /api/classes/<id> | 删除班级 |

### 文件上传

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/upload/students/<class_id> | 上传学员名单 |
| POST | /api/upload/groups/<class_id> | 上传分组表 |
| POST | /api/upload/compression/<class_id> | 上传按压数据 |
| POST | /api/upload/aed/<class_id> | 上传AED日志 |
| GET | /api/upload/status/<class_id> | 获取上传状态 |

### 数据分析

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/analysis/run/<class_id> | 运行数据分析 |
| GET | /api/analysis/results/<class_id> | 获取分析结果 |
| POST | /api/analysis/retraining/<id>/complete | 标记补训完成 |

### 备注管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/notes/compression/<result_id> | 添加按压结果备注 |
| POST | /api/notes/aed/<result_id> | 添加AED结果备注 |
| PUT | /api/notes/<note_id> | 更新备注 |
| DELETE | /api/notes/<note_id> | 删除备注 |
| GET | /api/notes/compression/<result_id> | 获取按压结果备注 |
| GET | /api/notes/aed/<result_id> | 获取AED结果备注 |

### 导出功能

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/export/markdown/<class_id> | 下载Markdown复盘报告 |
| GET | /api/export/json/<class_id> | 下载JSON审计包 |
| GET | /api/export/preview/markdown/<class_id> | 预览Markdown报告 |

---

## 常见问题

### Q1: 数据导入后无法分析？

请确保：
1. 已导入学员名单
2. 分组表中的学号与学员名单中的学号匹配
3. 设备ID在分组表和数据文件中保持一致

### Q2: 为什么有些学员没有分析结果？

可能的原因：
1. 该学员没有对应的按压数据或 AED 日志
2. 设备ID无法匹配到对应的学员（检查分组表）
3. 数据文件格式不正确

### Q3: 如何修改达标标准？

编辑 `config.py` 文件中的 `COMPRESSION_STANDARDS` 配置项。

### Q4: 数据存储在哪里？

所有数据存储在 `instance/training.db` SQLite 数据库文件中。可以使用 SQLite 客户端工具直接查看。

### Q5: 刷新页面后数据会丢失吗？

不会。所有数据都存储在 SQLite 数据库中，刷新页面或重启服务后数据依然存在。

---

## 更新日志

### v1.0.0 (2024-05-04)

- 初始版本发布
- 支持学员名单、分组表、按压数据、AED日志导入
- 实现按压达标分析、AED步骤检查、设备冲突检测
- 支持数据复核和添加备注
- 支持 Markdown 复盘报告和 JSON 审计包导出
- 提供完整的示例数据和操作文档

---

## 许可证

本项目仅供学习和内部使用。

---

## 联系方式

如有问题或建议，请在项目中提出。
