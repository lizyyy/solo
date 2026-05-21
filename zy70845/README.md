# 便利店运营数据统一处理平台

解决便利店运营数据导入混乱问题，统一处理货架盘点、销售数据、补货单，进行标准化校验和分类。

## 功能特性

- ✅ **多格式支持**: CSV/JSON 文件上传
- ✅ **业务规则校验**: 少补/多补校验、临期品校验、SKU别名映射
- ✅ **智能分类**: 正常项、待确认项、失败项分类返回
- ✅ **失败详情**: 保留原始字段 + 处理建议
- ✅ **幂等机制**: 同批次号重复提交不重复生效
- ✅ **点位编号**: 支持门店点位标识

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 访问应用

- 前端页面: `http://localhost:5173`
- 后端API: `http://localhost:4000`

## 样例数据测试

项目根目录提供样例数据：

- `sample-inventory.csv` - 货架盘点数据
- `sample-sales.json` - 销售数据（含SKU别名）
- `sample-replenishment.csv` - 补货单数据（含少补/多补情况）

## 业务规则

### SKU别名映射

| 标准SKU | 标准名称 | 别名示例 |
|---------|----------|----------|
| SKU001 | 可口可乐500ml | 可乐、可口可乐、Coca-Cola |
| SKU002 | 百事可乐500ml | 百事、Pepsi |
| SKU003 | 农夫山泉550ml | 矿泉水、饮用水 |
| SKU004 | 康师傅红烧牛肉面 | 方便面 |
| SKU005 | 乐事薯片原味75g | 薯片、乐事薯片、Lays |

### 少补/多补校验

- **少补**: 补货量 < 预期销量 30% → 待确认
- **多补**: 补货量 > 预期销量 3倍 → 待确认

### 临期品校验

- 距过期日期 < 30天 → 待确认
- 已过期 → 失败

## API接口

### 数据导入

```
POST /api/import
Content-Type: multipart/form-data

参数:
- batchId: 批次号（幂等）
- storeId: 点位编号
- inventoryCsv: 盘点CSV（可选）
- salesJson: 销售JSON（可选）
- replenishmentForm: 补货单（可选）
```

### 查询批次

```
GET /api/import/batch/:batchId
```

### 批次列表

```
GET /api/import/batches
```

## 技术栈

- **前端**: React 18 + TypeScript + Vite + TailwindCSS
- **后端**: Node.js + Express
- **文件处理**: Multer + Papaparse
- **状态管理**: Zustand

## 项目结构

```
.
├── api/                    # 后端代码
│   ├── routes/            # API路由
│   ├── services/          # 业务服务
│   └── app.ts             # 应用入口
├── src/                    # 前端代码
│   ├── components/        # React组件
│   ├── pages/             # 页面组件
│   └── services/          # API服务
├── shared/                 # 共享类型
├── sample-*.*              # 样例数据
└── package.json
```

## 可用命令

```bash
npm run dev        # 启动开发服务器
npm run build      # 构建生产版本
npm run check      # TypeScript类型检查
npm run lint       # ESLint代码检查
npm run preview    # 预览构建结果
```

## 运行说明

完整运行说明请参考 [运行说明.md](./运行说明.md)
