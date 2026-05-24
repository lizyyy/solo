# Jenkins 构建参数快照 #123

**生成时间**: 2026-05-24 20:38:41
**快照ID**: `8642ff370df9b061`

## 基本信息

| 字段 | 值 |
|------|-----|
| Job 名称 | MyApp/Build/Production |
| 构建号 | 123 |
| 状态 | ❌ FAILURE |
| 触发时间 | 2024-05-26 16:00:00 |
| 耗时 | 125.0 秒 |
| 触发人 | 张三 |
| Git 提交 | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0` |
| Jenkins URL | [https://jenkins.example.com/job/MyApp/job/Build/job/Production/123/](https://jenkins.example.com/job/MyApp/job/Build/job/Production/123/) |

## 参数列表

| 参数名 | 类型 | 值 |
|--------|------|-----|
| `ENVIRONMENT` | CHOICE | `production` |
| `BUILD_VERSION` | STRING | `v2.3.1` |
| `ENABLE_CACHE` | BOOLEAN | `true` |
| `DEPLOY_TARGETS` | STRING | `web,api,worker` |
| `TIMEOUT_MINUTES` | STRING | `30` |

## 产物清单

| 产物名 | 路径 | 大小 | 状态 |
|--------|------|------|------|
| app.tar.gz | `dist/app.tar.gz` | 15,420,000 B | ✅ 存在 |
| build.log | `logs/build.log` | 245,678 B | ✅ 存在 |
| test-report.xml | `reports/test-report.xml` | N/A | ❌ 缺失 |

## 校验结果

### ⚠️ 警告

- **artifacts.test-report.xml**: Artifact marked as missing: test-report.xml

## 操作日志

- Parameters archived: snapshots/MyApp_Build_Production/build_123/parameters.json
- Artifact manifest saved: snapshots/MyApp_Build_Production/build_123/artifacts.json
- Build info saved: snapshots/MyApp_Build_Production/build_123/build_info.json
- Source input preserved: snapshots/MyApp_Build_Production/build_123/source_input.json

---
*由 jenkins-snapshot v1.0.0 生成*