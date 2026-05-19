# 安装和验证指南

## 前置要求

- **Node.js**: 版本 18.x 或更高
- **npm**: 版本 9.x 或更高（随 Node.js 一同安装）

检查版本：
```bash
node --version  # 应该 >= 18.0.0
npm --version   # 应该 >= 9.0.0
```

---

## 安装步骤

### 方法一：使用根目录脚本（推荐）

```bash
# 在项目根目录执行
npm run install:all
```

### 方法二：手动分步安装

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install

# 返回根目录
cd ..
```

### 依赖说明

安装完成后会生成：
- `server/package-lock.json` - 后端依赖锁文件
- `client/package-lock.json` - 前端依赖锁文件

**注意**: `node_modules` 目录不会提交到版本控制，这是预期行为。

---

## 验证步骤

### 1. 类型检查（无输出编译验证）

#### 验证后端 TypeScript 编译
```bash
# 方法 A：使用根目录脚本
npm run typecheck:server

# 方法 B：直接进入 server 目录
cd server
npm run typecheck
# 或
npx tsc --noEmit
```

**预期结果**: 无错误输出，命令正常退出（exit code 0）

#### 验证前端 TypeScript 编译
```bash
# 方法 A：使用根目录脚本
npm run typecheck:client

# 方法 B：直接进入 client 目录
cd client
npm run typecheck
# 或
npx tsc --noEmit
```

**预期结果**: 无错误输出，命令正常退出（exit code 0）

### 2. 完整构建验证

#### 构建后端
```bash
# 方法 A：使用根目录脚本
npm run build:server

# 方法 B：直接进入 server 目录
cd server
npm run build
```

**预期结果**: 生成 `server/dist/` 目录，包含编译后的 JavaScript 文件

#### 构建前端
```bash
# 方法 A：使用根目录脚本
npm run build:client

# 方法 B：直接进入 client 目录
cd client
npm run build
```

**预期结果**: 生成 `client/build/` 目录，包含生产环境前端代码

---

## 运行项目

### 启动后端服务器

```bash
# 开发模式（带热重载）
npm run dev:server

# 或生产模式（需先 build）
cd server
npm start
```

后端服务将在 `http://localhost:3001` 启动

### 启动前端开发服务器

```bash
# 在新的终端窗口
npm run dev:client
```

前端应用将在 `http://localhost:3000` 启动

---

## 功能验证清单

启动前后端后，按以下步骤验证功能：

### 1. 基础页面访问
- [ ] 访问 `http://localhost:3000` 显示 Dashboard
- [ ] 左侧导航菜单正常显示（Dashboard, Content Management, Publish Calendar）

### 2. Dashboard 功能
- [ ] 统计卡片正确渲染（各状态数量统计）
- [ ] 图表正确显示（柱状图、饼图）
- [ ] 内容列表表格正常加载

### 3. 内容管理功能
- [ ] 点击 "Content Management" 显示内容列表
- [ ] 点击 "New Content" 可以创建新内容
- [ ] 创建内容后状态显示为 "Draft"

### 4. 审核流程
- [ ] 点击 "Submit for Review" 提交审核
- [ ] 状态变为 "Pending Review"
- [ ] 点击 "Review / Retry" 打开审核抽屉
- [ ] 可以 Approve / Reject / Withdraw 内容

### 5. 发布流程
- [ ] 审核通过后状态为 "Approved"
- [ ] 可以安排发布时间或立即发布
- [ ] "Publish Now" 按钮可以触发立即发布

### 6. 发布日历
- [ ] 点击 "Publish Calendar" 显示日历视图
- [ ] 日历组件正确渲染
- [ ] 可以切换月份查看不同日期的内容

### 7. API 接口验证
使用 curl 或 Postman 验证后端接口：
```bash
# 获取内容列表
curl http://localhost:3001/api/content

# 获取 Dashboard 统计
curl http://localhost:3001/api/dashboard/stats
```

---

## 常见问题排查

### 问题 1: `sh: tsc: command not found`
**原因**: 没有安装依赖
**解决**: 
```bash
cd server
npm install
```

### 问题 2: `sh: react-scripts: command not found`
**原因**: 没有安装前端依赖
**解决**:
```bash
cd client
npm install
```

### 问题 3: 端口被占用
**原因**: 3000 或 3001 端口已被其他程序使用
**解决**:
- 后端：修改 `server/src/index.ts` 中的 PORT 变量
- 前端：在 `client/.env` 中设置 `PORT=3002`

### 问题 4: 数据库连接失败
**原因**: SQLite 数据库文件权限问题
**解决**:
- 检查 `server/` 目录的写入权限
- 删除 `content-publish.db` 让系统重新创建

### 问题 5: 前端无法连接后端
**原因**: CORS 或代理配置问题
**解决**:
- 确认后端在 3001 端口运行
- 检查 `client/package.json` 中的 `proxy` 配置是否为 `"http://localhost:3001"`

---

## 完整验证脚本（参考）

```bash
#!/bin/bash
echo "=== 项目完整验证脚本 ==="

echo ""
echo "1. 检查 Node.js 版本..."
node --version

echo ""
echo "2. 安装所有依赖..."
npm run install:all

echo ""
echo "3. 后端类型检查..."
npm run typecheck:server

echo ""
echo "4. 前端类型检查..."
npm run typecheck:client

echo ""
echo "5. 构建后端..."
npm run build:server

echo ""
echo "6. 构建前端..."
npm run build:client

echo ""
echo "=== 验证完成 ==="
echo "如以上步骤全部成功，则项目已正确配置！"
```

---

## 预期交付物说明

项目交付时**不包含**以下内容（这是标准做法）：
- `node_modules/` 目录（运行时生成）
- `dist/` 或 `build/` 目录（构建产物）
- `*.db` 数据库文件（运行时生成）
- `package-lock.json` 锁文件（安装后生成）

项目交付时**包含**的必要文件：
- 所有源代码（`.ts`, `.tsx` 等）
- `package.json` 依赖声明
- `tsconfig.json` TypeScript 配置
- `.gitignore` Git 忽略配置
- 本安装验证文档
- README.md 使用文档

按照本文档执行安装后，项目应该能够：
- ✅ 通过 TypeScript 类型检查
- ✅ 成功构建前后端
- ✅ 正常启动运行
- ✅ 所有功能正常工作
