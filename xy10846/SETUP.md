# 文档切片策略台 - 完整安装验证指南

## 📋 问题定位

### 当前状态
- ✅ 代码逻辑完整（server, public, database）
- ✅ package.json 依赖配置正确
- ❌ node_modules 不存在（依赖未安装）
- ❌ 无法执行 `npm start` 启动服务

### 解决步骤

---

## 🔧 第一步：安装依赖

### 方法1：标准安装（推荐）
```bash
cd /Users/mac/pro/solo/workspaces/xy10846
npm install
```

### 方法2：国内镜像加速（如果网络慢）
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### 方法3：手动创建 package-lock（备用）
如果 npm install 卡住：
```bash
# 清理缓存
npm cache clean --force

# 删除可能存在的锁文件
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

---

## ✅ 第二步：验证依赖安装

```bash
# 检查依赖是否安装成功
npm ls --depth=0

# 预期输出（无 missing/unmet）：
# doc-slicing-strategy-console@1.0.0
# ├── better-sqlite3@9.2.2
# ├── body-parser@1.20.2
# ├── cors@2.8.5
# └── express@4.18.2
```

---

## 🚀 第三步：启动服务

```bash
# 启动服务（前台运行）
npm start

# 预期输出：
# ========================================
#   文档切片策略台 启动成功!
#   服务地址: http://localhost:3000
#   API文档: http://localhost:3000/api/health
# ========================================
```

服务启动后保持终端窗口打开，不要关闭。

---

## 🌐 第四步：前端验证

### 浏览器访问
打开浏览器访问：http://localhost:3000

### 前端功能验证流程
1. **文档管理标签页**
   - 点击"新建文档"
   - 填写标题：`产品对比文档`
   - 填写内容（包含表格）：
     ```markdown
     # 产品文档
     
     ## 产品对比
     
     | 产品名称 | 版本 | 价格 | 特性 |
     |---------|------|------|------|
     | 基础版 | v1.0 | 99元 | 核心功能 |
     | 专业版 | v2.0 | 199元 | 全部功能 |
     | 企业版 | v3.0 | 499元 | 定制开发 |
     
     ## 功能说明
     本系统提供表格保留功能。
     ```
   - 责任节点：`knowledge-team`
   - 点击创建，确认成功提示

2. **切片规则标签页**
   - 点击"新建规则"
   - 规则名称：`表格保留规则`
   - 最大切片长度：`500`
   - 勾选"继承标题路径"和"保留表格结构"
   - 效果备注：`测试表格提取`
   - 点击创建，确认成功提示

3. **切片预览标签页（核心验证）**
   - 文档选择：选择刚创建的文档
   - 规则选择：选择刚创建的规则
   - 点击"生成切片预览"
   - ✅ **验证点1**：看到 `📊 提取到的表格` 区域显示表格
   - ✅ **验证点2**：看到 `📄 切片列表` 区域显示切片
   - ✅ **验证点3**：切片中有 `含表格` 橙色标签

4. **版本发布标签页**
   - 选择规则，点击"发布新版本"
   - 版本标签：`v1.0.0-table`
   - 点击发布，确认成功提示

5. **请求日志标签页**
   - 查看所有请求记录
   - ✅ **验证点4**：责任节点列显示之前设置的 `knowledge-team`
   - ✅ **验证点5**：可以看到每个API的输入、输出、耗时

---

## 🔌 第五步：API 验证

打开新的终端窗口，执行测试脚本：

```bash
cd /Users/mac/pro/solo/workspaces/xy10846
bash test-api.sh
```

### 核心API验证点

| API 端点 | 方法 | 验证内容 |
|---------|------|---------|
| `/api/documents` | POST | 创建含表格的文档成功 |
| `/api/rules` | POST | 创建切片规则成功 |
| `/api/previews/generate` | POST | 生成切片，返回 `tables_count` |
| `/api/previews/tables/:docId/:ruleId` | GET | 返回提取的表格片段 |
| `/api/export/logs` | GET | 包含责任节点记录 |
| `/api/versions/publish` | POST | 版本发布成功 |
| `/api/documents/99999` | GET | 正确返回 404 错误 |

---

## 📊 数据库验证（可选进阶）

如需直接查看数据库内容：

```bash
# 安装 sqlite3 客户端（如果有 brew）
brew install sqlite3

# 进入数据库目录
cd data

# 查看所有表
sqlite3 app.db ".tables"

# 查看表格片段（核心验证）
sqlite3 app.db "SELECT * FROM table_fragments;"

# 查看请求日志
sqlite3 app.db "SELECT endpoint, method, responsibility_node FROM request_logs LIMIT 10;"
```

预期会看到 table_fragments 表中有从文档中提取的表格记录。

---

## ❌ 故障排除

### 问题1：npm install 超时或卡住
```bash
# 使用淘宝镜像
npm install --registry=https://registry.npmmirror.com

# 或单独安装失败的包
npm install better-sqlite3 --build-from-source
```

### 问题2：端口 3000 被占用
```bash
# 查找占用进程
lsof -i :3000

# 杀死进程（替换 PID）
kill -9 PID
```

### 问题3：better-sqlite3 编译失败
```bash
# MacOS 需要安装 XCode 命令行工具
xcode-select --install

# 然后重新安装
npm rebuild better-sqlite3
```

### 问题4：表格未提取
检查：
1. 文档内容中的 Markdown 表格格式是否正确
2. 表格正则是否匹配（`| 表头 | ... |` 格式）
3. 浏览器控制台有无 JavaScript 错误

---

## ✅ 完整验证清单

执行完以上步骤后，确认以下全部完成：

- [ ] `npm install` 执行成功，无错误
- [ ] `npm ls --depth=0` 显示 4 个依赖都已安装
- [ ] `npm start` 启动成功，监听 3000 端口
- [ ] 浏览器访问 http://localhost:3000 能打开控制台
- [ ] 前端可以创建含表格的文档
- [ ] 前端可以创建切片规则
- [ ] 生成切片预览后能看到提取的表格
- [ ] 能看到切片的 has_table 标记
- [ ] 请求日志中记录了责任节点
- [ ] `bash test-api.sh` 所有成功案例返回 200/201
- [ ] 故意失败的案例返回正确的 400/404 错误码

---

## 🎯 快速验证命令（3条命令）

如果环境没问题，可以直接一条龙验证：

```bash
# 1. 安装依赖
npm install

# 2. 启动服务（另开终端）
npm start

# 3. 运行测试（另开终端）
bash test-api.sh
```

---

**所有步骤完成后，即成功验证了：**
1. ✅ 依赖安装正确
2. ✅ 服务正常启动
3. ✅ 前端控制台可用
4. ✅ 表格提取功能完整
5. ✅ 请求日志持久化
6. ✅ 异常处理正确
