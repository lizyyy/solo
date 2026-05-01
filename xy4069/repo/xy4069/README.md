# 离线协作冲突回放器

一个用于复盘多人弱网编辑问题的本地工具。通过回放各端的操作日志，可视化展示文本变化、光标移动、撤销/重做、重连合并等操作，帮助产品经理定位冲突发生的根本原因。

## 功能特性

### 📋 日志解析与校验
- **多文件导入**: 支持同时导入多个用户的操作日志 JSON
- **字段校验**: 自动检测缺失的必填字段
- **重复ID检测**: 识别重复的 operationId
- **版本跳跃检测**: 检测用户版本号不连续的问题
- **乱序检测**: 检查时间戳是否符合预期顺序

### 🔄 协同模型 (简化 CRDT/OT)
- **INSERT**: 文本插入操作
- **DELETE**: 文本删除操作
- **CURSOR_MOVE**: 光标移动
- **UNDO/REDO**: 撤销/重做
- **RECONNECT**: 重连处理
- **MERGE**: 远程操作合并

### 🎮 回放控制
- **播放/暂停**: 自动按时间轴播放操作序列
- **单步控制**: 前进/后退一步
- **跳转**: 跳转到开始/结束，或点击时间轴任意位置
- **速度调节**: 0.5x、1x、2x、5x 播放速度
- **用户视角切换**: 查看特定用户的操作或全部用户

### 📊 可视化与分析
- **实时文档显示**: 动态展示文本变化
- **冲突标记**: 时间轴上用红色标记冲突点
- **操作详情**: 显示当前操作的完整元数据
- **统计面板**: 总操作数、有效/无效数、唯一用户数
- **隔离清单**: 列出所有被隔离的无效操作

### 📤 导出功能
- **Markdown 复盘报告**: 包含统计、冲突详情、隔离清单、操作时序
- **JSON 结果**: 完整的最终状态、冲突列表、所有操作数据

## 项目结构

```
xy4069/
├── src/
│   ├── core/                    # 核心模块
│   │   ├── index.js             # 模块导出
│   │   ├── logParser.js         # 日志解析与校验
│   │   ├── collabModel.js       # CRDT/OT 协同模型
│   │   ├── playbackState.js     # 回放状态管理器
│   │   └── exporter.js          # 导出模块
│   ├── public/                  # Web 界面
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app.js
│   └── server.js                # 本地服务器
├── examples/
│   └── sample-logs.json         # 示例日志数据
├── tests/
│   └── core.test.js             # 单元测试
└── package.json
```

## 快速开始

### 环境要求
- Node.js >= 18.0.0

### 安装与运行

1. **进入项目目录**
   ```bash
   cd /Users/mac/pro/solocoder/pro/xy4069/repo/xy4069
   ```

2. **启动本地服务器**
   ```bash
   npm start
   ```

3. **访问应用**
   
   打开浏览器访问: http://localhost:3000

### 本地验证流程

#### 方式一: 使用示例数据
1. 点击页面顶部的 **"加载示例数据"** 按钮
2. 系统将自动加载预设的示例日志（包含正常操作、冲突场景和无效操作）
3. 观察左侧面板的统计信息、冲突列表和隔离清单
4. 使用时间轴控制播放操作序列

#### 方式二: 导入自己的日志文件
1. 点击 **"导入日志文件"** 按钮
2. 选择一个或多个 JSON 格式的操作日志文件
3. 系统将自动解析并校验
4. 开始回放分析

#### 验证功能点

1. **日志解析校验**
   - 检查统计面板显示的总操作数、有效/无效数
   - 查看隔离清单中是否列出了无效操作
   - 确认校验错误信息是否正确

2. **回放控制**
   - 点击播放按钮，观察文档是否按顺序变化
   - 测试单步前进/后退功能
   - 尝试跳转到时间轴的不同位置
   - 切换播放速度，观察是否生效

3. **冲突检测**
   - 观察时间轴上的红色冲突标记
   - 点击冲突项，跳转到对应的操作步骤
   - 查看操作详情面板，了解冲突原因

4. **用户视角切换**
   - 在用户视角面板切换不同用户
   - 确认仅显示所选用户的相关操作
   - 查看光标位置显示

5. **导出功能**
   - 点击 **"导出 Markdown 复盘"**，下载并检查报告内容
   - 点击 **"导出 JSON 结果"**，下载并验证 JSON 结构

### 运行测试

```bash
npm test
```

