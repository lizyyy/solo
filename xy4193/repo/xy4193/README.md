# 血袋样本配对验收台

> 血站流动采血车护士本地交接系统 - 确保献血者条码、血袋编号、检验样本管、冷箱温度和交接人签名准确配对。

## 项目概述

本系统专为血站流动采血车设计，解决采血结束后的交接难题：

- ✅ **样本管漏扫检测** - 自动检查献血者的血袋和样本管是否全部配对
- ✅ **血袋跨箱检测** - 防止血袋在多个冷箱间混杂
- ✅ **温度超时检测** - 监控冷箱温度是否超过阈值和超时时长
- ✅ **完整审计追踪** - 所有操作记录到审计日志
- ✅ **数据导入导出** - 支持CSV导入、Markdown报告导出、JSON审计包导出

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML5 + CSS3 + JavaScript (SPA单页应用) |
| 后端 | Node.js + Express.js |
| 数据库 | SQLite3 (本地文件存储) |
| 文件处理 | csv-parser, multer |
| 开发工具 | nodemon |

## 项目结构

```
xy4193/
├── package.json              # 项目依赖配置
├── server/
│   ├── index.js             # Express服务器入口
│   ├── config/
│   │   ├── config.js        # 系统配置
│   │   └── database.js      # 数据库连接
│   ├── models/
│   │   ├── init.js          # 数据库表初始化
│   │   ├── donor.js         # 献血者CRUD
│   │   ├── bloodBag.js      # 血袋CRUD
│   │   ├── sampleTube.js    # 样本管CRUD
│   │   ├── bagTubeMatch.js  # 配对记录CRUD
│   │   ├── coldBox.js       # 冷箱CRUD
│   │   ├── coldBoxTimeline.js # 冷箱时间线CRUD
│   │   ├── handover.js      # 交接记录CRUD
│   │   ├── handoverItem.js  # 交接明细CRUD
│   │   └── auditLog.js      # 审计日志CRUD
│   ├── services/
│   │   ├── rulesEngine.js   # 核心规则引擎
│   │   ├── importService.js # CSV导入服务
│   │   └── exportService.js # 导出服务
│   ├── middleware/
│   │   └── auditMiddleware.js # 审计日志中间件
│   ├── routes/
│   │   ├── donors.js        # 献血者API
│   │   ├── bloodBags.js     # 血袋API
│   │   ├── sampleTubes.js   # 样本管API
│   │   ├── matches.js       # 配对API
│   │   ├── coldBoxes.js     # 冷箱API
│   │   ├── handovers.js     # 交接API
│   │   ├── importExport.js  # 导入导出API
│   │   └── auditLogs.js     # 审计日志API
│   └── data/
│       ├── seeds.js                # 示例数据种子
│       ├── donors_template.csv     # 献血者模板
│       ├── bloodbags_template.csv  # 血袋模板
│       └── sampletubes_template.csv # 样本管模板
├── public/
│   ├── index.html         # 单页应用入口
│   ├── css/
│   │   └── style.css      # 完整样式
│   └── js/
│       └── app.js         # 前端应用逻辑
└── tests/
    └── test.js            # 集成测试
```

## 数据模型

系统包含8个核心数据表：

### 1. donors (献血者表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| donor_code | TEXT | 献血者条码 (唯一) |
| name | TEXT | 姓名 |
| id_card | TEXT | 身份证号 |
| blood_type | TEXT | 血型 (A/B/AB/O) |
| created_at | DATETIME | 创建时间 |

### 2. blood_bags (血袋表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| bag_code | TEXT | 血袋编号 (唯一) |
| donor_id | INTEGER | 关联献血者ID |
| volume | INTEGER | 容量 (默认400ml) |
| blood_type | TEXT | 血型 |
| collection_time | DATETIME | 采集时间 |
| created_at | DATETIME | 创建时间 |

### 3. sample_tubes (样本管表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| tube_code | TEXT | 样本管编号 (唯一) |
| donor_id | INTEGER | 关联献血者ID |
| tube_type | TEXT | 样本类型 |
| created_at | DATETIME | 创建时间 |

### 4. bag_tube_matches (血袋-样本管配对表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| blood_bag_id | INTEGER | 血袋ID |
| sample_tube_id | INTEGER | 样本管ID |
| matched_by | TEXT | 配对操作人 |
| matched_at | DATETIME | 配对时间 |
| status | TEXT | 状态 (pending/verified/rejected) |

