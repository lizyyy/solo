# 社区食堂外卖评价分拣 CLI

专门用于社区食堂外卖评价数据的自动化分拣工具，解决临时备注传递导致的争议问题，确保分拣过程可追溯、可复现。

## 业务背景

社区食堂每天收到大量外卖评价，传统靠临时备注人工分拣的方式存在以下问题：
- 重复订单难以识别，导致统计不准确
- 空评分行容易被遗漏，影响投诉处理
- 过程不可追溯，出现争议无法还原
- 人工分拣效率低，容易出错

本工具专门解决以上问题。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 三步分拣流程

按照社区食堂真实工作流程操作：

#### 第一步：预览分拣结果（推荐先执行）

在正式输出前先查看统计数据，避免误操作：

```bash
npm run preview
```

预览模式下不会写入任何文件，只在控制台显示统计信息。

#### 第二步：正式执行分拣

确认预览无误后执行正式分拣：

```bash
npm run sort
```

或使用完整命令参数：
```bash
node src/cli.js -i ./input -o ./output -r ./rules.json
```

工具会自动：
- 识别并单独列出 **重复订单号**
- 识别并单独列出 **空评分行**（包括评分为空或为0）
- 按照规则文件对有效评价进行分类
- 每次运行生成独立的时间戳目录，支持**可复跑**

#### 第三步：查看最新报告

```bash
npm run report
```

## 目录结构

```
.
├── src/
│   ├── index.js          # 核心分拣逻辑
│   └── cli.js            # CLI 入口
├── input/                # 待分拣的评价文件（CSV格式）
│   ├── 2026-05-18_reviews.csv
│   └── 2026-05-19_reviews.csv
├── output/               # 分拣结果输出目录
│   ├── run_YYYY-MM-DDTHH-mm-ssZ/  # 每次运行的独立目录（可复跑）
│   │   ├── valid_reviews.csv       # 有效评价（未匹配任何规则）
│   │   ├── duplicate_orders.csv    # 重复订单号（单独列出）
│   │   ├── empty_rating_rows.csv   # 空评分行（单独列出）
│   │   ├── food_quality_positive_菜品质量-好评.csv
│   │   ├── food_quality_negative_菜品质量-差评.csv
│   │   ├── service_positive_服务-好评.csv
│   │   ├── complaint_投诉建议.csv
│   │   └── report.json
│   └── latest_report.json          # 最新报告快捷方式
├── rules.json            # 分拣规则配置
├── package.json
└── README.md
```

## 规则配置说明

编辑 `rules.json` 自定义分拣规则：

```json
{
  "fieldMapping": {
    "orderId": "订单号",       // 订单号字段（用于去重）
    "rating": "评分",           // 评分字段（用于检测空评分）
    "content": "评价内容"       // 评价内容字段（用于关键词匹配）
  },
  "categories": [
    {
      "id": "food_quality_positive",
      "name": "菜品质量-好评",
      "keywords": ["香", "好吃", "美味", "新鲜"]
    }
  ]
}
```

## CLI 参数说明

```
-i, --input <dir>    输入目录，默认 ./input
-o, --output <dir>   输出目录，默认 ./output
-r, --rules <file>   规则文件路径，默认 ./rules.json
-p, --preview        预览模式，不写入文件
--report             查看最新报告
```

## 样例说明

本项目已内置真实社区食堂外卖评价样例：

- `input/2026-05-18_reviews.csv` - 16条记录，包含3条重复订单，3条空评分
- `input/2026-05-19_reviews.csv` - 10条记录，包含1条重复订单，1条空评分

样例数据涵盖：
- 张阿姨、李大爷、刘奶奶等真实社区用户姓名
- 幸福社区食堂、阳光社区食堂、和谐社区食堂
- 红烧肉套餐、素菜双拼、包子等典型食堂菜品
- 重复订单号 ORD001、ORD006、ORD102
- 空评分行（评分0或空）

## 测试命令

直接运行以下命令即可体验完整流程：

```bash
# 1. 安装依赖
npm install

# 2. 预览
npm run preview

# 3. 正式分拣
npm run sort

# 4. 查看报告
npm run report
```

## 输出文件说明

### 重点关注文件（单独列出）

1. **duplicate_orders.csv** - 重复订单号
   - 包含 `duplicateReason` 字段说明重复原因
   - 用于排查订单系统问题

2. **empty_rating_rows.csv** - 空评分行
   - 包含 `emptyRatingReason` 字段说明原因
   - 用于跟进用户未评分情况

### 分类文件

- `food_quality_positive_菜品质量-好评.csv` - 菜品质量好评
- `food_quality_negative_菜品质量-差评.csv` - 菜品质量差评
- `service_positive_服务-好评.csv` - 服务好评
- `complaint_投诉建议.csv` - 投诉建议

### 报告文件

`report.json` 包含完整统计信息：
- 总记录数
- 有效记录数
- 重复订单数
- 空评分数
- 各分类数量统计
- 处理时间戳

## 可复跑特性

每次运行都会在 `output` 目录下创建一个新的时间戳命名的目录（如 `run_2026-05-19T12-00-00Z`），包含：
- 本次分拣的所有结果文件
- 本次分拣的完整报告

历史运行结果不会被覆盖，确保：
- 每次分拣都可追溯
- 出现争议时可以还原当时的分拣结果
- 可以对比不同时间的分拣数据

同时 `output/latest_report.json` 始终指向最新一次运行的报告。

## 许可证

MIT
