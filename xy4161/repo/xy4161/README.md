# 义齿返工闭环台

口腔诊所技工室本地业务系统 - 管理义齿加工全流程，实现处方-口扫-设计-加工-试戴链路校验，防止模型版本错误、试戴反馈遗漏、重复返工等问题。

## 系统功能

### 核心功能
- **病例管理**: 创建、查看、搜索病例，管理患者、医生、诊所信息
- **牙位追踪**: 每个牙位独立记录，支持版本管理和返工计数
- **工序流转**: 12个标准工序步骤，支持状态跟踪和负责人指派
- **返工闭环**: 返工申请 → 复核放行 → 版本追踪 → 新工序排产
- **试戴反馈**: 记录就位、咬合、美学情况，跟进状态提醒
- **版本管理**: 完整的版本历史记录，防止旧版本继续排产
- **规则校验**: 实时校验处方-口扫-设计-加工-试戴链路
- **数据导入导出**: 支持 CSV/JSON/Markdown 格式

### 智能预警
- 🚨 **模型版本冲突检测**: 检测工序使用的版本与牙位当前版本不一致
- ⚠️ **待复核返工提醒**: 显示待审核的返工申请
- 🔴 **逾期试戴反馈**: 提醒超过3天未跟进的试戴反馈
- ⚡ **高频返工警告**: 同一牙位返工超过3次自动预警

## 技术架构

### 后端
- **运行时**: Node.js 18+ (ESM模块)
- **Web框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **数据处理**: csv-parse / csv-stringify

### 前端
- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **HTTP客户端**: Axios

## 项目结构

```
xy4161/
├── package.json                 # 根项目配置
├── data/
│   ├── example-data.json       # 示例数据 (JSON格式)
│   └── example-cases.csv       # 示例病例 (CSV格式)
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js           # Express服务入口
│       ├── database.js         # SQLite数据库连接和初始化
│       ├── state-machine.js    # 状态机 - 状态流转控制
│       ├── rule-engine.js      # 规则引擎 - 业务规则校验
│       ├── import-export.js    # 导入导出服务
│       └── scripts/
│           └── init-data.js    # 示例数据初始化脚本
│   └── test/
│       └── core.test.js        # 单元测试
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.js             # 前端入口
        ├── App.vue             # 根组件
        ├── api/
        │   └── index.js        # API调用封装
        ├── router/
        │   └── index.js        # 路由配置
        ├── stores/
        │   └── cases.js        # Pinia状态管理
        └── views/
            ├── Dashboard.vue   # 仪表盘页面
            ├── CaseList.vue    # 病例列表页面
            ├── CaseDetail.vue  # 病例详情页面
            └── ImportView.vue  # 导入导出页面
```

## 快速开始

### 1. 环境准备
确保已安装 Node.js 18 或更高版本：

```bash
node --version
```

### 2. 安装依赖

```bash
# 安装根项目依赖
npm install

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install

# 返回项目根目录
cd ..
```

### 3. 初始化数据库

数据库文件会自动创建在 `data/denture.db` 路径。首次运行时会自动执行数据库表初始化。

### 4. 启动服务

**方式一：同时启动前后端（推荐）**

```bash
npm run dev
```

- 后端服务: http://localhost:3001
- 前端应用: http://localhost:5173

**方式二：分别启动**

```bash
# 启动后端
npm run dev:backend

# 另开终端，启动前端
npm run dev:frontend
```

### 5. 加载示例数据（可选）

项目启动后，可以通过前端"数据导入"页面导入示例数据，或运行初始化脚本：

```bash
cd backend
npm run init:data
```

## 验证流程

### 1. 功能验证清单

#### A. 仪表盘功能
- [ ] 访问 http://localhost:5173/
- [ ] 显示系统运行状态
- [ ] 导入示例数据后显示预警信息
- [ ] 点击"刷新数据"按钮正常工作

#### B. 病例管理
- [ ] 点击"查看所有病例"进入病例列表
- [ ] 点击"新建病例"创建测试病例
  - 病例编号: TEST-001
  - 患者姓名: 测试患者
  - 医生姓名: 测试医生
  - 诊所: 测试诊所
- [ ] 新创建的病例出现在列表中
- [ ] 使用搜索框可以搜索到该病例
- [ ] 点击病例卡片进入详情页

#### C. 病例详情与状态转换
- [ ] 病例详情页显示基本信息
- [ ] 状态下拉框显示可转换的目标状态
- [ ] 执行状态转换: PRESCRIPTION_RECEIVED → SCAN_RECEIVED
- [ ] 状态标签更新，版本历史中添加记录