### 5. cold_boxes (冷箱表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| box_code | TEXT | 冷箱编号 (唯一) |
| description | TEXT | 描述 |
| max_temp | REAL | 最高允许温度 (默认10°C) |
| current_temp | REAL | 当前温度 |
| status | TEXT | 状态 (active/inactive) |
| created_at | DATETIME | 创建时间 |

### 6. cold_box_timeline (冷箱时间线表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| box_id | INTEGER | 冷箱ID |
| event_type | TEXT | 事件类型 |
| temperature | REAL | 温度 |
| blood_bag_code | TEXT | 血袋编号 |
| operator | TEXT | 操作人 |
| event_time | DATETIME | 事件时间 |
| notes | TEXT | 备注 |

### 7. handovers (交接记录表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| handover_code | TEXT | 交接编号 (唯一) |
| from_operator | TEXT | 移交人 |
| to_operator | TEXT | 接收人 |
| status | TEXT | 状态 (pending/completed/rejected) |
| handover_time | DATETIME | 交接时间 |
| completed_at | DATETIME | 完成时间 |
| notes | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |

### 8. handover_items (交接明细表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| handover_id | INTEGER | 交接ID |
| blood_bag_id | INTEGER | 血袋ID |
| sample_tube_id | INTEGER | 样本管ID |
| donor_code | TEXT | 献血者条码 |
| status | TEXT | 状态 |
| check_result | TEXT | 检查结果 |
| exception_reason | TEXT | 异常原因 |

### 9. audit_logs (审计日志表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| operation_type | TEXT | 操作类型 (CREATE/UPDATE/DELETE/EXPORT) |
| table_name | TEXT | 表名 |
| record_id | INTEGER | 记录ID |
| operator | TEXT | 操作人 |
| operation_time | DATETIME | 操作时间 |
| old_value | TEXT | 旧值 |
| new_value | TEXT | 新值 |
| ip_address | TEXT | IP地址 |
| notes | TEXT | 备注 |

## 规则引擎

系统核心规则位于 `server/services/rulesEngine.js`：

### 1. 样本管漏扫检测 (`checkSampleTubeMissing`)
检查献血者的所有血袋和样本管是否已配对。

**验证逻辑：**
- 查询该献血者的所有血袋
- 查询该献血者的所有样本管
- 查询已配对的记录
- 检查是否存在未配对的血袋或样本管

**返回：**
```javascript
{
  valid: boolean,           // 是否通过
  error: string,            // 错误信息
  rule: 'sample_tube_missing',
  unmatchedBags: [...],     // 未配对血袋列表
  unmatchedTubes: [...]     // 未配对样本管列表
}
```

### 2. 血袋跨箱检测 (`checkColdBoxCrossContamination`)
检查血袋是否在多个冷箱有记录。

**验证逻辑：**
- 查询血袋的所有冷箱时间线记录
- 检查是否存在多个不同的冷箱ID
- 如果存在跨箱记录，返回详细信息

**返回：**
```javascript
{
  valid: boolean,           // 是否通过
  error: string,            // 错误信息
  rule: 'cross_box_contamination',
  currentBoxId: number,     // 当前冷箱ID
  otherBoxes: [...],        // 涉及的其他冷箱
  details: [...]            // 详细记录
}
```

### 3. 温度超时检测 (`checkTemperatureTimeout`)
检查冷箱温度是否超过阈值并持续超过时间限制。

**验证逻辑：**
- 查询冷箱的所有时间线记录
- 筛选出温度超过 `MAX_COLD_BOX_TEMP` (默认10°C) 的记录
- 计算第一次超温到最后一次超温的时间间隔
- 如果超过 `MAX_COLD_BOX_DURATION_HOURS` (默认24小时)，判定为超时

**返回：**
```javascript
{
  valid: boolean,                 // 是否通过
  error: string,                  // 错误信息
  rule: 'temperature_timeout',
  maxTemp: 10,                    // 最高允许温度
  maxDurationHours: 24,           // 最大允许时长
  temperatureExceeds: [...],      // 温度超标记录
  totalOverTempDuration: 25.5,    // 超时时长(小时)
  firstOverTempTime: Date,
  lastOverTempTime: Date
}
```

### 4. 配对验证 (`validateSampleTubeMatch`)
验证血袋和样本管是否可以配对。

**验证逻辑：**
- 检查血袋和样本管是否存在
- 检查是否属于同一献血者
- 检查是否已存在配对记录

