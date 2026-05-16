# 指标基数护栏 API

用于监控指标基数的护栏服务，防止指标基数因标签滥用而暴涨。

## 功能特性

- 基数估算：基于标签组合估算指标基数
- 标签白名单：控制允许的标签键
- 状态管理：PENDING -> BLOCKED / APPROVED -> APPLIED
- 人工放行：支持人工审核放行
- 报告导出：导出护栏拦截报告
- 异常追踪：保留原始输入和处理结论

## 快速开始

```bash
pip install -r requirements.txt
python main.py
```

访问 http://localhost:8000/docs 查看API文档

## 核心接口

- `POST /api/v1/applications` - 创建指标申请
- `GET /api/v1/applications` - 查询申请列表
- `GET /api/v1/applications/{id}` - 查询单个申请
- `POST /api/v1/applications/{id}/approve` - 人工批准
- `POST /api/v1/applications/{id}/reject` - 人工拒绝
- `POST /api/v1/applications/{id}/apply` - 标记为已应用
- `GET /api/v1/report` - 导出护栏报告
- `GET /api/v1/whitelist` - 查询标签白名单
- `POST /api/v1/whitelist` - 添加标签到白名单

## 运行测试

```bash
python test_sample.py
```
