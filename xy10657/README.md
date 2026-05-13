# 场馆课程候补换课管理系统

## 功能概述

这是一个完整的场馆课程候补换课管理系统，包含以下核心功能：

### 核心功能
1. **会员课包管理** - 管理会员的课程包信息、有效期、使用次数
2. **课程排期管理** - 查看课程安排、教练、容量和报名情况
3. **候补队列管理** - 会员加入候补、查看队列位置
4. **候补推进** - 课程有空位时自动将候补会员转为正式报名
5. **状态修正** - 人工修正候补状态和队列位置
6. **消课余额管理** - 查看和调整会员消课余额
7. **教练请假管理** - 记录教练请假并通知相关候补会员
8. **调课历史记录** - 完整记录所有调课操作和状态变更
9. **批量导入** - 支持批量导入会员课包和课程排期
10. **数据导出** - 支持按责任人、日期范围筛选导出CSV

### 业务规则
- **教练请假异常处理**：教练请假时，通知该日期所有相关课程的候补会员
- **消课余额人工处理**：余额不足时需要管理员调整后才能推进候补
- **重复操作幂等**：所有关键操作支持幂等性校验，防止重复提交
- **状态时间线**：每个候补记录都有完整的状态变更时间线，记录变更原因和操作人

## 安装运行

1. 安装依赖：
```bash
npm install
```

2. 启动服务：
```bash
npm start
```

3. 访问系统：
```
http://localhost:3000
```

## 数据结构

### 会员课包 (memberPackages)
- `id`: 课包ID
- `memberId`: 会员ID
- `memberName`: 会员姓名
- `memberPhone`: 会员电话
- `packageName`: 课包名称
- `totalCount`: 总次数
- `usedCount`: 已使用次数
- `validFrom`: 有效期开始
- `validTo`: 有效期结束
- `status`: 状态

### 候补队列 (waitlistQueue)
- `id`: 候补记录ID
- `memberId`: 会员ID
- `memberName`: 会员姓名
- `scheduleId`: 课程排期ID
- `courseName`: 课程名称
- `courseDate`: 课程日期
- `courseTime`: 课程时间
- `position`: 队列位置
- `status`: 状态 (waiting/advanced/cancelled)
- `priority`: 优先级 (normal/vip)
- `timeline`: 状态时间线

### 调课历史 (transferHistory)
- `id`: 记录ID
- `type`: 类型
- `memberId`: 会员ID
- `memberName`: 会员姓名
- `fromScheduleId`: 原课程ID
- `toScheduleId`: 新课程ID
- `status`: 状态
- `reason`: 原因
- `handledBy`: 处理人
- `createdAt`: 创建时间

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/member-packages | 获取会员课包列表 |
| GET | /api/course-schedules | 获取课程排期列表 |
| GET | /api/waitlist | 获取候补队列 |
| POST | /api/waitlist | 添加候补记录 |
| POST | /api/waitlist/:id/advance | 推进候补 |
| POST | /api/waitlist/:id/correct | 修正候补状态 |
| GET | /api/waitlist/:id/timeline | 获取状态时间线 |
| GET | /api/transfer-history | 获取调课历史 |
| GET | /api/coach-leaves | 获取教练请假列表 |
| POST | /api/coach-leaves | 添加教练请假 |
| GET | /api/consumption-balance | 获取消课余额 |
| POST | /api/consumption-balance/:id/adjust | 调整消课余额 |
| POST | /api/batch-import | 批量导入数据 |
| GET | /api/export/transfer-history | 导出调课历史 |
| DELETE | /api/reset | 重置所有数据 |

## 样例数据

项目包含以下样例数据：
- 4个会员的课包信息
- 14个课程排期（未来14天）
- 2条候补记录
- 1条调课历史记录
- 1条教练请假记录

系统启动时会自动初始化这些数据。

## 批量导入格式

### 会员课包导入格式
```json
[
  {
    "memberId": "member_001",
    "memberName": "会员姓名",
    "memberPhone": "13900139000",
    "packageName": "课包名称",
    "totalCount": 30,
    "usedCount": 5,
    "validFrom": "2024-01-01",
    "validTo": "2024-12-31",
    "status": "active"
  }
]
```
