# 多语言文案发布台

一个用于管理多语言文案的完整系统，包含文案 Key 管理、翻译、审核、版本发布和覆盖率报告等功能。

## 功能特性

### 核心功能
- ✅ **文案 Key 管理**：新增、编辑、搜索文案 Key
- ✅ **语言包管理**：支持多语言包创建
- ✅ **翻译管理**：翻译编辑、人工修正
- ✅ **翻译比对**：候选翻译与现有翻译相似度比对
- ✅ **审核流程**：开始审核、审核通过/拒绝
- ✅ **占位符校验**：自动校验翻译中的占位符完整性
- ✅ **版本发布**：创建版本、发布版本
- ✅ **覆盖率报告**：翻译覆盖率统计、占位符错误统计
- ✅ **数据导出**：导出语言包为 JSON/CSV 格式

### 边界处理
- ✅ **幂等性保证**：防止重复点击、刷新导致状态混乱
- ✅ **状态锁**：审核状态变更的原子性保证
- ✅ **重新计算**：语言包变化后相关记录自动重新计算

## 技术栈

### 后端
- **框架**: FastAPI
- **数据库**: SQLAlchemy + SQLite
- **特性**: 幂等性校验、占位符验证、覆盖率统计

### 前端
- **框架**: Vue 3
- **UI组件**: Element Plus
- **路由**: Vue Router
- **HTTP客户端**: Axios

## 项目结构

```
i18n-platform/
├── backend/
│   ├── main.py              # FastAPI 入口
│   ├── models.py            # 数据库模型
│   ├── schemas.py           # Pydantic 模式
│   ├── database.py          # 数据库配置
│   ├── routers/             # API 路由
│   │   ├── translation.py   # 翻译管理API
│   │   ├── version.py       # 版本管理API
│   │   └── report.py        # 报告管理API
│   └── services/            # 业务服务
│       ├── placeholder_validator.py  # 占位符校验
│       ├── idempotency.py           # 幂等性服务
│       ├── translation_service.py    # 翻译服务
│       ├── version_service.py        # 版本服务
│       └── export_service.py         # 导出服务
└── frontend/
    ├── src/
    │   ├── main.js          # 入口文件
    │   ├── App.vue          # 根组件
    │   ├── router/          # 路由配置
    │   ├── api/             # API 封装
    │   └── views/           # 页面组件
    │       ├── Translation.vue  # 翻译管理
    │       ├── Version.vue      # 版本管理
    │       └── Report.vue       # 覆盖率报告
    └── package.json
```

## 快速开始

### 方式一：使用启动脚本（推荐）

```bash
chmod +x start.sh
./start.sh
```

### 方式二：手动启动

#### 启动后端服务

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

后端服务将在 http://localhost:8000 启动

API 文档地址: http://localhost:8000/docs

#### 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 http://localhost:3000 启动

## 使用指南

### 1. 创建语言包
1. 进入「翻译管理」页面
2. 点击「新增语言包」
3. 填写语言代码（如 `zh-CN`）和语言名称（如 `中文`）

### 2. 创建文案 Key
1. 进入「翻译管理」页面
2. 点击「新增文案 Key」
3. 填写 Key 名称、描述、默认值（英文）和占位符模式（可选）

### 3. 翻译管理
1. 在翻译列表中找到需要翻译的记录
2. 点击「编辑」按钮
3. 填写翻译内容和备注
4. 点击「保存修改」

### 4. 审核流程
1. 在翻译列表中点击「开始审核」
2. 状态变为「审核中」后点击「编辑」
3. 在编辑对话框中选择「审核通过」或「审核拒绝」

### 5. 翻译比对
1. 在翻译列表中点击「比对」按钮
2. 输入候选翻译
3. 点击「执行比对」查看相似度结果

### 6. 版本发布
1. 进入「版本管理」页面
2. 点击「新增版本」
3. 选择语言包、填写版本号和描述
4. 在版本列表中点击「发布版本」

### 7. 覆盖率报告
1. 进入「覆盖率报告」页面
2. 查看各版本的翻译覆盖率统计
3. 点击「导出语言包」下载翻译文件

## 数据模型

### LanguageKey (文案 Key)
- `id`: 主键
- `key`: 唯一标识
- `description`: 描述
- `default_value`: 默认值（英文）
- `placeholder_pattern`: 占位符正则模式

### LanguagePack (语言包)
- `id`: 主键
- `language_code`: 语言代码
- `language_name`: 语言名称
- `is_active`: 是否激活

### Translation (翻译记录)
- `id`: 主键
- `language_key_id`: 关联文案 Key
- `language_pack_id`: 关联语言包
- `translated_text`: 翻译文本
- `status`: 状态 (pending/matched/reviewing/approved/rejected/modified)
- `placeholder_valid`: 占位符校验是否通过
- `placeholder_errors`: 占位符错误信息
- `is_missing`: 是否缺失翻译

### VersionRelease (版本发布)
- `id`: 主键
- `version`: 版本号
- `language_pack_id`: 关联语言包
- `is_published`: 是否已发布
- `published_at`: 发布时间
- `published_by`: 发布人

### CoverageReport (覆盖率报告)
- `id`: 主键
- `version_release_id`: 关联版本
- `total_keys`: 总 Key 数
- `translated_keys`: 已翻译数
- `missing_keys`: 缺失数
- `coverage_rate`: 覆盖率 (%)
- `placeholder_error_count`: 占位符错误数

## API 接口

### 翻译管理
- `GET /api/translation/language-keys` - 获取文案 Key 列表
- `POST /api/translation/language-keys` - 创建文案 Key
- `PUT /api/translation/language-keys/{id}` - 更新文案 Key
- `GET /api/translation/language-packs` - 获取语言包列表
- `POST /api/translation/language-packs` - 创建语言包
- `GET /api/translation` - 获取翻译列表
- `PUT /api/translation/{id}` - 更新翻译
- `POST /api/translation/{id}/start-review` - 开始审核
- `POST /api/translation/{id}/review` - 审核翻译
- `POST /api/translation/compare` - 翻译比对
- `POST /api/translation/recalculate` - 重新计算占位符校验

### 版本管理
- `GET /api/version` - 获取版本列表
- `POST /api/version` - 创建版本
- `POST /api/version/{id}/publish` - 发布版本
- `POST /api/version/{id}/regenerate-report` - 重新生成报告

### 报告管理
- `GET /api/report` - 获取报告列表
- `POST /api/report/export` - 导出语言包

## 关键设计说明

### 幂等性处理
系统通过 `X-Idempotency-Key` 请求头实现幂等性，防止重复操作导致状态混乱。每次非 GET 请求都会自动生成唯一的幂等性 Key。

### 占位符校验
自动校验翻译文本中的占位符是否与原文一致，支持自定义正则模式。校验结果实时反馈到翻译列表中。

### 状态机
翻译状态流转：
```
pending (待处理) → reviewing (审核中) → approved (已通过) / rejected (已拒绝)
   ↓
modified (已修改)
```

### 覆盖率计算
版本发布时自动计算该语言包的翻译覆盖率，包括：
- 总 Key 数
- 已翻译 Key 数
- 缺失翻译数
- 占位符错误数
- 覆盖率百分比

## 注意事项

1. 首次启动时，数据库会自动创建
2. 新增文案 Key 时，会自动为所有已存在的语言包创建翻译记录
3. 新增语言包时，会自动为所有已存在的文案 Key 创建翻译记录
4. 语言包或文案 Key 更新后，点击「重新计算占位符」可批量重新校验
