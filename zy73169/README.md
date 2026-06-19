# 曲线拟合参数回放工具

教研编辑阿宁的好帮手，支持数据溯源、异常检测、变更对比、口径一致性校验。

## 三步操作指南

1. **创建会话** - 填写名称和操作人，点击「创建会话」
2. **加载数据** - 点击「加载演示数据」或通过API导入学生草稿
3. **查看结果** - 选择拟合方法，点击「开始拟合」

## 坏材料来了该看哪里？

| 异常类型 | 颜色标记 | 排查要点 | 操作入口 |
|---------|---------|---------|---------|
| 🔴 重复样本 | 红色 | 查看顶部异常统计，点击样本追溯原始文件行号 | 异常统计卡片 + 样本详情 |
| 🟠 离群值 | 橙色 | 残差过大的点，查看来源确认是否录入错误 | 样本详情 → 原始来源 |
| 🔵 边界样本 | 蓝色 | 样本量不足5个时全部标记，建议补充数据 | 异常统计卡片 |
| 🟣 已撤回 | 紫色 | 点击「撤回记录复算」对比撤回前后参数变化 | 快捷操作 → 撤回记录复算 |

## 评审会复盘必备

- **变更对比** - 查看人工确认前后改了什么，谁改的，什么时候改的
- **口径校验** - 一键确认图表和明细数据口径一致
- **来源追溯** - 每个点都能追溯到学生ID、草稿ID、原始文件行号

## 技术架构

```
src/
├── models/           # 数据模型
│   ├── types.ts      # 类型定义
│   └── factories.ts  # 工厂函数
├── algorithms/       # 核心算法
│   ├── fitting.ts    # 曲线拟合（线性/多项式/指数/对数）
│   └── anomalyDetection.ts  # 异常检测
├── services/         # 业务逻辑
│   ├── traceability.ts      # 数据溯源与变更管理
│   └── FittingService.ts    # 服务层主入口
├── server/           # API服务
│   └── index.ts      # Express服务
└── test/             # 测试用例
```

## 安装与运行

```bash
npm install
npm run dev          # 开发模式
npm run build        # 构建
npm start            # 生产模式
npm test             # 运行测试
```

打开 http://localhost:3000 即可使用。

## API 接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/sessions` | 创建会话 |
| GET | `/api/sessions` | 获取所有会话 |
| POST | `/api/sessions/:id/samples` | 添加样本 |
| POST | `/api/sessions/:id/fitting` | 执行曲线拟合 |
| POST | `/api/sessions/:id/samples/:sampleId/confirm` | 确认样本有效 |
| POST | `/api/sessions/:id/samples/:sampleId/withdraw` | 撤回样本 |
| GET | `/api/sessions/:id/samples/:sampleId/history` | 获取变更历史 |
| POST | `/api/sessions/:id/replay-withdrawn` | 撤回复算对比 |
| GET | `/api/sessions/:id/fitting/:fittingId/verify` | 校验口径一致性 |

## 核心特性

✅ **异常点追溯** - 点击图表上的异常点直接查看原始材料  
✅ **原始数据保留** - 所有修改都记录在变更历史中，脏数据不被掩盖  
✅ **重复样本检测** - 自动识别重复录入的样本并单独拎出  
✅ **撤回复算** - 将撤回记录放回数据复算，对比参数变化  
✅ **口径校验** - 确保图表展示和明细数据使用同一口径  
✅ **变更对比** - 清晰展示人工确认前后的所有修改
