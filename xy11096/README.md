# 社区篮球联赛组联赛犯规申诉API

完整的篮球比赛犯规申诉管理系统，包含状态流转、跨引用检测、一致性评分等核心功能。

## 技术栈

- Node.js + Express.js
- TypeScript
- 内存数据存储（无需数据库）

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

服务启动后访问: http://localhost:3000

### 编译生产版本

```bash
npm run build
npm start
```

## 核心功能

### 1. 完整的申诉状态流转引擎

- **草稿 (draft)**: 新建申诉后的初始状态，可编辑修改
- **待审核 (submitted)**: 球队提交申诉后进入审核队列
- **审核中 (under_review)**: 裁判长开始审核
- **需补充 (needs_more_info)**: 审核中发现材料不全，要求补充
- **已通过 (approved)**: 审核通过，申诉成立
- **已驳回 (rejected)**: 审核驳回，申诉不成立

流转规则严格控制，不同角色权限不同。

### 2. 同一犯规多球队引用自动检测

系统自动识别同一场比赛、同一时间点、同一球员的犯规是否被多支球队同时申诉，建立交叉引用关系，方便审核时综合判断。

### 3. 申诉材料完整性一致性评分

系统根据证据材料、申诉理由、依据条款、联系方式等维度自动计算一致性评分（0-100分），帮助审核人员快速判断申诉质量。

### 4. 完整的操作审计日志

记录每一次状态变更的操作人、时间、角色和具体变更内容，全程可追溯。

### 5. 失败响应带可操作建议

所有错误响应都包含具体的操作建议，指导用户下一步该怎么做。

## API 接口文档

### 基础信息

- 基础地址: `http://localhost:3000/api`
- 数据格式: JSON

### 接口列表

#### 1. 健康检查
```
GET /api/health
```

#### 2. 创建新申诉
```
POST /api/appeals
Content-Type: application/json

{
  "gameInfo": {
    "leagueName": "朝阳区社区篮球联赛",
    "division": "甲组",
    "round": "小组赛第一轮",
    "gameDate": "2024-05-20",
    "gameTime": "19:00",
    "venue": "朝阳体育中心",
    "homeTeam": "街道A队",
    "awayTeam": "街道B队",
    "quarter": 2,
    "gameMinute": 5,
    "gameSecond": 30,
    "scoreAtTime": { "home": 35, "away": 30 }
  },
  "foulDetail": {
    "foulType": "personal",
    "severity": "moderate",
    "description": "防守方拉人犯规",
    "fouler": {
      "playerNumber": "12",
      "playerName": "张三",
      "teamName": "街道B队",
      "position": "前锋",
      "foulsBefore": 1
    },
    "referees": ["王裁判"]
  },
  "appealContent": {
    "appealingTeam": "街道A队",
    "teamRepresentative": {
      "name": "李经理",
      "role": "team_manager",
      "phone": "13800138000",
      "email": "manager@teama.com"
    },
    "appealReason": "该犯规动作过大，应升级为违体犯规",
    "appealBasis": ["FIBA规则第36条"],
    "requestedOutcome": "改判违体犯规",
    "supportingDocuments": ["video1.mp4"]
  },
  "operator": {
    "id": "mgr001",
    "name": "李经理",
    "role": "team_manager"
  }
}
```

#### 3. 提交申诉（进入审核队列）
```
POST /api/appeals/submit
Content-Type: application/json

{
  "appealId": "申诉ID",
  "operator": {
    "id": "mgr001",
    "name": "李经理",
    "role": "team_manager"
  }
}
```

#### 4. 审核申诉
```
POST /api/appeals/review
Content-Type: application/json

{
  "appealId": "申诉ID",
  "reviewer": {
    "id": "ref001",
    "name": "王裁判长",
    "role": "referee_chief"
  },
  "reviewResult": "approved",  // approved | rejected | needs_info
  "reviewComments": "经审核，申诉理由充分，同意改判",
  "requiredActions": ["执行改判"]
}
```

#### 5. 补充申诉材料
```
POST /api/appeals/supplement
Content-Type: application/json

{
  "appealId": "申诉ID",
  "operator": {
    "id": "mgr001",
    "name": "李经理",
    "role": "team_manager"
  },
  "additionalDocuments": ["new_evidence.mp4"],
  "additionalNotes": "补充了新的多角度录像证据"
}
```

#### 6. 获取单个申诉详情
```
GET /api/appeals/{id}
```

#### 7. 获取申诉列表（支持筛选）
```
GET /api/appeals?status=submitted&team=朝阳&page=1&limit=10
```

参数说明：
- `status`: 按状态筛选 (draft/submitted/under_review/needs_more_info/approved/rejected)
- `team`: 按申诉球队名称模糊搜索
- `page`: 页码，默认1
- `limit`: 每页数量，默认10

#### 8. 获取统计概览
```
GET /api/appeals/stats/summary
```

#### 9. 导出CSV
```
GET /api/appeals/export/csv?status=approved
```

## 完整验收流程

本地运行服务后，按照以下步骤进行完整链路验收：

### 步骤1: 启动服务并验证预置数据

1. 运行 `npm run dev` 启动服务
2. 访问 `GET /api/appeals/stats/summary`
   - 预期: 返回6条预置申诉数据，包含各状态分布
   - 应该能看到2条跨引用的申诉

### 步骤2: 查询所有申诉列表

```
GET /api/appeals?limit=20
```

- 预期: 返回完整的6条样例数据
- 验证: 每条数据都包含真实的联赛名称、球队名称、犯规详情等业务字段

