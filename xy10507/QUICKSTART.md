# 广告素材版本投放 API - 快速上手指南

## 🎯 项目概述

一个完整的广告素材多版本投放管理系统，围绕"按渠道、预算、审核状态和回滚记录管控上线"设计。

解决的核心问题：
- ✅ 未审核不能上线（强制审核流程）
- ✅ 预算耗尽不能投（实时预算监控）
- ✅ 同渠道只能一个有效版本（防止版本冲突）
- ✅ 回滚后效果数据保留（历史数据不丢失）
- ✅ 重复执行或重复回调保持幂等（防止重复扣费）
- ✅ 人工修正必须留下前后差异和操作者（可追溯审计）

---

## 🚀 快速启动

### 1. 安装依赖
```bash
cd /Users/mac/pro/solo/workspaces/xy10507
npm install
```

### 2. 创建数据库和样例数据
```bash
mkdir -p data
npm run seed
```

### 3. 启动服务
```bash
npm start
```

服务启动后：
- 管理面板：http://localhost:3001/
- 健康检查：http://localhost:3001/api/health
- API 文档：见下文

### 4. 运行完整演示（可选）
```bash
# 开一个新终端运行（保持服务运行中）
npm run demo:all
```

---

## 📊 核心数据结构

### 素材版本树
```
v1.0: 夏季新品首发
  └── v1.1: 夏季新品首发-升级版 (基于v1.0修改)
        └── v2.0: 夏日清凉节 (基于v1.1修改)
              └── v2.1: 夏日清凉节-直播版 (基于v2.0修改)
                    └── v3.0: 周末狂欢购 (基于v2.1修改)
```

### 投放渠道
- 微信广告 (wechat)
- 抖音广告 (douyin)
- 小红书 (xhs)
- 微博广告 (weibo)
- 百度信息流 (baidu)

---

## 🎬 演示路径

### 路径一：新版本上线（成功路径）

**目标**：演示从素材创建 → 审核 → 上线 → 效果记录的完整流程

**步骤分解**：

1. **分配渠道**：选择 v3.0 分配到微信广告，预算 ¥10,000
   - 状态：draft → 待审核

2. **提交审核**：运营专员提交审核
   - 状态：draft → pending_review

3. **审核通过**：审核员确认内容合规
   - 审核状态：pending → approved
   - 投放状态：pending_review → approved

4. **验证规则**：检查是否满足上线条件
   - ✅ 审核状态：approved（已通过）
   - ✅ 预算剩余：¥10,000（充足）
   - ✅ 渠道唯一：微信广告无其他生效版本

5. **上线投放**：正式开始投放
   - 状态：approved → running

6. **记录效果**（Day 1）：曝光 5万、点击 2500、转化 125、消耗 ¥3,000
   - 预算消耗：¥10,000 → 剩余 ¥7,000

7. **幂等性测试**：重复回调同一 request_id
   - ✅ 系统识别为重复请求，不重复记录
   - 消耗保持 ¥8,000 不变

8. **记录效果**（Day 2）：曝光 8万、点击 4000、转化 200、消耗 ¥5,000
   - 预算消耗：¥10,000 → 剩余 ¥2,000（使用率 80%）

9. **验证状态**：查看投放面板
   - 素材版本：v3.0
   - 渠道状态：running（投放中）
   - 审核状态：approved（已通过）
   - 预算使用率：80%

10. **暂停投放**：需要优化调整
    - 状态：running → paused

---

### 路径二：规则拦截（失败路径）

**目标**：演示系统如何防止违规操作

#### 场景 1：未审核不能上线

1. 分配 v1.1 到抖音广告，预算 ¥1,000
2. **跳过审核，直接上线** → ❌ 被拦截
   - 错误码：VALIDATION_FAILED
   - 违反规则：审核状态检查 → 未审核不能上线
   - 当前审核状态：pending

3. 提交审核后审核驳回（原因：包含敏感词"最低价"）
4. **再次尝试上线** → ❌ 被拦截
   - 违反规则：审核状态检查 → 未审核不能上线
   - 当前审核状态：rejected

