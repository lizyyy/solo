# 电子卷宗归档验收工作台

一个专为法院书记员设计的本地电子卷宗归档验收工具，用于在归档前对电子卷宗进行自动化校验。

## 功能特性

- **多格式文件导入**：支持导入 case_manifest.json、documents.csv、ocr_text.jsonl、signature_log.jsonl 和 archive_rules.yaml
- **自动化校验**：
  - 必备材料检查
  - 页码连续性校验
  - 案号/文书类型匹配检查
  - 电子签名有效期校验
  - 密级脱敏检查
- **边界处理**：
  - 重复文号检测
  - 跨年度案号提醒
- **可视化展示**：
  - 案件/材料树视图
  - 风险分级展示（高/中/低风险）
  - 统计信息汇总
- **人工确认与导出**：
  - 风险人工确认
  - 导出 review_report.md 审查报告
  - 导出 issues.csv 问题清单

## 技术栈

### 后端
- Node.js + Express
- Multer（文件上传）
- csv-parser（CSV解析）
- yaml（YAML解析）
- moment（日期处理）

### 前端
- React 18
- Vite
- Ant Design
- Axios

## 项目结构

```
e-archive-validation-workbench/
├── backend/                    # 后端代码
│   ├── server.js              # 服务器入口
│   ├── services/              # 服务模块
│   │   ├── FileParser.js      # 文件解析器
│   │   ├── Validator.js       # 校验逻辑
│   │   └── Exporter.js        # 导出功能
│   └── uploads/               # 临时上传目录
├── frontend/                   # 前端代码
│   ├── src/
│   │   ├── main.jsx           # 入口文件
│   │   ├── App.jsx            # 主应用组件
│   │   └── index.css          # 样式文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── samples/                    # 示例数据
│   ├── case_manifest.json     # 案件清单
│   ├── documents.csv          # 文档清单
│   ├── ocr_text.jsonl         # OCR文本
│   ├── signature_log.jsonl    # 签名日志
│   └── archive_rules.yaml     # 归档规则
├── package.json               # 主项目配置
└── README.md
```

## 快速开始

### 前置要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd frontend && npm install && cd ..