## API 文档

### 基础路径
`http://localhost:3000/api`

### 健康检查
```
GET /health
```

### 献血者 API
```
GET    /donors              # 获取所有献血者
GET    /donors/:code        # 根据条码获取献血者
POST   /donors              # 创建献血者
PUT    /donors/:code        # 更新献血者
DELETE /donors/:code        # 删除献血者
```

**创建献血者请求体：**
```json
{
  "donor_code": "D001",
  "name": "张三",
  "blood_type": "A",
  "operator": "nurse1"
}
```

### 血袋 API
```
GET    /blood-bags          # 获取所有血袋
GET    /blood-bags/:code    # 根据编号获取血袋
POST   /blood-bags          # 创建血袋
PUT    /blood-bags/:code    # 更新血袋
DELETE /blood-bags/:code    # 删除血袋
```

**创建血袋请求体：**
```json
{
  "bag_code": "B001",
  "donor_code": "D001",
  "volume": 400,
  "blood_type": "A",
  "operator": "nurse1"
}
```

### 样本管 API
```
GET    /sample-tubes        # 获取所有样本管
GET    /sample-tubes/:code  # 根据编号获取样本管
POST   /sample-tubes        # 创建样本管
PUT    /sample-tubes/:code  # 更新样本管
DELETE /sample-tubes/:code  # 删除样本管
```

### 配对 API
```
GET    /matches             # 获取所有配对记录
GET    /matches/:id         # 获取单个配对
POST   /matches             # 创建配对
POST   /matches/validate    # 验证配对
POST   /matches/batch       # 批量配对
```

**验证配对请求体：**
```json
{
  "blood_bag_code": "B001",
  "sample_tube_code": "T001"
}
```

**批量配对请求体：**
```json
{
  "items": [
    { "blood_bag_code": "B001", "sample_tube_code": "T001" },
    { "blood_bag_code": "B002", "sample_tube_code": "T002" }
  ],
  "operator": "nurse1"
}
```

### 冷箱 API
```
GET    /cold-boxes          # 获取所有冷箱
GET    /cold-boxes/:code    # 获取单个冷箱
POST   /cold-boxes          # 创建冷箱
PUT    /cold-boxes/:code    # 更新冷箱

GET    /cold-boxes/:id/timeline       # 获取冷箱时间线
POST   /cold-boxes/:code/timeline     # 添加时间线事件
GET    /cold-boxes/:id/check-temperature  # 检查温度超时
GET    /cold-boxes/:code/check-cross-contamination?blood_bag_code=B001  # 检查跨箱
```

**添加时间线事件请求体：**
```json
{
  "event_type": "temp_check",
  "temperature": 8.5,
  "blood_bag_code": "B001",
  "notes": "例行检查",
  "operator": "nurse1"
}
```

**事件类型：**
- `temp_check` - 温度检查
- `bag_add` - 放入血袋
- `bag_remove` - 取出血袋
- `transport` - 运输开始
- `arrival` - 到达

### 交接 API
```
GET    /handovers           # 获取所有交接记录
GET    /handovers/:code     # 获取单个交接
POST   /handovers           # 创建交接

GET    /handovers/:code/items      # 获取交接项
POST   /handovers/:code/items      # 添加交接项
POST   /handovers/:code/validate   # 验证交接
POST   /handovers/:code/complete   # 完成交接
POST   /handovers/:code/reject     # 退回交接
```

**创建交接请求体：**
```json
{
  "from_operator": "护士A",
  "to_operator": "护士B",
  "notes": "常规交接",
  "operator": "system"
}
```

**添加交接项请求体：**
```json
{
  "items": [
    { "donor_code": "D001", "blood_bag_code": "B001", "sample_tube_code": "T001" }
  ],
  "operator": "nurse1"
}
```

**退回交接请求体：**
```json
{
  "reason": "存在未配对样本管",
  "operator": "nurse1"
}
```

### 导入导出 API
```
POST   /import/donors       # 导入献血者CSV
POST   /import/blood-bags   # 导入血袋CSV
POST   /import/sample-tubes # 导入样本管CSV

POST   /export/handover/:code      # 导出交接报告(Markdown)
POST   /export/audit                # 导出审计包(JSON)
POST   /export/coldbox-timeline     # 导出冷箱时间线(Markdown)
```

**CSV导入格式：**

