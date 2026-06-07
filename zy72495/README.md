# 早市摊位轮换管理系统

为社区书记周姐打造的摊位管理工具，解决公交刷卡时段、红线图备注与摊位轮换之间的协同管理难题，特别关注街道边界点位的规范化处理。

## 核心功能

- 🚌 **公交刷卡时段管理** - Excel/CSV导入，自动去重，不翻倍摊位轮换数量
- 📝 **红线图备注管理** - 版本历史、改前改后对比、版本回滚
- 🔄 **摊位轮换管理** - 边界点位自动标记、状态跟踪
- 🗺️ **地图展示** - 2D/3D切换、图表统计、点位点击溯源
- 📋 **操作历史** - 全流程记录、差异对比、可追溯
- ✅ **复核中心** - 边界点位项目经理人工复核

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 测试账号

| 用户名 | 角色 | 说明 |
|--------|------|------|
| zhoujie | 社区工作人员 | 周姐，日常操作使用 |
| chenjl | 项目经理 | 复核边界点位 |
| admin | 系统管理员 | 全功能权限 |

直接输入用户名即可登录（无需密码）。

---

## 🔒 边界规则（固化在代码和文档中）

### 1. 边界判定规则

1. **点位同时落在两个街道多边形范围内** → 判定为边界点位
2. **点位距离街道边界线小于5米** → 疑似边界点位，需人工确认
3. 归属判定以最新复核结果为准，历史版本永久保留

**代码位置**:
- `src/utils/geometryUtils.ts` - 几何计算核心逻辑
- `src/services/BoundaryService.ts` - 边界判定业务逻辑

### 2. 修改与回滚规则

1. 任何修改都生成新版本记录，包含完整的改前改后值对比
2. **单步回滚**: 恢复到上一个版本，同时记录回滚操作本身
3. **批量回滚**: 选择目标版本，确认后一次性回滚
4. 已复核通过的边界点位修改后，自动重回"待复核"状态

### 3. 重复导入规则

1. 判定维度：`线路名称 + 日期 + 开始时间 + 结束时间` 四者相同
2. 重复导入时：更新已有记录，**不创建新记录**
3. 摊位轮换数量根据有效时段计算，不因重复导入翻倍

### 4. 错误提示规则

- 错误提示使用人话，不暴露内部字段名
- 示例：✅ "请上传 Excel 或 CSV 格式的文件"
- 示例：❌ 不显示 "invalid_file_type (code 4001)"

---

## 核心业务流程

### 三步工作法（社区书记周姐日常）

```
导入公交刷卡时段 → 补看红线图备注 → 导出更新地图
        ↓                    ↓                    ↓
   自动去重校验       版本历史记录        边界点位待复核
   不翻倍数量        改前改后对比        项目经理处理
```

### 边界点位处理流程

```
系统识别边界点位 → 标记"待复核"状态 → 社区书记可查看不可修改
        ↓
项目经理复核中心人工判定 → 记录判定人/时间/依据 → 支持后续修改和回滚
```

## 技术栈

- **框架**: React 18 + TypeScript + Vite
- **状态管理**: Zustand (带持久化中间件)
- **路由**: React Router v6
- **样式**: TailwindCSS 3
- **3D渲染**: Three.js + @react-three/fiber + @react-three/drei
- **图表**: ECharts + echarts-for-react
- **文件处理**: xlsx (Excel) + papaparse (CSV)
- **导出**: html2canvas + jspdf

## 项目结构

```
src/
├── components/       # 公共组件
│   └── Layout.tsx    # 布局组件
├── pages/            # 页面组件
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── BusTimeManagement.tsx
│   ├── RedlineRemarkManagement.tsx
│   ├── StallRotation.tsx
│   ├── MapView.tsx
│   ├── OperationHistory.tsx
│   └── ReviewCenter.tsx
├── store/            # 状态管理
│   └── index.ts
├── types/            # TypeScript类型定义
│   └── index.ts
├── utils/            # 工具函数
│   ├── geometryUtils.ts      # 几何计算（边界判定）
│   ├── diffUtils.ts          # 差异比对
│   └── errorMessageUtils.ts  # 友好错误提示
├── services/         # 业务服务
│   └── ImportService.ts      # 导入服务（含去重）
├── data/             # Mock数据
│   └── mockData.ts
├── App.tsx
├── main.tsx
└── index.css
```
