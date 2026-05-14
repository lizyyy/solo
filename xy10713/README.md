# 短链跳转风控台

一个轻量级的短链接风控管理系统。

## 功能特性

- **搜索查询**: 按 slug、域名、负责人搜索短链接
- **批量导入检测**: 批量导入短链接，自动检测风险域名
- **点击趋势分析**: 可视化展示点击趋势，按访问来源分组
- **黑名单规则**: 内置高风险域名黑名单，显示详细失败原因
- **封禁/解封**: 手动管理短链接状态
- **CSV导出**: 按负责人、时间、访问来源分组导出数据

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
python server.py
```

服务将在 http://localhost:5000 启动

### 3. 打开前端页面

直接用浏览器打开 `index.html` 文件

## 测试数据

系统预置了以下测试数据：

### 短链接（已自动封禁高风险）：
- `promo-2024` → malicious-site.com (钓鱼域名)
- `spring-sale` → legitimate-shop.com (正常)
- `vip-access` → phishing-attack.net (仿冒登录)
- `download-app` → safe-app.org (正常)
- `free-gift` → scam-site.com (虚假奖品)
- `newsletter` → real-news.com (正常)

### 黑名单规则（含失败原因）：
- malicious-site.com → 多次报告欺诈行为
- phishing-attack.net → 银行投诉举报
- scam-site.com → 大量用户投诉

## 功能演示

1. **搜索测试**: 在搜索框输入 "张三" 或 "malicious" 查看结果
2. **批量导入**: 点击"填充测试数据"→"批量导入并检测"，观察风险域名自动封禁
3. **点击趋势**: 切换到"点击趋势"标签页，查看图表和访问来源分布
4. **导出数据**: 点击"导出CSV"，查看按负责人、日期、来源分组的报表
5. **封禁/解封**: 在搜索结果中尝试封禁/解封操作

## 技术栈

- **后端**: Python Flask
- **前端**: 原生 JavaScript + Chart.js
- **通信**: RESTful API
