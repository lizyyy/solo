# 电影调色LUT台账系统

一个本地运行的LUT（Look Up Table）调色文件台账管理服务，用于影视后期团队规范管理调色文件，解决项目、场景和版本命名混乱问题。

## 核心特性

- **文件哈希校验**: 自动计算SHA256文件哈希，确保文件内容可追溯
- **版本归档**: 每次覆盖或撤回操作自动打包归档历史版本
- **场景标签**: 支持项目-场景二级分类管理
- **冲突检测**: 同名文件、重复内容、场景错配、版本回退等冲突自动识别
- **状态流转**: draft/active/archived/superseded/withdrawn/conflict 六态管理
- **报告导出**: 支持CSV台账导出和单LUT完整溯源报告
- **操作审计**: 全量操作日志记录，每一步可追溯

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 3. 运行测试（可选）

打开另一个终端，在服务启动后运行：

```bash
npm test
```

## API 接口

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects` | 获取项目列表 |
| GET | `/api/projects/:id` | 获取项目详情及统计 |
| POST | `/api/projects/:id/scenes` | 创建项目场景 |
| GET | `/api/projects/:id/scenes` | 获取项目场景列表 |
| GET | `/api/projects/:id/export` | 导出项目LUT台账(CSV) |

### LUT管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/luts/upload` | 上传新LUT |
| POST | `/api/luts/overwrite` | 覆盖已有版本 |
| POST | `/api/luts/supplement` | 补录历史LUT |
| POST | `/api/luts/:uuid/withdraw` | 撤回LUT |
| GET | `/api/luts/:uuid` | 获取LUT详情 |
| GET | `/api/luts` | 查询LUT列表 |
| GET | `/api/luts/:uuid/export` | 导出LUT完整报告 |
| GET | `/api/luts/:uuid/archives` | 查看归档历史 |

### 冲突管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/luts/conflicts/list` | 查看冲突列表 |
| POST | `/api/luts/conflicts/:id/resolve` | 标记冲突已解决 |
| POST | `/api/luts/conflicts/check` | 预检查文件冲突 |

## 使用示例

### 1. 创建项目

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"《深海迷航》","description":"科幻电影调色项目"}'
```

### 2. 创建场景

```bash
curl -X POST http://localhost:3000/api/projects/1/scenes \
  -H "Content-Type: application/json" \
  -d '{"name":"深渊探索","sceneCode":"S01","description":"深海主场景"}'
```

### 3. 上传LUT

```bash
curl -X POST http://localhost:3000/api/luts/upload \
  -F "lutFile=@/path/to/your.lut" \
  -F "projectId=1" \
  -F "sceneId=1" \
  -F "name=日光基础" \
  -F "version=v1.0" \
  -F "colorist=张调色师" \
  -F "notes=基础日光色调" \
  -F "tags=[\"日光\",\"基础\"]"
```

### 4. 覆盖版本

```bash
curl -X POST http://localhost:3000/api/luts/overwrite \
  -F "lutFile=@/path/to/new_version.cube" \
  -F "projectId=1" \
  -F "name=日光基础" \
  -F "version=v1.0" \
  -F "reason=导演要求调整对比度"
```

### 5. 撤回LUT

```bash
curl -X POST http://localhost:3000/api/luts/{uuid}/withdraw \
  -H "Content-Type: application/json" \
  -d '{"reason":"发现色彩偏移","operator":"审核员"}'
```

## 状态流转说明

| 状态 | 说明 | 触发场景 |
|------|------|----------|
| draft | 草稿 | 待确认的临时记录 |
| active | 生效 | 正常上传的LUT |
| archived | 归档 | 历史补录、旧版本归档 |
| superseded | 被替代 | 有新版本替代 |
| withdrawn | 已撤回 | 审核不通过或作废 |
| conflict | 冲突 | 版本回退、重复文件等 |

## 目录结构

```
├── src/
│   ├── config/          # 配置文件
│   ├── database/        # 数据库相关
│   ├── routes/          # API路由
│   ├── services/        # 业务逻辑
│   ├── scripts/         # 工具脚本
│   └── server.js        # 服务入口
├── tests/               # 测试脚本
├── storage/             # 数据存储（运行时生成）
│   ├── luts/           # LUT文件存储
│   ├── archives/       # 版本归档
│   ├── exports/        # 导出文件
│   ├── temp/           # 临时文件
│   └── lut-ledger.db   # SQLite数据库
└── package.json
```

## 测试用例覆盖

测试脚本包含 **23个测试用例**，覆盖：

### 成功路径
- ✅ 项目与场景创建
- ✅ LUT上传与哈希校验
- ✅ 版本覆盖与归档
- ✅ 新版本上传
- ✅ 历史LUT补录
- ✅ LUT撤回

### 失败路径
- ✅ 同名不同内容冲突
- ✅ 版本号格式错误
- ✅ 不支持的文件格式
- ✅ 项目不存在
- ✅ 跨项目场景错配
- ✅ 相同文件内容拒绝覆盖
- ✅ 补录缺少原因
- ✅ 重复撤回

### 边界场景
- ✅ 重复文件哈希检测与冲突记录
- ✅ 版本回退警告（conflict状态）
- ✅ 无场景通用LUT
- ✅ 同项目同名场景拒绝
- ✅ 同名项目拒绝
- ✅ 查询过滤功能
- ✅ 项目统计
- ✅ CSV/JSON报告导出
- ✅ 端到端可追溯性验证

## 设计理念

1. **每一条数据可追到底** - 文件哈希、版本历史、操作日志、归档文件四维追溯
2. **失败路径真实化** - 模拟真实工作中遇到的命名混乱、场景错配、版本覆盖等问题
3. **状态流转可靠** - 补录直接归档、撤回不可撤销、冲突显式标记
4. **零额外依赖** - SQLite本地存储，无需数据库服务，一键启动