### 步骤3: 查看跨引用申诉详情

找到 `BSK-APL-2024-0003` 和 `BSK-APL-2024-0004`（百度vs腾讯同一场比赛的互相申诉）

1. `GET /api/appeals/{id-of-0003}`
   - 预期: `crossReferencedAppeals` 字段包含申诉0004的ID
   - 预期: 一致性评分约90分

2. `GET /api/appeals/{id-of-0004}`
   - 预期: `crossReferencedAppeals` 字段包含申诉0003的ID
   - 预期: 两支球队对同一时间点的犯规有相反的申诉主张

### 步骤4: 创建新申诉（草稿状态）

使用上面「创建新申诉」的请求体提交请求

- 预期: 返回201状态码，新申诉状态为 `draft`
- 预期: 生成唯一申诉编号，格式如 `BSK-APL-2024-0007`
- 预期: `auditLogs` 记录了创建操作

### 步骤5: 提交申诉（草稿 -> 待审核）

```
POST /api/appeals/submit
{
  "appealId": "刚才创建的申诉ID",
  "operator": { "id": "mgr001", "name": "李经理", "role": "team_manager" }
}
```

- 预期: 状态变为 `submitted`
- 预期: 系统自动检测是否有跨引用
- 预期: 计算一致性评分

### 步骤6: 开始审核（待审核 -> 审核中）

```
POST /api/appeals/review
{
  "appealId": "刚才的申诉ID",
  "reviewer": { "id": "ref001", "name": "王裁判长", "role": "referee_chief" },
  "reviewResult": "needs_info",
  "reviewComments": "证据不够充分，请提供比赛录像的具体时间点和更多角度的画面",
  "requiredActions": ["补充更多角度的录像", "提供证人联系方式"]
}
```

- 预期: 状态变为 `needs_more_info`
- 预期: `reviewHistory` 增加审核记录
- 预期: `auditLogs` 记录审核操作

### 步骤7: 补充材料（需补充 -> 审核中）

```
POST /api/appeals/supplement
{
  "appealId": "刚才的申诉ID",
  "operator": { "id": "mgr001", "name": "李经理", "role": "team_manager" },
  "additionalDocuments": ["angle2_video.mp4", "angle3_video.mp4"],
  "additionalNotes": "已补充另外两个角度的录像，清晰可见犯规动作。证人电话：139xxxxxxx"
}
```

- 预期: 状态变回 `under_review`
- 预期: `appealContent.additionalNotes` 包含补充说明
- 预期: `supportingDocuments` 增加了新文件

### 步骤8: 最终审核通过（审核中 -> 已通过）

```
POST /api/appeals/review
{
  "appealId": "刚才的申诉ID",
  "reviewer": { "id": "ref001", "name": "王裁判长", "role": "referee_chief" },
  "reviewResult": "approved",
  "reviewComments": "补充材料充分，经核实确实属于违体犯规。同意申诉。",
  "requiredActions": ["技术统计部门更新该场比赛记录", "联赛官网公示改判结果"]
}
```

- 预期: 状态变为 `approved`（终态，不可再变更）
- 预期: `resolvedAt` 记录解决时间

### 步骤9: 导出数据

```
GET /api/appeals/export/csv?status=approved
```

- 预期: 下载CSV文件
- 预期: 包含所有已通过的申诉记录
- 预期: 文件编码为UTF-8带BOM，Excel可正常打开中文

### 步骤10: 验证错误响应的操作建议

测试提交一个处于终态的申诉:

```
POST /api/appeals/submit
{
  "appealId": "申诉BSK-APL-2024-0001的ID（已通过状态）",
  "operator": { "id": "mgr001", "name": "李经理", "role": "team_manager" }
}
```

- 预期: 返回400错误
- 预期: `error.suggestions` 包含明确的操作建议
- 预期: 错误信息清晰说明"终态不可变更"的原因

## 用户角色说明

| 角色 | 权限说明 |
|------|----------|
| team_manager | 球队经理：可创建、编辑、提交、补充申诉材料 |
| team_captain | 球队队长：与经理权限相同 |
| referee_chief | 裁判长：可审核申诉、通过/驳回、要求补充材料 |
| league_reviewer | 联赛审核员：与裁判长权限相同 |

## 样例数据说明

系统启动时自动加载6条真实场景的样例数据：

1. **BSK-APL-2024-0001**: 朝阳联赛，已通过的恶意犯规申诉
2. **BSK-APL-2024-0002**: 海淀联赛，需要补充材料的技术犯规申诉
3. **BSK-APL-2024-0003**: 丰台企业邀请赛，腾讯队申诉（审核中）
4. **BSK-APL-2024-0004**: 同一场比赛，百度队反向申诉（待审核，与0003交叉引用）
5. **BSK-APL-2024-0005**: 通州中老年友谊赛，被驳回的轻微犯规申诉
6. **BSK-APL-2024-0006**: 东城青年联赛，草稿状态的夺权犯规申诉

## 项目结构

```
├── src/
│   ├── index.ts              # 应用入口
│   ├── types/
│   │   └── index.ts          # TypeScript类型定义
│   ├── store/
│   │   └── dataStore.ts      # 数据存储与业务逻辑
│   ├── utils/
│   │   └── statusWorkflow.ts # 状态流转引擎
│   ├── routes/
│   │   └── appealRoutes.ts   # API路由
│   └── scripts/
│       └── seedData.ts       # 样例数据生成
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
