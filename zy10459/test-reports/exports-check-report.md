# Package Exports 体检报告

> 生成时间: 2026-05-16T20:23:14.155Z

## 📦 包信息

| 字段 | 值 |
|------|-----|
| 包名称 | `test-package` |
| 版本 | `1.0.0` |
| 检查目录 | `/Users/lzy/pro/solo/workspaces/zy10459/test-package` |

## 📊 摘要统计

| 指标 | 数量 | 状态 |
|------|------|------|
| 总导出入口 | 9 | |
| 有效导出 | 8 | ✅ |
| 无效导出 | 1 | ❌ |
| 缺失文件 | 3 | ⚠️ |
| 扫描文件总数 | 4 | |

## ❌ 错误

1. **1 export(s) point to non-existent files**

## ⚠️ 警告

1. 3 file(s) exist but are not exported

## 🔴 无效导出详情

| 序号 | 导出路径 | 解析路径 | 条件 | 来源 | 错误 |
|------|----------|----------|------|------|------|
| 1 | `./missing` | `dist/not-exist.js` | - | exports | 文件不存在 |

## 🟡 缺失路径详情

| 序号 | 文件路径 | 原因 | 实际位置 |
|------|----------|------|----------|
| 1 | `src/another.js` | File exists but not exported via exports field | `/Users/lzy/pro/solo/workspaces/zy10459/test-package/src/another.js` |
| 2 | `src/secret.js` | File exists but not exported via exports field | `/Users/lzy/pro/solo/workspaces/zy10459/test-package/src/secret.js` |
| 3 | `dist/not-exist.js` | Export path "./missing" points to non-existent file | `test-package/dist/not-exist.js` |

## 🟢 有效导出列表

| 序号 | 导出路径 | 解析路径 | 条件 | 来源 |
|------|----------|----------|------|------|
| 1 | `.` | `dist/index.js` | - | main |
| 2 | `.` | `dist/index.esm.js` | import, module | module |
| 3 | `.` | `dist/index.d.ts` | types | types |
| 4 | `.` | `dist/index.esm.js` | import | exports |
| 5 | `.` | `dist/index.js` | require | exports |
| 6 | `.` | `dist/index.d.ts` | types | exports |
| 7 | `./utils` | `dist/utils.esm.js` | import | exports |
| 8 | `./utils` | `dist/utils.js` | require | exports |

## 📝 导入样例

| 序号 | 导入语句 | 预期可用 | 实际路径 | 错误信息 |
|------|----------|----------|----------|----------|
| 1 | `import 'test-package'` | ✅ 是 | `dist/index.js` | - |
| 2 | `require('test-package')` | ✅ 是 | `dist/index.js` | - |
| 3 | `import 'test-package/utils'` | ✅ 是 | `dist/utils.esm.js` | - |
| 4 | `require('test-package/utils')` | ✅ 是 | `dist/utils.esm.js` | - |
| 5 | `import 'test-package/missing'` | ❌ 否 | `dist/not-exist.js` | Target file does not exist |
| 6 | `require('test-package/missing')` | ❌ 否 | `dist/not-exist.js` | Target file does not exist |

## 🔍 追溯信息

### 文件位置追溯

所有文件的绝对路径:

- `/Users/lzy/pro/solo/workspaces/zy10459/test-package/package.json`
- `/Users/lzy/pro/solo/workspaces/zy10459/test-package/src/another.js`
- `/Users/lzy/pro/solo/workspaces/zy10459/test-package/src/secret.js`

---

*此报告由 Package Exports Checker 自动生成*