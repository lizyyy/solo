# 在线判题队列后台管理系统

## 功能概述

这是一个完整的在线判题队列后台管理系统，用于替代临时脚本。系统包含以下核心功能：

1. **提交记录管理** - 查看所有提交记录，支持多维度筛选
2. **评测机状态监控** - 实时查看评测机运行状态
3. **重判任务管理** - 管理和追踪重判任务的执行进度
4. **作弊标记与复核** - 标记可疑提交，支持复核流程
5. **题目版本管理** - 保留原始输入和处理结果
6. **排名导出** - 导出最终排名为CSV格式

## 技术栈

- **后端**: Python Flask + SQLite
- **前端**: Vue 3 + 原生HTML/CSS/JS

## 项目结构

```
oj-queue-backend/
├── backend/
│   ├── app.py              # Flask应用主文件
│   └── requirements.txt    # Python依赖
└── frontend/
    └── index.html          # 前端页面
```

## 安装与运行

### 1. 启动后端服务

```bash
cd backend
pip install -r requirements.txt
python app.py
```

后端服务将在 `http://localhost:5000` 启动

### 2. 访问前端页面

直接用浏览器打开 `frontend/index.html` 文件即可。

## 系统功能说明

### 数据概览
- 总提交数
- 通过数
- 作弊标记数
- 在线评测机数量

### 提交记录
- 支持按状态、题目ID、作弊标记、复核状态、用户ID筛选
- 查看提交详情（代码、评测日志、题目版本信息）
- 标记作弊提交
- 复核作弊标记（支持通过/拒绝）

### 评测机状态
- 查看所有评测机的运行状态
- 显示当前任务、CPU/内存使用率、任务统计

### 重判任务
- 查看所有重判任务及其执行进度
- 查看失败任务的错误信息和修正路径
- 查看关联的提交记录

### 题目版本
- 查看所有题目版本
- 保留原始输入和处理结果
- 支持从提交详情页追溯到题目版本

### 作弊标记流程
1. 标记提交为作弊，填写原因
2. 标记后状态为"待复核"
3. 管理员进行复核：
   - 确认作弊（复核通过）
   - 误判，取消标记（复核拒绝）
4. 所有操作都有记录留存

### 排名导出
- 导出CSV格式的排名数据
- 排除作弊标记的提交
- 按总分、通过数、提交时间排序

## 预置脏数据说明

系统预置了以下测试数据：

### 提交记录
- 7条提交记录
- 包含多种状态：Accepted、Wrong Answer、Runtime Error、Time Limit Exceeded
- 2条作弊标记记录
  - S003: 王五 - 代码相似度95%（待复核）
  - S005: 钱七 - 使用了禁止的库函数（已复核拒绝 - 误判）

### 评测机
- judge-01: online - 运行中
- judge-02: online - 空闲
- judge-03: offline - 离线
- judge-04: busy - 繁忙

### 重判任务
- R001: completed - 成功完成
- R002: failed - 失败，包含错误信息和修正路径（检查评测机状态、重启数据库、重新提交）
- R003: pending - 等待中

### 题目版本
- P1001 v1.0 / v1.1: 两数之和
- P1002 v1.0: 链表反转
- P1003 v1.0: 二叉树遍历

## API接口

- `GET /api/submissions` - 获取提交列表
- `GET /api/submissions/{id}` - 获取提交详情
- `POST /api/submissions/{id}/mark-cheating` - 标记作弊
- `POST /api/submissions/{id}/review` - 复核提交
- `GET /api/judge-machines` - 获取评测机状态
- `GET /api/rejudge-tasks` - 获取重判任务
- `GET /api/rejudge-tasks/{id}` - 获取重判任务详情
- `GET /api/problem-versions` - 获取题目版本
- `GET /api/ranking/export` - 导出排名
- `GET /api/stats` - 获取统计数据
