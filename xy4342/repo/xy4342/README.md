# 🎬 分镜连续性检查台

为独立漫画工作室设计的本地分镜连续性检查工具。主笔可以导入分镜 CSV、角色设定 JSON、对白稿和草图路径，系统会自动检查角色服装、道具、时间线和对白称呼的前后一致性。

## ✨ 功能特性

### 📥 数据导入
- **分镜 CSV**: 支持多列名映射（中文/英文）
- **角色设定 JSON**: 支持别名、服装变种、默认道具
- **对白稿文本**: 支持【第X格】标记格数，自动解析说话者和称呼对象
- **草图上传**: 支持单格草图上传和关联

### 🔍 规则校验引擎
- **服装一致性检查**: 同一角色在不同格数中的服装变化检测
- **道具一致性检查**: 道具持有者变化、默认道具缺失检测
- **时间线连续性检查**: 时间段倒退、格数不连续检测
- **称呼一致性检查**: 同一角色不同称呼方式检测

### 💬 轻量文本相似度
- 余弦相似度 + Jaccard 相似度双算法
- 中文分词支持（双字/单字）
- 对白重复检测、动作相似检测

### 📋 问题管理
- **按章节查看**: 按章节组织显示问题
- **逐条改判**: 支持标记为确认/忽略/已修复
- **复核意见**: 支持添加复核记录和决定
- **批量操作**: 支持多选批量更新状态

### 📤 导出功能
- **Markdown 连续性报告**: 完整报告，包含概览、统计、问题详情、复核记录
- **CSV 问题清单**: 结构化表格，便于 Excel 分析
- **JSON 审计包**: 完整数据快照，含章节、角色、问题、复核记录

## 🛠️ 技术栈

### 后端
- **框架**: FastAPI (Python)
- **数据库**: SQLite + SQLAlchemy
- **特点**: 零配置、单文件数据库、本地持久化

### 前端
- **框架**: Vue 3 + Vite
- **路由**: Vue Router 4
- **状态管理**: Pinia
- **HTTP 客户端**: Axios

## 🚀 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+ (推荐使用 18+)
- npm 或 yarn

### 后端启动

1. **进入后端目录**
```bash
cd backend
```

2. **创建虚拟环境**
```bash
python -m venv venv
```

3. **激活虚拟环境**
```bash
# macOS/Linux
source venv/bin/activate

# Windows PowerShell
.\venv\Scripts\Activate.ps1
```

4. **安装依赖**
```bash
pip install -r requirements.txt
```

5. **启动后端服务**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端服务将在 `http://localhost:8000` 启动

6. **API 文档** (可选)
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 前端启动

1. **进入前端目录**
```bash
cd frontend
```

2. **安装依赖**
```bash
npm install
```

3. **启动开发服务器**
```bash
npm run dev
```

前端将在 `http://localhost:5173` 启动

## 📊 示例数据验证流程

项目提供了一套预设的示例数据，包含故意设计的连续性问题，用于验证系统功能。

### 示例数据位置
```
samples/
├── storyboard_ch1.csv    # 分镜表（含故意设计的问题）
├── characters.json       # 角色设定
└── dialogues_ch1.txt     # 对白稿
```

### 示例数据中的预设问题

#### 1. 服装不一致
- 第4格中，李明穿的是「休闲西装」，但角色设定的默认服装是「休闲外套、牛仔裤」
- 系统将检测到这个变化并生成问题

#### 2. 时间线倒退
- 第5格时间是「下午」，第6格时间是「中午」
- 时间从下午倒退到中午，系统将检测到时间线异常

#### 3. 称呼不一致
- 第8格中，角色被称呼为「小明」
- 但角色设定中，「小明」是「李明」的别名
- 系统将检测到同一角色的不同称呼方式

### 验证步骤

1. **启动服务**
   - 确认后端运行在 `http://localhost:8000`
   - 确认前端运行在 `http://localhost:5173`

2. **导入角色设定**
   - 打开前端，进入「导入数据」页面
   - 在「角色设定 JSON」区域点击「选择文件」
   - 选择 `samples/characters.json`
   - 点击「导入角色」
   - 看到「成功导入 2 个角色设定」提示即为成功

3. **导入分镜表**
   - 在「分镜 CSV」区域设置章节号为 `1`
   - 章节标题可填写「第一章 相遇」
   - 点击「选择文件」，选择 `samples/storyboard_ch1.csv`
   - 点击「导入分镜」
   - 看到「成功导入 8 格分镜」提示即为成功

4. **导入对白稿**
   - 在「对白稿」区域设置章节号为 `1`
   - 点击「选择文件」，选择 `samples/dialogues_ch1.txt`
   - 点击「导入对白」
   - 看到「成功导入 X 条对白」提示即为成功

5. **运行连续性检查**
   - 点击页面底部的「🔍 开始连续性检查」按钮
   - 等待检查完成
   - 系统会自动跳转到「问题列表」页面

6. **查看检测到的问题**
   - 在「问题列表」页面应该能看到以下问题：
     - 🔴 角色「李明」服装不一致 (第1格 vs 第4格)
     - 🟠 时间线倒退 (下午 → 中午)
     - 🟡 说话者「李明」称呼不一致 (李明, 小明, 李明远)

7. **按章节查看**
   - 切换到「章节查看」页面
   - 点击「第1章」标签
   - 查看每一格的详细信息，包括出场角色、服装、道具、动作、对白
   - 注意有问题的格子会显示「相关问题」提示

8. **改判问题**
   - 回到「问题列表」页面
   - 点击任意问题的「展开详情 ▼」
   - 可以看到问题的详细描述、影响格数、置信度
   - 点击下方的「✓ 确认问题」、「✗ 忽略」或「✓ 已修复」按钮
   - 状态会立即更新

