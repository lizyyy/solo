# PDF 元数据脱敏报告

**生成时间**: 2026-05-24T20:26:42.204325

## 执行摘要

| 指标 | 值 |
|------|-----|
| 处理文件总数 | 1 |
| 成功 | 1 |
| 失败 | 0 |
| 输出目录 | `/Users/lzy/pro/solo/workspaces/zy71072/output` |

## 清理统计

| 项目 | 原始数量 | 清理数量 | 剩余数量 |
|--------|----------|----------|----------|
| 批注 | 0 | 0 | 0 |
| 附件 | 0 | 0 | 0 |

## 文件处理详情

### ✅ test_demo.pdf

- **输入文件**: `/Users/lzy/pro/solo/workspaces/zy71072/test_demo.pdf`
- **输出文件**: `/Users/lzy/pro/solo/workspaces/zy71072/output/test_demo_sanitized.pdf`
- **处理状态**: 成功
- **退出码**: 0 (所有文件处理成功，所有敏感数据已清理)
- **输入文件哈希**: `0154712e21a1fcf242e98a5a31d47be6bacc930e3b2537e9fa4e6eecd7a9354b`
- **输出文件哈希**: `85126eda986f30567dd83a15ff699f6644ccaf3ae3631e51047ec5b703e4ab1d`

#### 原始元数据

| 字段 | 值 |
|------|-----|
| title | 机密文档 |
| author | 张三 |
| subject | 这是内部机密文件 |
| keywords | 机密, 内部, 法务 |
| creator | Microsoft Word |
| producer | pikepdf 9.11.0 |
| Author | 张三 |
| Title | 机密文档 |
| Keywords | 机密, 内部, 法务 |
| Subject | 这是内部机密文件 |
| Creator | Microsoft Word |
| Producer | pikepdf 9.11.0 |

## 退出码说明

- **0**: 所有文件处理成功，所有敏感数据已清理
- **1**: 部分文件处理成功，部分文件存在问题
- **2**: 未找到可处理的PDF文件
- **3**: 输入参数错误或文件不存在
- **4**: 文件权限不足，无法读取或写入
- **5**: PDF文件已加密，需要密码才能处理
- **6**: PDF文件损坏或格式无效
- **7**: 输出目录无法创建或写入
- **8**: 脱敏规则配置错误
- **9**: 检测到增量更新残留，需要手动处理
- **10**: 发生未知错误

---
*此报告由 pdf-sanitizer 工具自动生成*
