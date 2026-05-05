# 面试反馈一致性审计台

一个面向小公司 HR 的本地全栈 Web 工具，用于检测面试过程中的一致性问题。

## 功能特性

- **数据导入**：支持导入候选人 CSV、面试反馈 JSONL、审计日志 JSONL、Offer 审批备注 JSONL
- **版本管理**：自动保存面试反馈的历史版本
- **一致性检测**：
  - 状态跳变检测（如从"初筛"直接跳到"通过"）
  - 评分修改无日志检测
  - 报告结论与本地历史不一致检测
  - 缺少审批记录检测
- **人工复核**：支持对检测出的问题添加复核备注，刷新后不丢失
- **数据导出**：
  - Markdown 格式审计报告
  - JSON 格式完整审计包

## 项目结构

```
xy4664/
├── backend/
│   ├── package.json      # 后端依赖
│   ├── server.js         # Express 服务器 + API 路由
│   ├── database.js       # SQLite 数据库模型
│   └── rulesEngine.js    # 规则检测引擎
├── frontend/
│   ├── index.html        # 主页面
│   ├── style.css         # 样式文件
│   └── app.js            # 前端逻辑
└── test-data/            # 测试数据示例
    ├── candidates.csv
    ├── interviews.jsonl
    ├── audit-logs.jsonl
    └── offer-approvals.jsonl
```

## 安装与运行

### 环境要求

- Node.js 14+
- npm 或 yarn

### 安装步骤

1. 进入后端目录安装依赖：

```bash
cd backend
npm install
```

2. 启动服务：

```bash
npm start
```

3. 浏览器访问：http://localhost:3000

## 数据格式说明

### 1. 候选人 CSV 格式

```csv
candidate_id,name,email,phone,position
C001,张三,zhangsan@example.com,13800138001,前端工程师
C002,李四,lisi@example.com,13800138002,后端工程师
C003,王五,wangwu@example.com,13800138003,产品经理
```

**字段说明**：
- `candidate_id`：候选人唯一标识（必填，否则自动生成）
- `name`：候选人姓名（必填）
- `email`：邮箱（可选）
- `phone`：电话（可选）
- `position`：应聘职位（可选）

### 2. 面试反馈 JSONL 格式

每行一个 JSON 对象：

```jsonl
{"candidate_id":"C001","feedback_id":"F001","round_name":"技术面","interviewer_name":"张经理","interview_date":"2024-01-15","overall_rating":4.0,"technical_rating":4.5,"soft_skill_rating":3.5,"status":"技术面"}
{"candidate_id":"C001","feedback_id":"F001","round_name":"技术面","interviewer_name":"张经理","interview_date":"2024-01-15","overall_rating":3.0,"technical_rating":3.0,"soft_skill_rating":3.0,"status":"待定"}
{"candidate_id":"C002","feedback_id":"F002","round_name":"初筛","interviewer_name":"李HR","interview_date":"2024-01-10","overall_rating":5.0,"status":"通过"}
```

**字段说明**：
- `candidate_id`：候选人ID（必填）
- `feedback_id`：反馈记录ID（同一 feedback_id 不同版本会被视为历史记录）
- `round_name`：面试轮次名称（如初筛、技术面、复试、终面）
- `interviewer_name`：面试官姓名
- `interview_date`：面试日期
- `overall_rating`：综合评分（1-5）
- `technical_rating`：技术评分（1-5）
- `soft_skill_rating`：软技能评分（1-5）
- `status`：面试状态（初筛、技术面、复试、终面、通过、待定、拒绝）

### 3. 审计日志 JSONL 格式

```jsonl
{"candidate_id":"C001","action":"修改评分","action_type":"rating_change","field_name":"overall_rating","old_value":"4.0","new_value":"3.5","operator":"张经理","comment":"技术能力与预期有差距"}
{"candidate_id":"C002","action":"状态更新","action_type":"status_change","field_name":"status","old_value":"技术面","new_value":"通过","operator":"李HR","comment":"表现优秀，推荐通过"}
```

**字段说明**：
- `candidate_id`：候选人ID（必填）
- `action`：操作描述（必填）
- `action_type`：操作类型（如 rating_change、status_change、approval）
- `field_name`：被修改的字段名
- `old_value`：修改前的值
- `new_value`：修改后的值
- `operator`：操作人
- `comment`：备注

### 4. Offer 审批备注 JSONL 格式

```jsonl
{"candidate_id":"C002","approval_id":"A001","approver":"王总监","approval_date":"2024-01-20","approval_status":"审批通过","comment":"薪资范围符合预期，同意录用"}
{"candidate_id":"C001","approval_id":"A002","approver":"王总监","approval_date":"2024-01-18","approval_status":"待定","comment":"需要进一步确认项目经验"}
```

**字段说明**：
- `candidate_id`：候选人ID（必填）
- `approval_id`：审批记录ID
- `approver`：审批人
- `approval_date`：审批日期
- `approval_status`：审批状态（如审批通过、待定、拒绝）
- `comment`：审批备注