9. **添加复核意见**
   - 在问题详情的「复核记录」区域
   - 选择「复核决定」（如「确认是问题」）
   - 输入「复核意见」（如「确实应该是休闲外套，这里画错了」）
   - 点击「提交复核」
   - 复核记录会显示在上方

10. **批量操作**
    - 勾选多个问题左侧的复选框
    - 页面顶部会出现批量操作栏
    - 可以批量标记为「已确认」、「已忽略」或「已修复」

11. **导出报告**
    - 切换到「导出报告」页面
    - 可以选择筛选条件（包含哪些状态、哪些类别的问题）
    - 点击三种导出方式：
      - **导出 Markdown**: 生成完整的连续性报告，可直接查看或存档
      - **导出 CSV**: 生成问题清单表格，可在 Excel 中打开分析
      - **导出 JSON**: 生成完整的审计数据包，含所有信息

## 📁 项目结构

```
xy4342/
├── backend/                    # 后端目录
│   ├── app/
│   │   ├── routers/           # 路由模块
│   │   │   ├── __init__.py
│   │   │   ├── import_router.py      # 导入路由
│   │   │   ├── validate_router.py    # 校验路由
│   │   │   ├── review_router.py      # 复核路由
│   │   │   ├── export_router.py      # 导出路由
│   │   │   └── data_router.py        # 数据管理路由
│   │   ├── services/          # 业务逻辑
│   │   │   ├── __init__.py
│   │   │   ├── validator.py          # 规则校验引擎
│   │   │   └── similarity.py         # 文本相似度检测
│   │   ├── __init__.py
│   │   ├── database.py               # 数据库配置
│   │   ├── main.py                   # 应用入口
│   │   ├── models.py                 # 数据模型
│   │   └── schemas.py                # Pydantic 模型
│   ├── data/                  # SQLite 数据库目录 (自动生成)
│   ├── uploads/               # 上传文件目录 (自动生成)
│   └── requirements.txt        # Python 依赖
│
├── frontend/                   # 前端目录
│   ├── src/
│   │   ├── views/             # 页面视图
│   │   │   ├── ImportView.vue         # 导入页面
│   │   │   ├── IssuesView.vue         # 问题列表
│   │   │   ├── ChaptersView.vue       # 章节查看
│   │   │   └── ExportView.vue         # 导出页面
│   │   ├── router/
│   │   │   └── index.js               # 路由配置
│   │   ├── api/
│   │   │   └── index.js               # API 封装
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── samples/                    # 示例数据
│   ├── storyboard_ch1.csv
│   ├── characters.json
│   └── dialogues_ch1.txt
│
└── README.md
```

## 📋 数据格式说明

### 分镜 CSV 格式

支持中英文列名：

| 英文列名 | 中文列名 | 说明 |
|---------|---------|------|
| panel_number | 格数 | 分镜格序号 (必填) |
| page_number | 页数 | 所在页码 |
| time_of_day | 时间段 | 如：上午、下午、晚上 |
| location | 场景 | 地点描述 |
| characters_present | 出场角色 | 角色名，多角色用顿号分隔 |
| costumes | 服装 | 角色服装描述 |
| props | 道具 | 出场道具 |
| action | 动作 | 角色动作描述 |
| sketch_path | 草图路径 | 关联的草图文件路径 |
| notes | 备注 | 其他备注 |

示例：
```csv
panel_number,page_number,time_of_day,location,characters_present,costumes,props,action
1,1,上午,咖啡馆门口,李明,休闲外套、牛仔裤,咖啡杯,站在门口张望
```

### 角色设定 JSON 格式

```json
[
  {
    "name": "角色名",
    "full_name": "全名",
    "aliases": ["别名1", "别名2"],
    "costume_default": ["默认服装1", "默认服装2"],
    "costume_variants": {
      "场景名": ["服装1", "服装2"]
    },
    "props_default": ["默认道具1", "默认道具2"],
    "description": "角色描述"
  }
]
```

### 对白稿格式

```
【第1格】
角色名: 对白内容

【第2格】
角色名对对象说: 对白内容
对象: 回应内容
```

- `【第X格】` 用于标记格数（可选）
- `角色名: 内容` 基础格式
- `角色名对XX说: 内容` 自动解析称呼对象

## 🔧 配置说明

### 后端配置

数据库和上传目录在 `backend/app/database.py` 中定义：

```python
# 数据库文件位置
DATA_DIR = os.path.join(BASE_DIR, "data")

# 上传文件目录
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

# 草图目录
SKETCHES_DIR = os.path.join(UPLOAD_DIR, "sketches")
```

### 前端代理配置

在 `frontend/vite.config.js` 中配置代理：

```javascript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true
    }
  }
}
```

## 🐛 常见问题

### Q: 后端启动失败，提示模块不存在？
A: 请确认已激活虚拟环境并安装了依赖：
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Q: 前端无法连接后端？
A: 请确认：
1. 后端已在 `http://localhost:8000` 启动
2. 可以访问 `http://localhost:8000/docs` 查看 API 文档
3. 前端代理配置正确

### Q: 导入 CSV 时提示格式错误？
A: 请确认：
1. CSV 文件是 UTF-8 编码（建议用 Excel 另存为 CSV UTF-8）
2. 包含必需的 `panel_number` 或 `格数` 列
3. 格数是数字格式

### Q: 检查后没有发现问题？
A: 可能是数据过于完美（无连续性问题），请使用示例数据测试：
1. 示例数据中包含故意设计的问题
2. 运行检查后应该能看到 3-5 个问题

## 📄 许可证

本项目仅供学习和内部使用。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。
