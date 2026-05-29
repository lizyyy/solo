---
maintainer: 李四
---

# 配置指南 v1.0

## 基础配置

配置文件路径：`/etc/app/config.yaml`

## 高级配置

请参考主文档 [安装步骤](../v1.0/guide.md#安装步骤)。

## 数据库配置

数据库连接示例：

```python
db = connect("mysql://localhost:3306/app")
```

## API 配置

请参考 [v2.0 版本的 API 配置](../v2.0/api.md#API-配置)。

> 注意：这里锚点使用了大写 `#API-配置`，而 v2.0 文档中的标题可能是 `## API 配置`（slug 为 `api-配置`），这会造成大小写不匹配。
