# Android 权限差异分析报告

> 生成时间: 2026/5/24 23:06:32
> 工具版本: 1.0.0

## 📱 应用信息

| 版本 | 包名 | 版本号 | 来源 |
|------|------|--------|------|
| 旧版 | com.example.app | 1.0.0 | AndroidManifest.xml |
| 新版 | com.example.app | 1.1.0 | AndroidManifest.xml |

## 📊 变更摘要

- **新增权限**: 7 个
- **移除权限**: 2 个
- **变更权限**: 0 个
- **未变更权限**: 5 个

## ⚠️ 风险评估

> ❗ **警告**: 检测到高风险权限变更，需要重点关注!

> 最高新增风险等级: **严重** - 涉及隐私或安全的高危权限，可能导致严重安全事件

| 风险等级 | 新增 | 移除 | 说明 |
|----------|------|------|------|
| 🔴 严重 | 3 | 0 | 涉及隐私或安全的高危权限 |
| 🟣 高 | 0 | 2 | 敏感权限，需要用户授权 |
| 🟡 中 | 1 | 0 | 普通权限，存在一定风险 |
| 🔵 低 | 0 | 0 | 正常权限，基本无风险 |
| ⚪ 未知 | 3 | 0 | 未知权限，需要人工评估 |

## ➕ 新增权限详情

| 权限名称 | 风险等级 | 权限组 | 来源 | 置信度 | 说明 |
|----------|----------|--------|------|--------|------|
| android.permission.ACCESS_COARSE_LOCATION | 🟡 中 | 位置信息 | feature-location | 70% | 普通权限，存在一定安全风险 |
| android.permission.READ_MEDIA_IMAGES | ⚪ 未知 | - | feature-media | 70% | 未知权限，需要人工评估 |
| android.permission.READ_MEDIA_VIDEO | ⚪ 未知 | - | feature-media | 70% | 未知权限，需要人工评估 |
| android.permission.CAMERA | 🔴 严重 | 相机 | feature-camera, feature-camera | 90% | 涉及隐私或安全的高危权限，可能导致严重安全事件 |
| android.permission.RECORD_AUDIO | 🔴 严重 | 麦克风 | 未知 | 0% | 涉及隐私或安全的高危权限，可能导致严重安全事件 |
| android.permission.ACCESS_FINE_LOCATION | 🔴 严重 | 位置信息 | feature-location, feature-location | 80% | 涉及隐私或安全的高危权限，可能导致严重安全事件 |
| android.permission.POST_NOTIFICATIONS | ⚪ 未知 | - | 未知 | 0% | 未知权限，需要人工评估 |

## ➖ 移除权限详情

| 权限名称 | 风险等级 | 权限组 | 说明 |
|----------|----------|--------|------|
| android.permission.READ_EXTERNAL_STORAGE | 🟣 高 | 存储 | 敏感权限，需要用户授权，可能被滥用 |
| android.permission.WRITE_EXTERNAL_STORAGE | 🟣 高 | 存储 | 敏感权限，需要用户授权，可能被滥用 |

## 🎯 特性变更

### 新增特性

| 特性名称 | 必需 | 隐含权限 |
|----------|------|----------|
| android.hardware.camera.autofocus | 是 | android.permission.CAMERA |
| android.hardware.microphone | 是 | android.permission.RECORD_AUDIO |
| android.hardware.location.gps | 否 | android.permission.ACCESS_FINE_LOCATION |

## 👥 权限组变更

| 权限组 | 旧数量 | 新数量 | 新增 | 移除 |
|--------|--------|--------|------|------|
| 相机 | 0 | 1 | 1 | 0 |
| 麦克风 | 0 | 1 | 1 | 0 |
| 位置信息 | 0 | 2 | 2 | 0 |
| 存储 | 2 | 0 | 0 | 2 |

## 🔍 权限来源分析

- **可溯源权限**: 5 个
- **未知来源权限**: 2 个
- **可能来自第三方库**: 0 个

### 可能由第三方库注入的权限

| 权限名称 | 可能来自库 |
|----------|------------|
| android.permission.RECORD_AUDIO | 可能 |
| android.permission.POST_NOTIFICATIONS | 可能 |

## 💡 安全建议

### 🔴 严重权限新增

新增了 3 个严重权限，需要立即审查这些权限的使用目的和必要性

**涉及权限:**

- android.permission.CAMERA
- android.permission.RECORD_AUDIO
- android.permission.ACCESS_FINE_LOCATION

### 🟡 未知权限新增

新增了 3 个未知权限，需要人工确认其来源和用途

**涉及权限:**

- android.permission.READ_MEDIA_IMAGES
- android.permission.READ_MEDIA_VIDEO
- android.permission.POST_NOTIFICATIONS

---

*退出码: 11*

> 非零退出码表示存在需要关注的变更