# 或者使用一键安装
npm run install:all
```

### 本地演示

#### 1. 了解示例数据

`samples/` 目录下提供了一套完整的示例数据，用于演示系统的校验功能。这套数据故意包含了一些"问题"，以便展示系统的检测能力：

| 文件 | 说明 | 包含的示例问题 |
|------|------|---------------|
| case_manifest.json | 案件清单 | 2个案件（含1个2022年跨年度案件） |
| documents.csv | 文档清单 | 页码缺失（第9页缺失）、页码重叠（庭审笔录与判决书）、文书类型不匹配 |
| ocr_text.jsonl | OCR文本 | 未脱敏的身份证号、手机号、银行卡号 |
| signature_log.jsonl | 签名日志 | 过期签名、即将过期签名 |
| archive_rules.yaml | 归档规则 | 定义了民事一审案件的必备材料清单 |

#### 2. 启动服务

```bash
# 同时启动前后端开发服务器
npm run dev
```

这将启动：
- 后端服务：http://localhost:3001
- 前端应用：http://localhost:3000

#### 3. 使用系统

1. **打开浏览器**：访问 http://localhost:3000

2. **上传文件**：
   - 点击拖拽区域或点击选择文件
   - 从 `samples/` 目录选择以下5个文件：
     - case_manifest.json
     - documents.csv
     - ocr_text.jsonl
     - signature_log.jsonl
     - archive_rules.yaml

3. **开始校验**：
   - 点击「开始校验」按钮
   - 等待后端解析和校验完成

4. **查看校验结果**：

   系统将显示以下信息：

   **统计信息**：
   - 案件数量、文档数量
   - 风险总数（按等级分类）
   - 确认进度

   **左侧案件/材料树**：
   - 以树形结构展示所有案件和文书
   - 风险数量直接显示在树节点上
   - 点击节点查看详情

   **右侧详情面板**：
   - 案件详情：基本信息、文书列表、案件级风险
   - 文书详情：文书信息、签名信息、文书级风险

   **系统将检测到的示例问题**：

   🔴 **高风险**：
   - 页码缺失：第9页缺失（应诉通知书到举证通知书之间）
   - 页码重叠：庭审笔录(21-30页)与判决书(28-35页)重叠
   - 签名过期：(2022)京0101民初2002号案件的签名已过期
   - 敏感信息未脱敏：多处身份证号、手机号、银行卡号未脱敏
   - 缺少必要签名：部分文书需要签名但未检测到

   🟡 **中风险**：
   - 签名即将过期：部分签名有效期不足3个月
   - 跨案件引用：(2022)京0101民初2002号判决书中引用了其他案件案号
   - 页数不匹配：部分文书声明页数与实际页码范围不符

   🔵 **低风险**：
   - 跨年度案件：(2022)京0101民初2002号为2022年度案件
   - 文书类型不匹配：部分文书类型可能与案件类型不符

5. **人工确认风险**：
   - 在风险表格中查看每个风险的详细信息
   - 点击「确认」按钮标记已确认的风险
   - 确认进度条会实时更新

6. **导出结果**：

   **导出审查报告**：
   - 点击右上角「导出审查报告」按钮
   - 下载 `review_report.md` 文件
   - 报告包含：
     - 审查概况
     - 风险统计
     - 案件详情（含所有风险）
     - 审查结论

   **导出问题清单**：
   - 点击右上角「导出问题清单」按钮
   - 下载 `issues.csv` 文件
   - 可直接用 Excel 打开查看
   - 包含：案件号、文书名称、风险类型、风险等级、描述、建议等

#### 4. 重新开始

点击「重新开始」按钮可清除当前结果，重新上传文件进行校验。

## API 接口

### 后端接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/validate | 文件上传并校验 |
| POST | /api/export/report | 导出审查报告 (Markdown) |
| POST | /api/export/issues | 导出问题清单 (CSV) |
| GET | /api/supported-files | 获取支持的文件类型 |
| GET | /api/validation-rules | 获取校验规则说明 |

## 校验规则说明

### 1. 必备材料检查

根据 `archive_rules.yaml` 中定义的必备材料清单，检查每个案件是否包含所有必需的文书类型。

**风险等级**：高风险

### 2. 页码连续性检查

- 检查文档内部页码是否正确（结束页 >= 起始页）
- 检查文书之间页码是否连续（无跳页）
- 检查是否存在页码重叠
- 检查案件整体页码是否完整

**风险等级**：高风险

### 3. 案号/文书类型匹配

- 校验案号格式是否规范
- 检查文书类型是否与案件类型匹配
- 跨年度案号提醒

**风险等级**：中/低风险

### 4. 重复文号检查

- 检测是否存在重复的文书号
- 检测文档中是否引用了其他案件的案号

**风险等级**：高/中风险

### 5. 电子签名有效期

- 检查签名是否已过期
- 检查签名是否即将过期（3个月内）
- 检查签名时间是否在证书有效期内
- 检查需要签名的文书是否有签名

**风险等级**：高/中风险

### 6. 密级脱敏检查

- 检查密级设置是否规范
- 检测 OCR 文本中的敏感信息：
  - 身份证号（18位）
  - 手机号（11位）
  - 银行卡号（16-19位）
  - 电子邮箱
- 检查敏感信息是否已脱敏（是否包含 * 号）

**风险等级**：高/中风险

## 文件格式说明

### 1. case_manifest.json (案件清单)

```json
{
  "court": "法院名称",
  "manifestVersion": "1.0",
  "createdAt": "2024-05-03T10:00:00Z",
  "cases": [
    {
      "caseNumber": "(2024)京0101民初1001号",
      "caseType": "民事一审",
      "year": "2024",
      "court": "法院名称",
      "startPage": 1,
      "endPage": 50,
      "totalPages": 50
    }
  ]
}
```

### 2. documents.csv (文档清单)

| 字段 | 说明 |
|------|------|
| documentId | 文书唯一标识 |
| caseNumber | 所属案件号 |
| documentName | 文书名称 |
| documentType | 文书类型 |
| startPage | 起始页码 |
| endPage | 结束页码 |
| pageCount | 总页数 |
| classification | 密级 |
| hasSignature | 是否有电子签名 |
| ocrAvailable | 是否有OCR文本 |

### 3. ocr_text.jsonl (OCR文本)

JSON Lines 格式，每行一个 JSON 对象：

```json
{"documentId":"doc001","pageNumber":1,"text":"OCR识别的文本内容..."}
{"documentId":"doc001","pageNumber":2,"text":"第二页的文本内容..."}
```

### 4. signature_log.jsonl (签名日志)

JSON Lines 格式：

```json
{"documentId":"doc001","signer":"签名人","signedAt":"2024-01-15T10:30:00Z","validFrom":"2023-01-01","validTo":"2024-06-30"}
```

### 5. archive_rules.yaml (归档规则)

定义必备材料清单、密级规则、签名规则等：

```yaml
documentRequirements:
  民事一审:
    required:
      - name: "起诉状"
        type: "起诉状"
        mandatory: true
      # ... 更多必备材料

classificationRules:
  validClassifications: ["绝密", "机密", "秘密", "内部", "普通", "公开"]
  sensitiveInfoTypes:
    - name: "身份证号"
      pattern: "\\d{17}[\\dXx]"

signatureRules:
  requiredSignatureTypes: ["判决书", "裁定书", ...]
```

## 开发说明

### 单独启动服务

```bash
# 只启动后端
npm run dev:backend

# 只启动前端
npm run dev:frontend
```

### 后端开发

后端代码位于 `backend/` 目录：

- `server.js`：Express 服务器入口，定义所有 API 路由
- `services/FileParser.js`：文件解析器，支持 JSON、CSV、JSONL、YAML 格式
- `services/Validator.js`：核心校验逻辑，包含所有校验规则
- `services/Exporter.js`：导出功能，生成 Markdown 报告和 CSV 清单

### 前端开发

前端代码位于 `frontend/` 目录：

- `src/App.jsx`：主应用组件，包含所有 UI 逻辑
- 主要功能：
  - 文件上传组件
  - 案件/材料树视图
  - 风险表格展示
  - 统计信息展示
  - 导出功能

## 注意事项

1. **数据安全**：本系统为本地运行，所有数据仅在本地处理，不会上传到任何外部服务器。

2. **文件命名**：上传的文件必须使用标准文件名：
   - case_manifest.json
   - documents.csv
   - ocr_text.jsonl
   - signature_log.jsonl
   - archive_rules.yaml 或 archive_rules.yml

3. **大文件处理**：OCR 文本文件可能较大，建议分批处理或优化解析逻辑。

4. **日期处理**：系统使用本地时间进行签名有效期校验，请确保系统时间正确。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
