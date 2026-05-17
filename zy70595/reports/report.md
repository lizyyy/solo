# TypeScript Path Alias Diagnostic Report
Generated: 2026-05-17T05:56:10.079Z

## Summary
| Metric | Count | Status |
|--------|-------|--------|
| Total Imports | 5 | |
| Valid Imports | 5 | ✅ |
| Dirty Lines | 0 | ✅ |
| Conflicts | 2 | ❌ |

## ❌ Conflicts Detected

### `@components/Bar`
- **Type**: resolution_mismatch
- **Description**: Resolved path differs across environments

| Environment | Resolved Path | File Exists |
|-------------|---------------|-------------|
| build | `/Users/lzy/pro/solo/workspaces/zy70595/src/components/Bar` | ✅ Yes |
| editor | `/Users/lzy/pro/solo/workspaces/zy70595/src/ui/Bar` | ✅ Yes |

### `@test/config`
- **Type**: resolution_mismatch
- **Description**: Resolved path differs across environments

| Environment | Resolved Path | File Exists |
|-------------|---------------|-------------|
| build | `/Users/lzy/pro/solo/workspaces/zy70595/test/config` | ❌ No |
| editor | `@test/config` | ❌ No |

## Environment Configurations

### build
- **tsconfig path**: `/Users/lzy/pro/solo/workspaces/zy70595/test/tsconfig.build.json`

| Alias | Target Paths |
|-------|--------------|
| `@/*` | `src/*` |
| `@components/*` | `src/components/*` |
| `@utils/*` | `src/utils/*` |
| `@test/*` | `test/*` |

### editor
- **tsconfig path**: `/Users/lzy/pro/solo/workspaces/zy70595/test/tsconfig.editor.json`

| Alias | Target Paths |
|-------|--------------|
| `@/*` | `src/*` |
| `@components/*` | `src/ui/*` |
| `@utils/*` | `src/utils/*` |
| `@lib/*` | `lib/*` |

## Resolution Details

### build

| Import Path | Resolved Path | File Exists | Matched Alias |
|-------------|---------------|-------------|---------------|
| `@/foo` | `/Users/lzy/pro/solo/workspaces/zy70595/src/foo` | ✅ | `@/*` |
| `@components/Bar` | `/Users/lzy/pro/solo/workspaces/zy70595/src/components/Bar` | ✅ | `@components/*` |
| `@utils/index` | `/Users/lzy/pro/solo/workspaces/zy70595/src/utils/index` | ✅ | `@utils/*` |
| `@test/config` | `/Users/lzy/pro/solo/workspaces/zy70595/test/config` | ❌ | `@test/*` |
| `./relative` | `/Users/lzy/pro/solo/workspaces/zy70595/relative` | ❌ | - |

### editor

| Import Path | Resolved Path | File Exists | Matched Alias |
|-------------|---------------|-------------|---------------|
| `@/foo` | `/Users/lzy/pro/solo/workspaces/zy70595/src/foo` | ✅ | `@/*` |
| `@components/Bar` | `/Users/lzy/pro/solo/workspaces/zy70595/src/ui/Bar` | ✅ | `@components/*` |
| `@utils/index` | `/Users/lzy/pro/solo/workspaces/zy70595/src/utils/index` | ✅ | `@utils/*` |
| `@test/config` | `@test/config` | ❌ | - |
| `./relative` | `/Users/lzy/pro/solo/workspaces/zy70595/relative` | ❌ | - |
