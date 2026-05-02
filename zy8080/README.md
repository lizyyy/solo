# 印刷拼版排版检查器

帮助小型印刷店在发版前预览和验证拼版方案的工具。

## 功能特性

- 📄 导入 `job.json` 配置文件（包含成品尺寸、出血、纸张、数量）
- 📋 导入 `rules.yaml` 规则配置文件
- 🎨 实时预览纸张上的拼版布局
- 🖱️ 支持拖拽调整作品位置
- 🔄 支持旋转作品（90° 增量）
- ✅ 自动计算和检测：
  - 出血区域
  - 安全边距
  - 作品旋转
  - 纸张浪费率
  - 作品重叠
- 📤 导出 `imposition_plan.json` 和 `preflight.md`

## 技术栈

- TypeScript
- Vite
- Canvas API
- js-yaml

## 安装与运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm test
```

## 使用方法

### 1. 准备配置文件

#### job.json 格式

```json
{
  "id": "job_20240115_001",
  "name": "名片印刷订单",
  "paper": {
    "name": "A4 铜版纸",
    "width": "210mm",
    "height": "297mm"
  },
  "bleed": "3mm",
  "safeMargin": "5mm",
  "workpieces": [
    {
      "id": "wp_001",
      "name": "张三名片-正面",
      "width": "90mm",
      "height": "54mm",
      "rotation": 0,
      "copies": 500
    }
  ]
}
```

#### rules.yaml 格式

```yaml
rules:
  - id: bleed_min
    name: 最小出血
    type: bleed
    min: 3
    required: true
    message: 出血不足可能导致切边问题
  
  - id: safe_min
    name: 最小安全边距
    type: safeMargin
    min: 5
    required: true
    message: 安全边距不足可能导致内容被裁切
```

### 2. 单位支持

支持以下单位的混合使用：

- `mm` - 毫米（默认）
- `in` - 英寸（1in = 25.4mm）
- `pt` - 点（1pt = 1/72in）

### 3. 界面操作

- **拖拽**：点击作品后拖拽调整位置
- **缩放**：滚轮缩放视图
- **旋转**：选中作品后点击旋转按钮
- **显示选项**：勾选/取消显示出血区域、安全边距、网格、标签

## 项目结构

```
├── src/
│   ├── types/           # 类型定义
│   ├── parser/          # 解析校验模块
│   │   ├── index.ts     # JSON/YAML 解析
│   │   └── unit.ts      # 单位转换
│   ├── geometry/        # 几何计算模块
│   ├── renderer/        # 画布渲染模块
│   ├── interactive/     # 交互状态模块
│   ├── exporter/        # 导出模块
│   └── app.ts           # 主应用
├── data/                # 示例数据
│   ├── sample.job.json
│   └── sample.rules.yaml
├── index.html           # 主页面
└── package.json
```

## 边界情况处理

1. **毫米/英寸混用**：自动统一转换为毫米进行计算
2. **作品超出安全线**：自动检测并标记警告
3. **作品超出纸张边界**：自动检测并标记错误
4. **作品重叠**：自动检测并标记错误
5. **纸张浪费过高**：超过 30% 时标记警告

## 导出文件格式

### imposition_plan.json

包含拼版布局的完整信息，便于后续生产流程使用。

### preflight.md

预检报告，包含：
- 作业基本信息
- 作品列表
- 错误和警告详情
- 纸张利用率统计

## License

MIT
