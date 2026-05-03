# 📦 仓库拣货路线预演工具

一个用于小网店和工作室的本地仓库拣货路线优化工具，帮助你可视化仓库布局、模拟拣货路线、识别堵点、生成优化报告。

## ✨ 功能特性

### 🗺️ 仓库布局管理
- **2D 平面图**：Canvas 渲染，支持缩放、拖拽平移
- **3D 立体视图**：CSS 3D 变换实现，直观查看货架布局
- **编辑模式**：可拖动调整货架和打包台位置
- **本地草稿**：自动保存布局修改，支持恢复

### 📊 数据导入与校验
- **多格式支持**：JSON (仓库布局)、CSV/Excel (SKU 和订单)
- **字段校验**：导入时自动检查必填字段、数据类型
- **错误提示**：清晰的错误信息，不会导致页面崩溃

### 🚚 拣货路线模拟
- **多算法支持**：
  - 最近邻算法 (Nearest Neighbor)
  - 聚类分区 (Cluster/Zoning)
  - S型路线 (S-Shape)
- **多人拣货**：支持 1-4 人同时拣货的路线分配
- **路线分析**：
  - 总行驶距离、人均距离
  - 折返距离、折返率
  - 转弯次数统计
  - 访问货架数量

### 🚦 堵点与优化分析
- **堵点识别**：
  - 通道通行次数统计
  - 拣货点访问冲突
  - 高/中风险等级标记
- **库存预警**：
  - 库存低于阈值提醒
  - 订单缺货/找不到货位提示
- **货位优化建议**：
  - 热销 SKU 移近打包台建议
  - 预计节省距离计算
  - 补货提醒

### 📄 报告导出
- **Markdown 格式**：适合版本控制和文档系统
- **HTML 格式**：带样式的美观报告
- **预览功能**：在页面内直接预览报告内容

## 🚀 快速开始

### 方式一：直接在浏览器打开
1. 下载或克隆项目到本地
2. 直接双击 `index.html` 在浏览器中打开
3. 点击顶部的 **"📂 加载示例数据"** 按钮即可看到演示效果

### 方式二：启动本地服务器（推荐）
使用 Python 3：
```bash
cd /path/to/project
python3 -m http.server 8080
```

然后在浏览器访问 `http://localhost:8080`

使用 Node.js：
```bash
npx http-server -p 8080
```

## 📁 数据格式说明

### 1. 仓库布局 (warehouse.json)
```json
{
  "name": "示例仓库",
  "dimensions": {
    "width": 12,
    "height": 8,
    "unit": "米"
  },
  "shelves": [
    {
      "id": "shelf-1",
      "name": "A区货架1",
      "x": 1,
      "y": 1,
      "width": 2,
      "depth": 0.8,
      "levels": 4,
      "orientation": "horizontal",
      "zone": "A"
    }
  ],
  "aisles": [
    {
      "id": "aisle-1",
      "name": "主通道",
      "x": 0,
      "y": 0,
      "width": 12,
      "depth": 0.8,
      "type": "main"
    }
  ],
  "packingStations": [
    {
      "id": "packing-1",
      "name": "主打包台",
      "x": 0.2,
      "y": 6.5,
      "width": 1.5,
      "depth": 1,
      "isPrimary": true
    }
  ],
  "pickStart": {
    "x": 0.5,
    "y": 7,
    "description": "拣货起点"
  }
}
```

### 2. SKU 货位 (sku-locations.csv)
| 字段 | 说明 | 必填 |
|------|------|------|
| sku_code | SKU 编码 | 是 |
| sku_name | SKU 名称 | 否 |
| shelf_id | 货架 ID | 是 |
| location | 货位编码 | 否 |
| quantity | 库存数量 | 是 |
| reorder_threshold | 补货阈值 | 是 |
| hot_rank | 热销排名 | 否 |

示例：
```csv
sku_code,sku_name,shelf_id,location,quantity,reorder_threshold,hot_rank
SKU001,iPhone 15 保护壳,shelf-1,A-01-01,120,20,1
SKU002,AirPods Pro 保护套,shelf-1,A-01-02,85,15,2
```

