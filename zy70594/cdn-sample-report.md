# CDN 访问日志抽样报告

**生成时间**: 2026/5/17 12:09:29
**源文件**: /Users/lzy/pro/solo/workspaces/zy70594/data/sample-nginx.log

## 📊 处理统计

| 指标 | 数值 |
|------|------|
| 总行数 | 14 |
| 有效行数 | 14 |
| 抽样数量 | 13 |
| 抽样比例 | 92.86% |
| 分层数量 | 13 |
| 异常行数 | 1 |
| 重复行数 | 1 |

## 📈 分布统计

### 状态码分布

| 分类 | 数量 | 占比 |
|------|------|------|
| 200 | 6 | 46.2% |
| 206 | 1 | 7.7% |
| 301 | 1 | 7.7% |
| 304 | 1 | 7.7% |
| 403 | 1 | 7.7% |
| 404 | 1 | 7.7% |
| 429 | 1 | 7.7% |
| 500 | 1 | 7.7% |

### 地区分布

| 分类 | 数量 | 占比 |
|------|------|------|
| US | 3 | 23.1% |
| CN | 2 | 15.4% |
| EU | 1 | 7.7% |
| JP | 1 | 7.7% |
| KR | 1 | 7.7% |
| GB | 1 | 7.7% |
| DE | 1 | 7.7% |
| FR | 1 | 7.7% |
| IN | 1 | 7.7% |
| AU | 1 | 7.7% |

### 资源类型分布

| 分类 | 数量 | 占比 |
|------|------|------|
| other | 4 | 30.8% |
| html | 2 | 15.4% |
| css | 2 | 15.4% |
| javascript | 1 | 7.7% |
| image | 1 | 7.7% |
| video | 1 | 7.7% |
| document | 1 | 7.7% |
| font | 1 | 7.7% |

## ⚠️ 异常记录详情

| 行号 | 错误类型 | 错误信息 | 原始内容 |
|------|----------|----------|----------|
| 11 | pattern_mismatch | - | 这是一行无效的日志 |

## 🎯 抽样样本示例

| 行号 | 分层 | 状态码 | 地区 | 资源类型 | URL |
|------|------|--------|------|----------|-----|
| 1 | 200|CN|html | 200 | CN | html | /index.html |
| 2 | 200|US|css | 200 | US | css | /style.css |
| 3 | 200|EU|javascript | 200 | EU | javascript | /app.js |
| 4 | 200|JP|image | 200 | JP | image | /image.jpg |
| 5 | 404|KR|html | 404 | KR | html | /notfound.html |
| 7 | 500|US|other | 500 | US | other | /api/login |
| 8 | 206|GB|video | 206 | GB | video | /video.mp4 |
| 9 | 403|DE|other | 403 | DE | other | /admin |
| 10 | 200|FR|document | 200 | FR | document | /doc.pdf |
| 12 | 200|CN|font | 200 | CN | font | /font.woff2 |
| 13 | 304|US|css | 304 | US | css | /style.css |
| 14 | 429|IN|other | 429 | IN | other | /api/data |
| 15 | 301|AU|other | 301 | AU | other | /redirect |
