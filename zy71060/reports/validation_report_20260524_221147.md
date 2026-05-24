# 对象存储校验报告
**生成时间**: 2026-05-24 22:11:47
**报告 ID**: d4f4acb1-69f0-41cc-82cb-cad31c154c95
**总耗时**: 0.00 秒

## 基本信息
- Manifest ID: `test-format-consistency`
- Manifest 版本: `1.0`
- 数据源: `examples/manifest_format_test.json`
- 存储区域: cn-north-1, cn-south-1

## 校验摘要
| 项目 | 数量 |
|------|------|
| 检查文件数 | 0 |
| 检查分片数 | 0 |
| 错误数量 | 1 |
| 警告数量 | 0 |

## ❌ 错误详情
共发现 **1** 个错误:

| # | 错误代码 | 文件/分片 | 区域 | 描述 |
|---|----------|-----------|------|------|
| 1 | `chunk_checksum_inconsistent` | test-file | - | Chunk checksum inconsistent across regions: test-file:1 |

## 区域对比
- 文件数差异: 0
- 分片数差异: 1

## 建议行动
1. **立即修复以下问题**:   - 重新上传缺失的分片   - 校验并修复 checksum 不匹配的文件   - 同步各区域间不一致的副本