#### D. 牙位管理
- [ ] 点击"添加牙位"
  - 牙位编号: 16
  - 修复类型: CROWN
- [ ] 牙位信息显示在列表中
- [ ] 显示版本号 v1

#### E. 工序流转
- [ ] 切换到"工序流转"标签
- [ ] 显示标准12道工序
- [ ] 可以查看每个工序的状态

#### F. 返工申请与复核
- [ ] 切换到"返工申请"标签
- [ ] 点击"申请返工"
  - 牙位: 选择 #16
  - 返工原因: 就位问题 (FIT_ISSUE)
  - 原因描述: 边缘不密合
  - 返工类型: 设计返工
  - 来源工序: 质检
  - 目标工序: 数字化设计
- [ ] 提交后显示待复核状态
- [ ] 点击"批准"或"拒绝"按钮
- [ ] 批准后牙位版本号增加

#### G. 试戴反馈
- [ ] 切换到"试戴反馈"标签
- [ ] 点击"添加反馈"
  - 就位情况: 需微调
  - 咬合情况: 咬合高
  - 是否需要返工: 是
- [ ] 提交后显示为"待跟进"
- [ ] 点击"标记已跟进"更新状态

#### H. 数据导入导出
- [ ] 进入"数据导入"页面
- [ ] 选择数据类型: 病例
- [ ] 下载示例数据
- [ ] 导入 `data/example-cases.csv`
- [ ] 查看导入结果统计
- [ ] 选择导出格式 CSV/JSON/Markdown
- [ ] 验证导出的文件内容

#### I. 规则引擎校验
- [ ] 创建一个病例，不添加处方
- [ ] 查看详情页的校验警告
- [ ] 应为: "病例缺少处方信息"

- [ ] 尝试在同一牙位申请多个返工
- [ ] 第一个待复核时，申请第二个
- [ ] 应显示警告或阻止

### 2. API验证

使用 curl 或 Postman 验证后端API：

#### 健康检查
```bash
curl http://localhost:3001/api/health
```

#### 获取病例列表
```bash
curl http://localhost:3001/api/cases
```

#### 创建病例
```bash
curl -X POST http://localhost:3001/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "caseNumber": "API-TEST-001",
    "patientName": "API测试",
    "doctorName": "API医生",
    "clinicName": "API诊所",
    "notes": "API创建的测试病例"
  }'
```

#### 状态转换
```bash
# 替换 {case-id} 为实际病例ID
curl -X PUT http://localhost:3001/api/cases/{case-id}/transition \
  -H "Content-Type: application/json" \
  -d '{
    "newState": "SCAN_RECEIVED",
    "changedBy": "API测试",
    "reason": "API状态转换测试"
  }'
```

#### 导出数据
```bash
# 导出为CSV
curl http://localhost:3001/api/export/cases?format=csv

# 导出为JSON
curl http://localhost:3001/api/export/cases?format=json

# 导出为Markdown
curl http://localhost:3001/api/export/cases?format=markdown
```

### 3. 运行测试

```bash
cd backend
npm test
```

测试覆盖：
- 状态机：状态转换验证
- 规则引擎：链路校验、重复返工检测、牙位解析
- 导入导出：列定义和显示名称

## 数据模型

### 核心表结构

#### cases (病例表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| case_number | TEXT | 病例编号（唯一） |
| patient_name | TEXT | 患者姓名 |
| doctor_name | TEXT | 医生姓名 |
| clinic_name | TEXT | 诊所名称 |
| status | TEXT | 状态（状态机管理） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |
| notes | TEXT | 备注 |

#### teeth (牙位表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| case_id | TEXT | 病例外键 |
| tooth_number | INTEGER | 牙位编号(1-32) |
| tooth_type | TEXT | 修复类型 |
| is_rework | BOOLEAN | 是否返工 |
| rework_count | INTEGER | 返工次数 |
| version | INTEGER | 当前版本号 |
| status | TEXT | 牙位状态 |

#### rework_requests (返工申请表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| case_id | TEXT | 病例外键 |
| tooth_id | TEXT | 牙位外键（可为空，针对全病例） |
| request_date | DATETIME | 申请时间 |
| reason_code | TEXT | 原因代码 |
| reason_description | TEXT | 原因描述 |
| rework_type | TEXT | 返工类型 |
| status | TEXT | 状态: PENDING/APPROVED/REJECTED |
| reviewed_by | TEXT | 复核人 |
| reviewed_at | DATETIME | 复核时间 |

