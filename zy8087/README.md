# 图书馆错架复原训练

一个本地浏览器小游戏，用于训练图书管理员在闭馆前快速将归还图书归架到正确位置。

## 功能特性

- 📚 **关卡加载**：支持从 JSON 文件加载自定义关卡
- 🎯 **规则判定**：
  - 分类号范围检查
  - 保留架判定
  - 预约图书优先级
- ❌ **错放扣分**：放置错误会扣分并给出原因
- ↩️ **撤销功能**：可以撤销上一步操作
- 💾 **本地存档**：自动保存游戏进度到 localStorage
- 📊 **结算导出**：游戏结束后导出 report.json 报告
- 🔤 **大小写处理**：自动处理分类号大小写混杂问题
- 🔄 **重复扫码防护**：防止同一本书重复归架

## 快速开始

### 方式一：直接预览（推荐）

直接用浏览器打开 `index.html` 文件即可开始游戏。

### 方式二：使用 npm 脚本

```bash
# 安装（可选，仅用于运行脚本）
npm install

# 启动本地服务器
npm run dev

# 然后在浏览器打开 http://localhost:8000
```

## 项目结构

```
.
├── index.html      # 主页面
├── style.css       # 样式文件
├── app.js          # 游戏逻辑
├── level.json      # 示例关卡
├── package.json    # 项目配置
├── test.js         # 测试脚本
└── README.md       # 说明文档
```

## 关卡数据格式

参考 `level.json` 定义自己的关卡：

```json
{
  "levelId": "level-1",
  "levelName": "初级训练",
  "maxSteps": 10,
  "floor": 1,
  "books": [
    {
      "id": "book-001",
      "title": "JavaScript高级程序设计",
      "callNumber": "TP312/JA1",
      "isReserved": false,
      "reservePriority": 0
    }
  ],
  "shelves": [
    {
      "id": "shelf-001",
      "label": "A区01架",
      "callNumberRange": {
        "start": "TP3",
        "end": "TP309"
      },
      "isReserveShelf": false,
      "slots": [
        { "id": "slot-001", "bookId": null }
      ]
    }
  ]
}
```

## 游戏规则

1. 从归还车（左侧）拖拽图书到书架（右侧）的空位上
2. 每放置一本书消耗 1 步
3. 初始分数为 100 分
4. 错放会扣分：
   - 分类号不在范围内：扣 20 分
   - 预约图书未放保留架：扣 15 分
   - 非预约图书放保留架：扣 10 分
5. 点击「完成结算」结束游戏并导出报告

## 测试

```bash
npm test
```

这将运行核心逻辑的最小测试，验证分类号处理、验证规则等功能。

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

需要支持 HTML5 Drag & Drop API 和 localStorage。