献血者：
```
donor_code,name,blood_type
D001,张三,A
D002,李四,B
```

血袋：
```
bag_code,donor_code,volume,blood_type
B001,D001,400,A
B002,D002,400,B
```

样本管：
```
tube_code,donor_code,tube_type
T001,D001,standard
T002,D002,edta
```

### 审计日志 API
```
GET    /audit-logs          # 获取所有审计日志
GET    /audit-logs/:id      # 获取单个日志
```

## 安装与启动

### 环境要求
- Node.js >= 14.0.0
- npm 或 yarn

### 安装步骤

1. 安装依赖
```bash
cd /Users/mac/pro/solocoder/pro/xy4193/repo/xy4193
npm install
```

2. 启动服务
```bash
# 生产模式
npm start

# 开发模式 (自动重启)
npm run dev
```

3. 访问系统
- 前端页面: http://localhost:3000
- API 地址: http://localhost:3000/api

### 快速启动脚本

创建 `start.sh` 一键启动：
```bash
#!/bin/bash
cd /Users/mac/pro/solocoder/pro/xy4193/repo/xy4193
npm install
npm start
```

## 本地验证流程

### 步骤1: 启动服务
```bash
npm start
```

预期输出：
```
初始化数据库...
数据库初始化完成

========================================
  血袋样本配对验收台 已启动
  访问地址: http://localhost:3000
  API 地址: http://localhost:3000/api
========================================
```

### 步骤2: 验证健康检查
```bash
curl http://localhost:3000/api/health
```

预期返回：
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### 步骤3: 加载示例数据 (可选)
```bash
node server/data/seeds.js
```

预期输出：
```
开始插入示例数据...
✓ 献血者已添加: D001
✓ 献血者已添加: D002
...
示例数据插入完成！
```

### 步骤4: 前端功能验证

打开浏览器访问 http://localhost:3000

#### 4.1 批量录入测试
1. 点击"批量录入/扫码"标签
2. 在献血者表单输入：
   - 献血者条码: TEST001
   - 姓名: 测试用户
   - 血型: A型
3. 点击"添加献血者"
4. 验证底部数据列表显示新记录

#### 4.2 配对管理测试
1. 先添加一个血袋和样本管（关联同一献血者）
2. 点击"配对管理"标签
3. 输入血袋编号和样本管编号
4. 点击"验证"按钮
5. 验证显示"配对验证通过"
6. 点击"确认配对"

#### 4.3 冷箱监控测试
1. 点击"冷箱监控"标签
2. 添加冷箱：
   - 冷箱编号: BOX_TEST
   - 描述: 测试冷箱
   - 最高允许温度: 10
3. 记录时间线事件：
   - 冷箱编号: BOX_TEST
   - 事件类型: 温度检查
   - 当前温度: 8.5
4. 验证冷箱列表显示当前温度

#### 4.4 交接复核测试
1. 点击"交接复核"标签
2. 创建交接：
   - 移交人: 护士A
   - 接收人: 护士B
3. 点击交接记录卡片进入详情
4. 添加交接项（需要已存在的血袋/样本管）
5. 点击"验证交接"
6. 验证通过后点击"完成交接"

#### 4.5 规则引擎测试

**测试样本管漏扫：**
1. 添加献血者 D_MISS
2. 添加血袋 B_MISS (关联 D_MISS)
3. **不添加**样本管或添加后不配对
4. 在"配对管理" -> "检查样本管漏扫"输入 D_MISS
5. 验证显示"存在未配对的血袋或样本管"

**测试温度超时：**
1. 选择一个冷箱
2. 记录多条温度超标的事件（温度 > 10°C）
3. 可以通过修改系统时间模拟超时
4. 点击"检查温度超时"
5. 验证显示温度超标信息

**测试血袋跨箱：**
1. 创建两个冷箱 BOX_CROSS1 和 BOX_CROSS2
2. 在 BOX_CROSS1 中记录放入血袋 B_CROSS
3. 在 BOX_CROSS2 中记录放入同一血袋 B_CROSS
4. 在"跨箱检查"中输入：
   - 目标冷箱编号: BOX_CROSS1
   - 血袋编号: B_CROSS
5. 验证显示"血袋 B_CROSS 存在跨箱记录"

### 步骤5: 导入导出验证

#### 5.1 CSV导入
1. 点击"导入导出"标签
2. 点击"献血者模板"下载模板
3. 编辑CSV添加测试数据
4. 在"批量录入/扫码"标签页使用导入表单上传
5. 验证数据列表显示新记录