## 检测规则说明

### 1. 状态跳变检测

检测面试状态是否按照合理流程转换：

**合法状态流转**：
- 初筛 → 技术面 / 拒绝
- 技术面 → 复试 / 拒绝 / 待定
- 复试 → 终面 / 拒绝 / 待定
- 终面 → 通过 / 拒绝 / 待定
- 待定 → 通过 / 拒绝 / 待定

**异常示例**：
- 初筛 → 通过（跳过了中间环节）
- 拒绝 → 通过（状态回退）

### 2. 评分修改无日志检测

检测面试反馈的评分在不同版本之间发生变化，但对应的审计日志中没有记录该修改操作。

**检测逻辑**：
- 对于同一 feedback_id 的不同版本
- 比较各评分字段（overall_rating、technical_rating、soft_skill_rating）
- 如果值发生变化，检查是否有对应的审计日志记录
- 无对应日志则标记为问题

### 3. 报告结论不一致检测

检测最终报告结论与最新面试反馈之间的不一致。

**检测内容**：
- 状态不一致：反馈显示"通过"，但报告结论为"待定"
- 评分不一致：反馈评分与报告评分不一致
- 缺少审批记录：状态为"通过"或"终面"但无 Offer 审批记录
- 审批无审计日志：有审批状态但无对应审计日志

## 使用流程

### 快速开始

1. 启动服务后，打开浏览器访问 http://localhost:3000

2. **导入数据**：
   - 在"数据导入"标签页，依次上传各类数据文件
   - 支持拖拽上传或点击上传
   - 上传后会显示导入统计

3. **运行检测**：
   - 切换到"问题检测"标签页
   - 点击"运行一致性检测"按钮
   - 查看检测结果，按严重程度区分（红色=高，黄色=中）

4. **查看详情**：
   - 点击问题卡片展开查看详细信息
   - 点击"备注"按钮添加复核意见
   - 切换到"候选人列表"标签页，点击候选人查看完整详情

5. **导出报告**：
   - 切换到"导出报告"标签页
   - 选择导出 Markdown 报告或 JSON 审计包
   - 文件会自动下载

### 测试数据

项目提供了测试数据文件，可以直接用于验证：

- `test-data/candidates.csv`：候选人示例数据
- `test-data/interviews.jsonl`：面试反馈示例（包含状态跳变、评分修改）
- `test-data/audit-logs.jsonl`：审计日志示例
- `test-data/offer-approvals.jsonl`：Offer 审批示例

## API 接口

### 文件上传

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/upload/candidates` | POST | 上传候选人 CSV |
| `/api/upload/interviews` | POST | 上传面试反馈 JSONL |
| `/api/upload/audit-logs` | POST | 上传审计日志 JSONL |
| `/api/upload/offer-approvals` | POST | 上传 Offer 审批 JSONL |

### 数据查询

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/stats` | GET | 获取统计数据 |
| `/api/candidates` | GET | 获取候选人列表 |
| `/api/candidates/:id` | GET | 获取候选人详情 |
| `/api/issues` | GET | 运行一致性检测并返回问题列表 |

### 复核备注

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/issues/:issueId/comments` | POST | 对问题添加复核备注 |

### 数据导出

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/export/markdown` | GET | 导出 Markdown 格式审计报告 |
| `/api/export/json` | GET | 导出 JSON 格式完整审计包 |

### 数据管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/data` | DELETE | 清空所有数据 |

## 数据库结构

系统使用 SQLite 本地数据库，自动创建以下表：

1. **candidates**：候选人基本信息
2. **interview_feedback**：面试反馈（含版本号）
3. **audit_logs**：审计日志
4. **offer_approvals**：Offer 审批记录
5. **report_snapshots**：报告快照
6. **review_comments**：复核备注（刷新不丢失）

## 注意事项

1. **数据本地化**：所有数据存储在本地 SQLite 数据库文件 `backend/interview-audit.db`，不会上传到任何服务器
2. **版本控制**：同一 feedback_id 的多次导入会被视为不同版本，用于检测历史变化
3. **文件格式**：JSONL 文件要求每行一个独立的 JSON 对象，不要使用数组格式
4. **状态值**：建议使用标准状态值以获得最佳检测效果：初筛、技术面、复试、终面、通过、待定、拒绝

## 故障排查

### 端口被占用

修改 `backend/server.js` 中的 `PORT` 变量：

```javascript
const PORT = 3001; // 改为其他端口
```

### 导入失败

- 检查 CSV/JSONL 文件编码（建议 UTF-8）
- 检查 JSONL 每行是否为有效 JSON
- 确认必填字段是否存在

### 检测不到问题

- 确认导入的数据中存在真实的不一致情况
- 检查状态值是否使用标准值
- 尝试使用测试数据进行验证

## 开源协议

MIT License
