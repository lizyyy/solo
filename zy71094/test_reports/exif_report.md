# 图片 EXIF 合规清理报告

**生成时间**: 2026-05-24 21:08:34

## 处理统计

| 指标 | 数值 |
|------|------|
| 总处理文件数 | 4 |
| 成功清理 | 2 |
| 无 EXIF 数据 | 1 |
| 损坏图片 | 1 |
| 处理错误 | 0 |
| 发现 GPS 数据 | 1 |
| 发现缩略图元数据 | 0 |
| 移除字段总数 | 10 |
| 保留字段总数 | 4 |
| 平均处理时间 | 0.392s |

## 相机型号分布

| 相机型号 | 数量 |
|----------|------|
| Canon EOS 5D Mark IV | 1 |
| iPhone iPhone 15 Pro | 1 |

## 清理规则说明

### 已移除的字段类型
- **GPS 定位信息**: 所有 GPS 相关字段（经纬度、海拔、时间戳等）
- **设备信息**: 相机厂商、型号、序列号、镜头信息等
- **软件信息**: 拍摄软件、编辑软件版本等
- **缩略图元数据**: 内嵌缩略图及其 EXIF 信息

### 保留的字段类型
- **拍摄日期**: DateTimeOriginal, DateTimeDigitized 用于归档
- **方向信息**: 图片旋转方向（可配置）

## GPS 数据清理详情

| 行号 | 文件 | 相机型号 | 移除的GPS字段数 |
|------|------|----------|----------------|
| 3 | `photo_with_gps.jpg` | Canon EOS 5D Mark IV | 4 |

## 无法处理的文件记录

> **注意**: 损坏的图片不会被修改，保留在原始位置以便人工处理

| 行号 | 状态 | 文件路径 | 错误信息 |
|------|------|----------|----------|
| 2 | 文件损坏 | `/Users/lzy/pro/solo/workspaces/zy71094/test_images/corrupted.jpg` | 图片损坏或格式不支持 |

## 处理详情

| 行号 | 文件 | 状态 | 移除字段 | 保留字段 | 输出路径 |
|------|------|------|----------|----------|----------|
| 1 | `photo_no_exif.png` | no_exif | - | - | `photo_no_exif.png` |
| 2 | `corrupted.jpg` | corrupted | - | - | `-` |
| 3 | `photo_with_gps.jpg` | success | GPS:GPSLatitudeRef, GPS:GPSLatitude, GPS:GPSLongitudeRef (+5) | 0th:Orientation, 0th:DateTime, Exif:DateTimeOriginal (+1) | `photo_with_gps.jpg` |
| 4 | `iphone_photo.jpg` | success | 0th:Make, 0th:Model | - | `iphone_photo.jpg` |

---

*报告由 EXIF 合规清理工具自动生成*