#### 场景 2：预算耗尽不能投

1. 分配 v2.0 到小红书，预算 ¥500
2. 审核通过并上线
3. **尝试记录 ¥600 消耗**（超过预算）→ ❌ 被拦截
   - 错误码：BUDGET_EXHAUSTED
   - 违反规则：预算检查 → 预算耗尽不能投
   - 预算：¥500，需要消耗：¥600

#### 场景 3：同渠道只能一个有效版本

（逻辑说明：系统在上线前检查渠道是否已有 running 状态的版本，如有则拦截）

---

### 路径三：旧版本回滚

**目标**：演示新版本效果不佳时，如何安全回滚到历史版本

**业务场景**：
- v1.0：夏季新品首发（稳定版本，效果好）
- v2.1：夏日清凉节-直播版（新版本，效果不佳）

**步骤**：

1. 先上线 v1.0 到微博广告，预算 ¥20,000
2. 记录效果：曝光 10万、点击 3000、转化 150、消耗 ¥4,500
3. **暂停当前版本**：准备回滚
4. **回滚到 v1.0**：运营经理操作，原因"新版本效果不佳"
   - 回滚记录自动保存
   - 版本切换：v2.1 → v1.0
   - 状态自动恢复为 running

5. **验证数据保留**：查看效果报表
   - ✅ v1.0 的效果数据仍然存在
   - ✅ 总消耗 ¥4,500 被保留
   - ✅ CTR = 3.0%，CVR = 5.0%

---

### 路径四：人工修正审计

**目标**：演示紧急情况下的人工操作如何留下审计痕迹

**场景**：发现某个投放预算设置不合理，需要紧急调整

**操作**：
- 目标：小红书渠道的 v2.0 投放
- 操作前：预算 ¥500，状态 running
- 操作后：预算 ¥10,000，状态 paused
- 操作者：系统管理员-超级用户
- 原因：紧急调整预算，防止超投

**审计记录自动保存**：
```json
{
  "before_data": { "budget": 500, "status": "running" },
  "after_data": { "budget": 10000, "status": "paused" },
  "operator": "系统管理员-超级用户",
  "reason": "紧急调整预算，防止超投",
  "created_at": "2024-XX-XXTXX:XX:XX"
}
```

---

## 🔍 如何验证业务闭环

### 1. 查看管理面板

打开浏览器：http://localhost:3001/

**检查要点**：

| 标签页 | 验证内容 | 预期结果 |
|--------|----------|----------|
| 📊 总览 | 各渠道投放状态 | 看到多个渠道，状态不同（running/paused/rejected） |
| 🌳 版本树 | 素材版本层级关系 | v1.0 → v1.1 → v2.0 → v2.1 → v3.0 完整树结构 |
| 📱 渠道状态 | 每个渠道的当前版本 | 微信广告: v3.0，抖音: v1.1（被驳回）等 |
| 💰 预算消耗 | 使用率进度条 | 微信广告使用率 80%（黄色警告），小红书 0% |
| 🔄 回滚历史 | 回滚操作记录 | 看到从 v2.1 回滚到 v1.0 的记录 |
| 📈 效果数据 | 汇总和明细 | 总曝光 > 23万，总消耗 > ¥12,500 |

### 2. 导出完整报告

点击页面上的「📊 导出报告」按钮，或访问：
```
http://localhost:3001/api/reports/export/{campaignId}
```

报告包含：
- materials：所有素材版本
- channel_assignments：渠道分配及状态
- rollback_history：回滚历史
- performance_data：效果数据
- manual_corrections：人工修正记录

---

## 📋 API 接口清单

### 活动管理
- `POST /api/campaigns` - 创建活动
- `GET /api/campaigns` - 活动列表
- `GET /api/campaigns/:id` - 活动详情

### 渠道管理
- `POST /api/channels` - 创建渠道
- `GET /api/channels` - 渠道列表