### 3. 订单数据 (orders.csv)
| 字段 | 说明 | 必填 |
|------|------|------|
| order_id | 订单编号 | 是 |
| customer_name | 客户名称 | 否 |
| order_date | 下单日期 | 否 |
| sku_code | SKU 编码 | 是 |
| quantity | 数量 | 是 |
| notes | 备注 | 否 |

示例：
```csv
order_id,customer_name,order_date,sku_code,quantity,notes
ORD20260501001,张三,2026-05-04,SKU001,2,加急订单
ORD20260501001,张三,2026-05-04,SKU003,1,
ORD20260501002,李四,2026-05-04,SKU002,1,
```

## 📖 使用说明

### 基本工作流
1. **加载数据**：
   - 点击"加载示例数据"快速体验
   - 或通过左侧导入区域上传自己的 JSON/CSV/Excel 文件

2. **选择订单**：
   - 在"订单选择"区域点击选择要处理的订单
   - 不选择则默认处理所有订单

3. **配置参数**：
   - 拣货员数量：1-4 人
   - 路线算法：最近邻、聚类分区、S型路线

4. **运行模拟**：
   - 点击"开始路线模拟"
   - 在 2D 平面图上查看路线（不同颜色代表不同拣货员）
   - 查看右侧面板的分析结果

5. **查看报告**：
   - 点击"预览报告"在页面内查看
   - 或导出 Markdown/HTML 格式保存

### 布局编辑
1. 点击"编辑模式"按钮进入编辑状态
2. 在 2D 平面图上拖动货架或打包台
3. 再次点击"保存编辑"退出
4. 使用"保存草稿"永久保存修改

### 视图操作
- **缩放**：鼠标滚轮或点击 🔍+/🔍- 按钮
- **重置**：点击 🔄 按钮恢复默认视图
- **切换视图**：2D 平面图 / 3D 立体图

## 🏗️ 项目结构
```
warehouse-picker-route/
├── index.html              # 主页面
├── package.json            # 项目配置
├── README.md               # 本文档
├── css/
│   └── style.css           # 样式文件
├── data/
│   ├── warehouse.json      # 示例仓库布局
│   ├── sku-locations.csv   # 示例 SKU 货位
│   └── orders.csv          # 示例订单
└── js/
    ├── app.js              # 主应用入口
    ├── models.js           # 数据模型
    ├── validator.js        # 数据校验器
    ├── importer.js         # 数据导入器
    ├── routePlanner.js     # 路线规划算法
    ├── renderer2d.js       # 2D 渲染器
    ├── reportGenerator.js  # 报告生成器
    └── storage.js          # 本地存储
```

## 🔧 技术栈
- **前端**：原生 HTML5 + CSS3 + JavaScript (ES6+)
- **绘图**：Canvas 2D API
- **3D 视图**：CSS 3D Transforms
- **Excel 解析**：SheetJS (xlsx) - CDN 加载
- **存储**：LocalStorage

## 📋 示例数据说明
项目自带一套完整的示例数据：

### 仓库布局
- 尺寸：12 米 × 8 米
- 货架：8 个，分 A/B/C 三个区域
- 通道：主通道 + 2 条横向通道 + 货架间通道
- 打包台：1 个主打包台 + 1 个辅助打包台

### SKU 数据
- 24 个 SKU，涵盖手机配件、数码配件等
- 热销排名：SKU001 (iPhone 保护壳) 排名第 1
- 部分 SKU 库存接近阈值，用于演示库存预警

### 订单数据
- 10 个订单，包含真实客户名称
- 部分订单包含多个 SKU
- 部分订单有备注信息（如"加急订单"）

## 🤝 贡献指南
欢迎提交 Issue 和 Pull Request！

## 📄 许可证
MIT License

---

**提示**：首次使用建议先点击"加载示例数据"体验完整功能，然后再尝试导入自己的数据。