#### try_in_feedbacks (试戴反馈表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| case_id | TEXT | 病例外键 |
| tooth_id | TEXT | 牙位外键 |
| feedback_date | DATETIME | 反馈时间 |
| fit_status | TEXT | 就位情况 |
| occlusion_status | TEXT | 咬合情况 |
| esthetics_status | TEXT | 美学情况 |
| needs_rework | BOOLEAN | 是否需要返工 |
| is_followed_up | BOOLEAN | 是否已跟进 |

#### version_history (版本历史表)
用于追踪所有实体的状态变更和版本变更。

## 状态机说明

### 病例状态流转

```
PRESCRIPTION_RECEIVED (处方已接收)
         ↓
SCAN_RECEIVED (口扫已接收)
         ↓
DESIGNING (设计中) ←────┐
         ↓               │
DESIGN_APPROVED (设计批准) │
         ↓               │
MANUFACTURING (加工中)  │
         ↓               │
QUALITY_CHECK (质检中)  │
         ↓               │
TRY_IN (试戴中)          │
         ↓               │
TRY_IN_FEEDBACK_RECEIVED │
         ↓               │
FINAL_DELIVERY (最终交付)│
         ↓               │
COMPLETED (已完成)       │
         ↓               │
REWORK_IN_PROGRESS ──────┘
    (返工进行中)
```

### 返工原因代码
| 代码 | 说明 |
|------|------|
| DESIGN_ISSUE | 设计问题 |
| MANUFACTURING_DEFECT | 加工缺陷 |
| FIT_ISSUE | 就位问题 |
| OCCLUSION_ISSUE | 咬合问题 |
| ESTHETICS_ISSUE | 美学问题 |
| MATERIAL_DEFECT | 材料缺陷 |
| DOCTOR_REQUEST | 医生要求 |
| PATIENT_REQUEST | 患者要求 |
| OTHER | 其他 |

## 规则引擎校验项

### 1. 处方-口扫链路校验
- 检查病例是否缺少处方
- 检查病例是否缺少有效口扫文件
- 检查处方牙位与系统注册牙位是否一致

### 2. 版本冲突检测
- 检测工序使用版本与牙位当前版本是否一致
- 防止旧版本模型继续排产

### 3. 重复返工检测
- 检查是否存在待复核的返工申请
- 检查是否存在进行中的返工
- 检测同一牙位返工次数是否超过3次

### 4. 试戴反馈跟进检测
- 检测超过1天未跟进的反馈（警告）
- 检测超过3天未跟进的反馈（错误）

## API 接口文档

### 病例相关
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/cases | 获取病例列表（支持status和search参数） |
| GET | /api/cases/:id | 获取病例详情（包含所有关联数据和校验结果） |
| POST | /api/cases | 创建新病例 |
| PUT | /api/cases/:id/transition | 转换病例状态 |

### 牙位相关
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/cases/:id/teeth | 为病例添加牙位 |

### 返工相关
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/rework-requests | 创建返工申请 |
| PUT | /api/rework-requests/:id/review | 复核返工申请（批准/拒绝） |

### 试戴反馈相关
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/try-in-feedbacks | 创建试戴反馈 |
| PUT | /api/try-in-feedbacks/:id/follow-up | 标记为已跟进 |

### 导入导出
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/:entityType | 导入数据（支持CSV/JSON） |
| GET | /api/export/:entityType | 导出数据（format参数: csv/json/markdown） |

### 其他
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/dashboard | 获取仪表盘统计数据 |
| GET | /api/validation/:caseId | 执行病例校验 |

## 常见问题

### Q1: 数据库文件在哪里？
默认位置: `data/denture.db`
可以通过 `DB_PATH` 环境变量自定义路径。

### Q2: 如何重置数据库？
直接删除 `data/denture.db` 文件，下次启动服务时会自动重建。

### Q3: 支持哪些牙位编号？
支持标准的FDI牙位表示法：1-32号牙。

### Q4: 如何添加新的工序步骤？
在 `backend/src/state-machine.js` 的 `PROCESS_STEP_NAMES` 数组中添加。

### Q5: 如何自定义状态流转规则？
修改 `backend/src/state-machine.js` 中的 `CASE_STATE_TRANSITIONS` 配置。

## 生产部署

### 1. 构建前端
```bash
cd frontend
npm run build
```

构建产物在 `frontend/dist` 目录。

### 2. 启动后端服务
```bash
cd backend
npm start
```

### 3. 配置反向代理（可选）
使用 Nginx 等反向代理服务器，将静态文件和API请求分别转发。

## License

本项目仅供学习和内部使用。

## 技术支持

如有问题，请检查：
1. Node.js 版本 >= 18
2. 端口 3001 和 5173 未被占用
3. 依赖已正确安装
