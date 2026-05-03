# Media License Checker - 素材授权管理系统

一个本地桌面应用，帮助短视频剪辑师在交片前进行素材授权和用量体检，避免版权风险。

## 功能特性

### 1. 素材库管理
- 支持手工录入音乐、字体、图片、视频片段等素材
- 支持从 CSV/JSON 批量导入素材
- 每个素材可记录：
  - 授权来源（如 Epidemic Sound、Pexels、客户提供等）
  - 可用平台（抖音、小红书、B站等）
  - 客户/项目限制
  - 商用限制
  - 授权到期日
  - 是否必须署名
  - 备注和文件指纹/路径

### 2. 成片/项目视图
- 创建和管理项目
- 录入时间轴片段，记录：
  - 素材在第几秒到第几秒被使用
  - 用途是什么
  - 预计发布平台
  - 客户名
- 支持项目 JSON/CSV 导入导出

### 3. 授权规则检查
一键检查以下风险：
- **平台不匹配**：素材只允许在小红书发布，但项目要发抖音
- **商用不允许**：素材禁止商用，但项目是商业用途
- **授权过期**：授权已过期
- **授权即将过期**：14 天内即将过期
- **客户超范围**：素材仅限指定客户使用，但当前客户不在范围内
- **缺少署名**：素材需要署名，但交付清单中未包含
- **未知素材**：时间轴引用了素材库不存在的素材

### 4. 风险列表与处理建议
- 按风险等级（严重/高/中/低）筛选
- 按素材或风险类型分组
- 每个风险提供可操作的处理建议：
  - "换成同标签且允许抖音商用的素材"
  - "补充片尾署名"
  - "联系客户确认授权"
  - "立即更换素材或续期"

### 5. 数据持久化与导入导出
- 所有数据保存在本地 SQLite 数据库
- 重启应用后数据不丢失
- 支持：
  - 项目 JSON 导入导出
  - 素材库 CSV/JSON 导出
  - 风险结果 CSV 导出

### 6. 交付体检报告
生成 Markdown 或 HTML 格式报告，包含：
- 项目摘要
- 素材用量统计
- 风险明细（按优先级排序）
- 待补充署名清单
- 报告导出时间

### 7. 用户体验优化
- 清晰的侧边导航
- 表单校验
- 空状态提示
- 示例数据入口（一键加载测试数据）
- 导入错误详细提示

## 技术栈

- **前端框架**：React 18
- **UI 组件库**：Ant Design 5
- **桌面框架**：Electron 28
- **本地数据库**：SQL.js (SQLite)
- **构建工具**：Vite 5
- **其他依赖**：dayjs (日期处理)、papaparse (CSV解析)、uuid

## 安装与启动

### 环境要求
- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装依赖

```bash
npm install
```

### 开发模式启动

```bash
npm start
```

