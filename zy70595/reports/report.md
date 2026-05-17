# TypeScript Path Alias Diagnostic Report
Generated: 2026-05-17T04:09:36.152Z

## Summary
| Metric | Count | Status |
|--------|-------|--------|
| Total Imports | 11 | |
| Valid Imports | 9 | ✅ |
| Dirty Lines | 2 | ⚠️ |
| Conflicts | 0 | ✅ |

## ⚠️ Dirty Lines (Parse Errors)

| Line | Category | Reason | Raw Line |
|------|----------|--------|----------|
| 8 | invalid_format | Invalid import path format | `''` |
| 10 | invalid_format | Invalid import path format | `invalid path with spaces` |

## Path Alias Configuration

| Alias | Target Paths |
|-------|--------------|
| `@/*` | `src/*` |
| `@components/*` | `src/components/*` |
| `@utils/*` | `src/utils/*` |
| `@test/*` | `test/*` |

## Resolution Details

### default

| Import Path | Resolved Path | File Exists | Matched Alias |
|-------------|---------------|-------------|---------------|
| `@/foo` | `/Users/lzy/pro/solo/workspaces/zy70595/src/foo` | ✅ | `@/*` |
| `@components/Bar` | `/Users/lzy/pro/solo/workspaces/zy70595/src/components/Bar` | ✅ | `@components/*` |
| `@utils/index` | `/Users/lzy/pro/solo/workspaces/zy70595/src/utils/index` | ✅ | `@utils/*` |
| `@test/config` | `/Users/lzy/pro/solo/workspaces/zy70595/test/config` | ❌ | `@test/*` |
| `./relative` | `/Users/lzy/pro/solo/workspaces/zy70595/relative` | ❌ | - |
| `@/missing-quotes` | `/Users/lzy/pro/solo/workspaces/zy70595/src/missing-quotes` | ❌ | `@/*` |
| ``@/backticks`` | ``@/backticks`` | ❌ | - |
| `another-bad-line@` | `another-bad-line@` | ❌ | - |
| `@/double//slashes` | `/Users/lzy/pro/solo/workspaces/zy70595/src/double/slashes` | ❌ | `@/*` |