### 素材版本
- `POST /api/materials` - 创建素材版本
- `GET /api/materials?campaign_id=xxx` - 素材列表
- `GET /api/materials/tree/:campaignId` - 版本树结构
- `POST /api/materials/:id/assign-channels` - 分配渠道和预算

### 状态推进（核心）
- `POST /api/materials/channel/:mcId/submit-review` - 提交审核
- `POST /api/materials/channel/:mcId/approve` - 审核通过
- `POST /api/materials/channel/:mcId/reject` - 审核驳回
- `POST /api/materials/channel/:mcId/launch` - 上线投放
- `POST /api/materials/channel/:mcId/pause` - 暂停
- `POST /api/materials/channel/:mcId/resume` - 恢复
- `POST /api/materials/channel/:mcId/stop` - 停止
- `POST /api/materials/channel/:mcId/rollback` - 回滚版本

### 效果数据
- `POST /api/materials/channel/:mcId/performance` - 回填效果数据
- `GET /api/reports/performance/:campaignId` - 效果汇总

### 历史和查询
- `GET /api/materials/channel/:mcId/history` - 状态变更历史
- `GET /api/reports/rollback-history/:campaignId` - 回滚历史
- `GET /api/reports/campaign/:campaignId/dashboard` - 总览数据

### 人工修正
- `POST /api/materials/manual-correct` - 记录人工修正
- `GET /api/materials/manual-corrections/:targetId` - 查看修正历史

### 报表导出
- `GET /api/reports/export/:campaignId` - 导出完整报告（JSON）

---

## 🎯 关键设计规则

### 1. 状态机
```
draft → pending_review → approved → scheduled → running → paused → stopped
              ↓              ↓
           rejected    (可回退到 pending_review)
```

### 2. 上线前规则检查
必须同时满足：
- ✅ 审核状态 = approved
- ✅ 预算剩余 > 0
- ✅ 同渠道无其他 running 版本

### 3. 幂等性
- 关键操作（launch、performance、rollback 等）支持 request_id
- 相同 request_id 只执行一次，后续返回缓存结果

### 4. 数据保留
- 回滚操作不删除任何历史数据
- 所有版本的效果数据独立保存，可追溯

---

## 🔧 项目结构

```
.
├── config/
│   └── database.js          # SQLite 数据库配置
├── data/                    # 数据库文件目录
├── public/
│   └── index.html          # 管理面板前端
├── routes/
│   ├── campaigns.js        # 活动管理接口
│   ├── channels.js         # 渠道管理接口
│   ├── materials.js        # 素材版本和状态管理
│   └── reports.js          # 报表和导出接口
├── scripts/
│   ├── seed.js             # 初始化样例数据
│   └── demo-all.js         # 完整演示脚本
├── services/
│   ├── rulesEngine.js      # 业务规则引擎
│   └── stateManager.js     # 状态管理和事务处理
├── package.json
├── server.js               # Express 服务器入口
└── QUICKSTART.md           # 本文档
```

---

## ❓ 常见问题

**Q: 如何重置所有数据？**
```bash
rm -rf data/ad-material.db
npm run seed
```

**Q: 如何添加新渠道？**
```bash
curl -X POST http://localhost:3001/api/channels \
  -H "Content-Type: application/json" \
  -d '{"name":"快手广告","code":"kuaishou","description":"快手短视频平台"}'
```

**Q: 如何测试幂等性？**
在请求体中传入相同的 `request_id`：
```json
{
  "operator": "测试员",
  "request_id": "test-launch-001"
}
```

---

## ✅ 演示已完成验证

当前环境已执行完整演示，验证通过：

- ✅ 新版本上线流程正常
- ✅ 未审核上线被拦截
- ✅ 预算耗尽被拦截
- ✅ 版本回滚功能正常
- ✅ 幂等性机制生效
- ✅ 人工修正记录保存
- ✅ 所有数据可在管理面板查看

**打开 http://localhost:3001/ 即可查看完整结果！**