这会同时启动：
- Vite 开发服务器 (http://localhost:5173)
- Electron 应用窗口

### 构建打包

```bash
npm run build
```

打包后的应用位于 `dist/` 目录。

## 快速开始：用示例数据跑出报告

### 步骤 1：启动应用

```bash
npm start
```

### 步骤 2：加载示例数据

应用启动后，点击顶部导航栏的 **「加载示例数据」** 按钮。

这将自动创建：
- **6 个预置素材**（包含各种授权场景）
  - 欢快背景音乐 A（年付订阅，全平台可用）
  - 城市夜景 B-roll（Pexels 免费，需要署名）
  - 思源黑体（开源免费）
  - 某品牌专属音乐（限小红书+特定客户）
  - 美食特写镜头素材（不可商用，即将过期）
  - 产品宣传图（客户A专属）

- **1 个示例项目**
  - 项目名称：某品牌 618 推广短视频
  - 客户：某品牌客户
  - 目标平台：抖音、小红书

- **5 个时间轴片段**（包含多种风险场景，用于测试检查功能）

### 步骤 3：运行授权检查

1. 点击左侧导航 **「授权检查」**
2. 在「选择项目」下拉框中选择 **「某品牌 618 推广短视频」**
3. 点击 **「运行检查」** 按钮

### 步骤 4：查看风险结果

检查完成后，你会看到以下风险（示例数据特意设计的测试场景）：

| 风险等级 | 风险类型 | 素材名称 | 问题描述 |
|---------|---------|---------|---------|
| 🔴 严重 | 平台不匹配 | 某品牌专属音乐 | 只允许在小红书发布，但目标平台是抖音 |
| 🔴 严重 | 商用不允许 | 美食特写镜头素材 | 该素材仅允许个人非商业使用 |
| 🟠 高 | 授权即将过期 | 美食特写镜头素材 | 授权将在 X 天后过期 |
| 🟠 高 | 未知素材 | 未知音乐素材 | 素材库中没有此素材记录 |
| 🟡 中 | 缺少署名 | 城市夜景 B-roll | 需要署名但未在交付清单中添加 |

### 步骤 5：生成并导出报告

1. 点击左侧导航 **「报告中心」**
2. 选择项目查看详细报告
3. 点击右上角导出按钮：
   - **导出 HTML 报告**（推荐，美观易读）
   - **导出 Markdown**（便于编辑）
   - **风险 CSV**（便于数据处理）

### 步骤 6：查看报告内容

生成的报告包含：

1. **项目摘要**
   - 项目名称、客户、目标平台、状态
   - 时间轴片段数、素材用量

2. **风险概览统计**
   - 按等级统计：严重/高/中/低 数量

3. **风险明细**
   - 每个风险的详细信息和处理建议

4. **待补充署名清单**
   - 需要在片尾添加的素材来源标注

## 数据导入格式说明

### 素材库 CSV 格式

| 字段名 | 必填 | 说明 | 示例 |
|-------|-----|------|------|
| name | 是 | 素材名称 | 欢快背景音乐 A |
| type | 是 | 素材类型 | audio / video / image / font |
| tags | 否 | 标签（逗号分隔） | 欢快,积极,短视频 |
| license_source | 否 | 授权来源 | Epidemic Sound |
| allowed_platforms | 否 | 可用平台（逗号分隔） | 抖音,小红书,B站 |
| allowed_clients | 否 | 允许客户（逗号分隔） | 客户A,客户B |
| commercial_allowed | 否 | 允许商用 | true / false |
| expire_date | 否 | 到期日 | 2026-12-31 |
| requires_attribution | 否 | 需要署名 | true / false |
| attribution_text | 否 | 署名文本 | 视频素材来自 Pexels |
| file_path | 否 | 文件路径 | /path/to/file.mp3 |
| file_fingerprint | 否 | 文件指纹 | abc123... |
| notes | 否 | 备注 | 年付订阅 |

示例 CSV：
```csv
name,type,tags,license_source,allowed_platforms,commercial_allowed,expire_date,requires_attribution
欢快背景音乐 A,audio,欢快,积极,Epidemic Sound,抖音,小红书,true,2026-12-31,false
城市夜景 B-roll,video,城市,夜景,Pexels,抖音,小红书,true,,true
```

### 素材库 JSON 格式

```json
{
  "export_at": "2026-05-03T10:00:00.000Z",
  "count": 2,
  "materials": [
    {
      "id": "uuid-1",
      "name": "欢快背景音乐 A",
      "type": "audio",
      "tags": ["欢快", "积极"],
      "license_source": "Epidemic Sound",
      "allowed_platforms": ["抖音", "小红书"],
      "allowed_clients": [],
      "commercial_allowed": true,
      "expire_date": "2026-12-31",
      "requires_attribution": false,
      "attribution_text": null,
      "file_path": "/path/to/file.mp3",
      "file_fingerprint": null,
      "notes": "年付订阅"
    }
  ]
}
```

### 项目 JSON 格式（导入导出）

```json
{
  "version": "1.0",
  "export_at": "2026-05-03T10:00:00.000Z",
  "project": {
    "id": "uuid-project",
    "name": "某品牌 618 推广短视频",
    "client_name": "某品牌客户",
    "target_platforms": ["抖音", "小红书"],
    "description": "618年中大促产品推广视频",
    "status": "review"
  },
  "timelines": [
    {
      "id": "uuid-timeline",
      "project_id": "uuid-project",
      "material_id": "uuid-material",
      "material_name": "欢快背景音乐 A",
      "start_time": 0,
      "end_time": 60,
      "purpose": "全程背景音乐",
      "target_platform": "抖音",
      "client_name": "某品牌客户",
      "notes": ""
    }
  ],
  "materials": [
    {
      "id": "uuid-material",
      "name": "欢快背景音乐 A",
      "type": "audio",
      "license_source": "Epidemic Sound"
    }
  ]
}
```

## 项目结构

```
zy1057/
├── main/                    # Electron 主进程
│   ├── main.js             # 主进程入口
│   ├── preload.js          # 预加载脚本（IPC 通信）
│   ├── database.js         # 数据库操作（SQL.js）
│   └── sample-data.js      # 示例数据
├── src/                     # React 渲染进程
│   ├── pages/              # 页面组件
│   │   ├── MaterialsPage.jsx   # 素材库管理
│   │   ├── ProjectsPage.jsx    # 成片/项目管理
│   │   ├── RiskCheckPage.jsx   # 授权检查
│   │   └── ReportPage.jsx      # 报告中心
│   ├── services/           # 业务逻辑
│   │   ├── api.js              # API 封装（IPC 调用）
│   │   ├── rulesEngine.js      # 规则检查引擎
│   │   └── reportGenerator.js  # 报告生成器
│   ├── App.jsx             # 主应用组件
│   ├── main.jsx            # 入口文件
│   └── index.css           # 全局样式
├── package.json
├── vite.config.js
└── README.md
```

## 数据库设计

### materials 表（素材库）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | 主键 UUID |
| name | TEXT | 素材名称 |
| type | TEXT | 类型：audio/video/image/font |
| tags | TEXT | 标签（JSON 数组） |
| file_path | TEXT | 文件路径 |
| file_fingerprint | TEXT | 文件指纹 |
| license_source | TEXT | 授权来源 |
| allowed_platforms | TEXT | 可用平台（JSON 数组） |
| allowed_clients | TEXT | 允许客户（JSON 数组） |
| commercial_allowed | INTEGER | 允许商用（0/1） |
| expire_date | TEXT | 到期日（YYYY-MM-DD） |
| requires_attribution | INTEGER | 需要署名（0/1） |
| attribution_text | TEXT | 署名文本 |
| notes | TEXT | 备注 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### projects 表（项目）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | 主键 UUID |
| name | TEXT | 项目名称 |
| client_name | TEXT | 客户名称 |
| target_platforms | TEXT | 目标平台（JSON 数组） |
| description | TEXT | 项目描述 |
| status | TEXT | 状态：draft/in_progress/review/completed |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### timelines 表（时间轴片段）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | 主键 UUID |
| project_id | TEXT | 项目 ID（外键） |
| material_id | TEXT | 素材 ID（外键，可选） |
| material_name | TEXT | 素材名称 |
| start_time | INTEGER | 开始时间（秒） |
| end_time | INTEGER | 结束时间（秒） |
| purpose | TEXT | 用途 |
| target_platform | TEXT | 目标平台 |
| client_name | TEXT | 客户名称 |
| notes | TEXT | 备注 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

## 规则检查引擎说明

### 风险等级定义

| 等级 | 标识 | 颜色 | 说明 |
|-----|------|------|------|
| 严重 | critical | 🔴 红色 | 必须立即处理，否则有明确版权风险 |
| 高 | high | 🟠 橙色 | 建议尽快处理，存在较大风险 |
| 中 | medium | 🟡 黄色 | 建议处理，可能影响交付 |
| 低 | low | 🔵 蓝色 | 建议关注，暂不影响交付 |

### 风险类型与检查逻辑

#### 1. 平台不匹配 (platform_mismatch)
- **检查条件**：
  - 素材设置了 `allowed_platforms`（非空数组）
  - 时间轴片段设置了 `target_platform`
  - 目标平台不在允许列表中
- **风险等级**：严重 (critical)
- **处理建议**：更换为允许该平台的素材，或联系授权方确认

#### 2. 商用不允许 (commercial_not_allowed)
- **检查条件**：
  - 素材 `commercial_allowed` = false
  - 检查选项 `isCommercial` = true（默认）
- **风险等级**：严重 (critical)
- **处理建议**：更换为允许商用的素材，或获取商用授权

#### 3. 授权已过期 (license_expired)
- **检查条件**：
  - 素材设置了 `expire_date`
  - 当前日期 > 到期日
- **风险等级**：严重 (critical)
- **处理建议**：立即更换素材或联系授权方续期

#### 4. 授权即将过期 (license_expiring_soon)
- **检查条件**：
  - 素材设置了 `expire_date`
  - 0 天 ≤ 剩余天数 ≤ 14 天
- **风险等级**：高 (high)
- **处理建议**：提前规划素材替换，或联系授权方续期

#### 5. 客户超范围 (client_out_of_scope)
- **检查条件**：
  - 素材设置了 `allowed_clients`（非空数组）
  - 时间轴片段设置了 `client_name`
  - 当前客户不在允许列表中
- **风险等级**：高 (high)
- **处理建议**：更换为允许该客户使用的素材，或确认授权范围

#### 6. 缺少署名 (attribution_missing)
- **检查条件**：
  - 素材 `requires_attribution` = true
  - 检查选项 `attributionNotes` 中不包含该素材名称或署名文本
- **风险等级**：中 (medium)
- **处理建议**：在片尾或描述中补充素材来源署名

#### 7. 未知素材 (unknown_material)
- **检查条件**：
  - 时间轴片段 `material_id` 为空，或
  - `material_id` 对应的素材不存在于素材库中
- **风险等级**：高 (high)
- **处理建议**：在素材库中添加该素材的授权信息，或确认素材来源

## 常见问题

### Q: 数据存在哪里？可以迁移吗？
A: 数据存储在本地 SQLite 数据库文件中：
- macOS: `~/Library/Application Support/MediaLicenseChecker/media-license.db`
- Windows: `%APPDATA%\MediaLicenseChecker\media-license.db`
- Linux: `~/.local/share/MediaLicenseChecker/media-license.db`

可以直接复制该文件进行数据迁移。

### Q: 如何批量导入素材？
A: 有两种方式：
1. 准备好符合格式的 CSV/JSON 文件
2. 在「素材库管理」页面点击「导入」按钮
3. 选择文件格式并上传

导入时会有详细的错误提示，告诉你哪些行导入失败及原因。

### Q: 示例数据会覆盖现有数据吗？
A: 不会。「加载示例数据」是追加操作，不会删除或修改现有数据。

### Q: 如何自定义检查规则？
A: 检查规则在 `src/services/rulesEngine.js` 中定义。你可以修改以下函数来自定义：
- `checkPlatformMismatch` - 平台匹配检查
- `checkCommercialNotAllowed` - 商用检查
- `checkLicenseExpired` - 有效期检查
- `checkClientOutOfScope` - 客户范围检查
- `checkAttributionMissing` - 署名检查
- `checkUnknownMaterial` - 未知素材检查

### Q: 支持哪些平台？
A: 内置支持：抖音、小红书、B站、微信视频号、微博、快手、YouTube、其他。

你可以在各页面的 `PLATFORMS` 常量中添加更多平台。

## 更新日志

### v1.0.0 (2026-05-03)
- 初始版本发布
- 实现素材库管理（增删改查、CSV/JSON 导入导出）
- 实现项目管理与时间轴片段
- 实现 7 种授权规则检查
- 实现风险筛选、分组、处理建议
- 实现 Markdown/HTML 报告生成
- 实现本地 SQLite 数据持久化
- 添加示例数据功能
- 完整的用户界面与交互体验

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