测试覆盖以下模块:
- `LogParser`: 日志解析与校验逻辑
- `CRDTTextModel`: 协同模型操作
- `PlaybackState`: 回放状态管理
- `Exporter`: 导出功能

## 操作日志格式

### 必需字段

| 字段 | 类型 | 说明 |
|------|------|------|
| operationId | string | 唯一操作标识符 |
| userId | string | 用户标识符 |
| timestamp | string/number | ISO 格式字符串或毫秒时间戳 |
| version | number | 用户本地版本号（非负整数） |
| type | string | 操作类型 |
| payload | object | 操作具体内容 |

### 操作类型及 Payload

#### INSERT (文本插入)
```json
{
  "type": "INSERT",
  "payload": {
    "position": 0,
    "text": "要插入的文本"
  }
}
```

#### DELETE (文本删除)
```json
{
  "type": "DELETE",
  "payload": {
    "position": 5,
    "length": 3,
    "direction": "forward"
  }
}
```

#### CURSOR_MOVE (光标移动)
```json
{
  "type": "CURSOR_MOVE",
  "payload": {
    "position": 10,
    "selectionStart": 5,
    "selectionEnd": 10
  }
}
```

#### UNDO/REDO (撤销/重做)
```json
{
  "type": "UNDO",
  "payload": {}
}
```

#### RECONNECT (重连)
```json
{
  "type": "RECONNECT",
  "payload": {
    "lastKnownVersion": 5,
    "pendingOperations": []
  }
}
```

#### MERGE (合并远程操作)
```json
{
  "type": "MERGE",
  "payload": {
    "baseVersion": 3,
    "remoteOperations": [
      {
        "operationId": "remote-001",
        "type": "INSERT",
        "payload": {
          "position": 0,
          "text": "远程插入的文本"
        }
      }
    ]
  }
}
```

### 示例日志

参考 `examples/sample-logs.json` 中的完整示例，包含:
- 正常的文本插入和删除
- 光标移动
- 撤销操作
- 重连场景
- 合并操作
- 故意设计的冲突场景（用于测试校验功能）

## 核心 API

### LogParser (日志解析器)

```javascript
import { LogParser } from './core/index.js';

const parser = new LogParser();
const result = parser.parse(rawLogs);

// result.operations     - 有效操作列表
// result.validationErrors - 校验错误
// result.isolationList  - 隔离的无效操作
// result.stats          - 统计信息
```

### CRDTTextModel (协同模型)

```javascript
import { CRDTTextModel } from './core/index.js';

const model = new CRDTTextModel();
const result = model.applyOperation(operation);

// result.success        - 是否成功
// result.conflicts      - 冲突列表
// model.getDocument()   - 获取当前文档
// model.getConflicts()  - 获取所有冲突
// model.reset()         - 重置模型
```

### PlaybackState (回放状态)

```javascript
import { PlaybackState } from './core/index.js';

const playback = new PlaybackState();
playback.loadOperations(operations);

playback.play(1);           // 以 1x 速度播放
playback.pause();            // 暂停
playback.stepForward();      // 前进一步
playback.stepBackward();     // 后退一步
playback.goToIndex(5);       // 跳转到第 5 步
playback.setActiveUserId('user-a'); // 切换用户视角
playback.getState();         // 获取当前状态
```

### Exporter (导出器)

```javascript
import { Exporter } from './core/index.js';

// 导出 Markdown 复盘报告
const markdown = Exporter.exportMarkdown(state, parserResult);

// 导出 JSON 结果
const jsonResult = Exporter.exportJSON(state, parserResult);
```

## 常见问题

### Q: 为什么有些操作被隔离了？
操作可能因为以下原因被隔离:
- 缺少必需字段（operationId、userId、timestamp 等）
- 重复的 operationId
- 无效的版本号（负数或非整数）
- 无效的操作类型

### Q: 冲突和隔离有什么区别？
- **隔离**: 日志解析阶段发现的格式错误，操作根本不会被回放
- **冲突**: 操作格式正确，但在协同模型应用时发现的逻辑问题（如位置越界、合并冲突等）

### Q: 支持哪些操作类型？
目前支持: INSERT、DELETE、CURSOR_MOVE、UNDO、REDO、RECONNECT、MERGE

### Q: 如何实现自己的协同模型？
可以继承或替换 `CRDTTextModel` 类，实现自定义的 `applyOperation` 方法来处理操作。

## 许可证

MIT
