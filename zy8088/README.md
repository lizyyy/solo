# 巡检工单同步实验台

本地 Vite + TypeScript 前端实验平台，用于验证巡检平板应用的离线工单同步功能。

## 功能特性

- **在线/离线切换**: 通过 UI 开关模拟网络状态
- **工单编辑**: 编辑工单的照片备注和状态
- **IndexedDB 队列**: 离线操作持久化到本地队列
- **版本号重放**: 恢复在线后按版本号同步到模拟服务端
- **冲突解决**: 并排 diff 展示，手动选择本地/远端/合并版本
- **报告导出**: 支持导出 conflict_report.json

## 模块架构

```
src/
├── server/          # 模拟服务端
│   └── mockServer.ts
├── storage/         # IndexedDB 离线存储
│   └── indexedDB.ts
├── sync/            # 同步状态机
│   └── stateMachine.ts
├── conflict/        # 冲突合并与 diff
│   └── merge.ts
├── types.ts         # 类型定义
├── App.tsx          # 主应用
├── main.tsx         # 入口
└── styles.css       # 样式
```

## 特殊场景处理

### 1. 重复提交防护
- 使用 `operationSignature` (工单ID + 操作类型 + 时间戳 + payload) 进行去重
- 相同签名的待处理操作不会重复添加到队列

### 2. 远端关闭但本地继续修改
- 状态机跟踪服务端状态 (`isServerOpened`)
- 服务端关闭时标记队列项状态为 `failed`
- 重试机制: 最多重试 3 次
- 服务端重新开启后可继续同步

## 安装与运行

```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 使用说明

1. 启动应用后，3 个样例工单会自动加载
2. 点击工单可编辑备注、状态和照片说明
3. 编辑后点击"保存"会写入本地 IndexedDB 队列
4. 切换到"离线"模式可模拟断网
5. 切换"服务端关闭"可模拟服务端维护
6. 点击"同步"触发同步流程
7. 冲突时会弹出并排对比窗口
8. 可选择本地版本、远端版本或合并版本
9. 点击"导出冲突报告"下载 conflict_report.json

## 技术栈

- Vite 5.4
- React 18.2
- TypeScript 5.3
- idb 8.0 (IndexedDB wrapper)