#### 5.2 Markdown导出
1. 创建一个交接记录
2. 在"导入导出"标签页输入交接编号
3. 点击"导出报告"
4. 验证下载的 .md 文件内容

#### 5.3 JSON审计包导出
1. 在"导入导出"标签页
2. 点击"导出审计包"
3. 验证下载的 .json 文件包含操作日志

### 步骤6: 运行集成测试

**注意：测试需要服务器正在运行**

```bash
# 先启动服务器（新终端）
npm start

# 运行测试
npm test
```

预期输出：
```
========================================
  血袋样本配对验收台 - 集成测试
========================================

测试: 健康检查
  ✓ 通过

测试: 创建献血者
  ✓ 通过

...

========================================
  测试结果汇总
========================================
  通过: 10
  失败: 0
  总计: 10
========================================

所有测试通过！
```

## 系统配置

配置文件位于 `server/config/config.js`：

```javascript
module.exports = {
  PORT: process.env.PORT || 3000,                    // 服务端口
  MAX_COLD_BOX_TEMP: process.env.MAX_TEMP || 10,      // 最高允许温度 (°C)
  MAX_COLD_BOX_DURATION_HOURS: 24,                     // 最大超时时长 (小时)
  DB_PATH: process.env.DB_PATH || './blood_bank.db'   // 数据库路径
};
```

## 前端功能模块

### 1. 批量录入/扫码
- 单个录入献血者、血袋、样本管
- CSV批量导入
- 扫码模拟（支持条码解析）
- 数据列表展示

### 2. 配对管理
- 单个配对验证与创建
- 批量配对
- 样本管漏扫检查
- 配对列表与状态筛选

### 3. 冷箱监控
- 冷箱管理（增删改查）
- 时间线事件记录
- 温度超时检查
- 血袋跨箱检查
- 时间线可视化

### 4. 交接复核
- 交接创建
- 交接项管理（单个/批量添加）
- 交接验证
- 完成/退回交接
- 交接列表与状态筛选

### 5. 导入导出
- CSV模板下载
- Markdown交接报告导出
- JSON审计包导出
- 冷箱时间线报告导出

### 6. 审计日志
- 日志列表展示
- 多维度筛选（操作人、表名、操作类型、时间范围）
- 操作类型颜色标识

## 审计日志

系统自动记录以下操作到审计日志：

| 操作类型 | 触发场景 |
|----------|----------|
| CREATE | 创建献血者、血袋、样本管、冷箱、配对、交接 |
| UPDATE | 更新上述任何记录 |
| DELETE | 删除记录 |
| EXPORT | 导出报告、导出审计包 |

每条日志包含：
- 操作时间
- 操作人
- 操作类型
- 涉及的数据表
- 记录ID
- 旧值/新值（JSON格式）
- IP地址
- 备注

## 数据存储

### SQLite数据库
- 数据库文件默认位置: `./blood_bank.db`
- 首次启动自动创建所有表
- 可以通过 `DB_PATH` 环境变量自定义路径

### 导出文件
- Markdown报告: 下载到用户本地
- JSON审计包: 下载到用户本地
- CSV模板: 下载到用户本地

## 故障排查

### 问题1: 端口被占用
```bash
# 查找占用端口的进程
lsof -i :3000

# 结束进程
kill -9 <PID>
```

### 问题2: 数据库权限错误
```bash
# 检查数据库文件权限
ls -la blood_bank.db

# 修改权限
chmod 644 blood_bank.db
```

### 问题3: 前端无法连接后端
检查浏览器控制台是否有 CORS 错误。确保：
- 后端已启动在正确端口
- 前端访问地址与后端同源

### 问题4: 导入CSV失败
检查CSV格式：
- 必须包含正确的表头
- 字段分隔符必须是逗号
- 文本字段不要包含未转义的逗号

## 开发指南

### 添加新的API路由
1. 在 `server/routes/` 创建新路由文件
2. 在 `server/index.js` 中注册路由
3. 使用 `auditMiddleware` 记录操作日志

### 扩展规则引擎
在 `server/services/rulesEngine.js` 添加新的验证方法，然后在相关路由中调用。

### 自定义样式
修改 `public/css/style.css`，支持响应式设计。

## 许可证

MIT License

## 联系方式

如有问题，请查阅代码注释或运行测试验证功能。
