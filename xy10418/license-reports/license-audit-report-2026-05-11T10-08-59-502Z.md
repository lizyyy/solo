# 依赖许可证审计报告

**扫描时间**: 2026-05-11T10:07:05.504Z

**审计状态**: ⚠ WARN

---

## 摘要

| 统计项 | 数量 |
|--------|------|
| 总依赖数 | 116 |
| 直接依赖 | 10 |
| 传递依赖 | 109 |
| ✓ 允许 | 110 |
| ⚠ 需确认 | 3 |
| ✗ 禁止 | 0 |
| ? 未知 | 5 |
| 例外审批 | 1 |

## 警告

### 同名不同版本: whatwg-url

- 版本: 13.0.0, 5.0.0
- 许可证: MIT, MIT

### 同名不同版本: tr46

- 版本: 4.1.1, 0.0.3
- 许可证: MIT, MIT

## 问题

### [未知] sspl-package@1.0.0

- **许可证**: SSPL-1.0
- **原因**: 未知许可证，需人工确认
- **类型**: 传递依赖
- **父依赖**: sample

### [需确认] agpl-library@2.1.0

- **许可证**: AGPL-3.0
- **原因**: 许可证 AGPL-3.0 需要审批确认
- **类型**: 传递依赖
- **父依赖**: sample

### [需确认] gpl-component@3.0.0

- **许可证**: GPL-3.0
- **原因**: 许可证 GPL-3.0 需要审批确认
- **类型**: 传递依赖
- **父依赖**: sample

### [需确认] lgpl-utils@2.1.0

- **许可证**: LGPL-2.1
- **原因**: 许可证 LGPL-2.1 需要审批确认
- **类型**: 传递依赖
- **父依赖**: sample

### [未知] unknown-pkg@1.0.0

- **许可证**: UNKNOWN
- **原因**: 无法识别的许可证
- **类型**: 传递依赖
- **父依赖**: sample

### [未知] missing-license@2.0.0

- **许可证**: UNKNOWN
- **原因**: 无法识别的许可证
- **类型**: 传递依赖
- **父依赖**: sample

### [未知] custom-license@1.5.0

- **许可证**: CUSTOM
- **原因**: 未知许可证，需人工确认
- **类型**: 传递依赖
- **父依赖**: sample

### [未知] proprietary-pkg@3.0.0

- **许可证**: Proprietary
- **原因**: 未知许可证，需人工确认
- **类型**: 传递依赖
- **父依赖**: sample

## ⚠️ 需审批确认许可证 (3)

| 包名 | 版本 | 许可证 | 风险 | 类型 |
|------|------|--------|------|------|
| agpl-library | 2.1.0 | AGPL-3.0 | medium | 传递 |
| gpl-component | 3.0.0 | GPL-3.0 | medium | 传递 |
| lgpl-utils | 2.1.0 | LGPL-2.1 | medium | 传递 |

## ❓ 未知许可证 (5)

| 包名 | 版本 | 许可证 | 风险 | 类型 |
|------|------|--------|------|------|
| sspl-package | 1.0.0 | SSPL-1.0 | high | 传递 |
| unknown-pkg | 1.0.0 | UNKNOWN | high | 传递 |
| missing-license | 2.0.0 | UNKNOWN | high | 传递 |
| custom-license | 1.5.0 | CUSTOM | high | 传递 |
| proprietary-pkg | 3.0.0 | Proprietary | high | 传递 |

## ✅ 允许许可证 (111)

| 包名 | 版本 | 许可证 | 风险 | 类型 |
|------|------|--------|------|------|
| express | 4.18.2 | MIT | low | 直接 |
| lodash | 4.17.21 | MIT | low | 直接 |
| axios | 1.6.0 | MIT | low | 直接 |
| react | 18.2.0 | MIT | low | 直接 |
| vue | 3.3.8 | MIT | low | 直接 |
| mongodb | 6.2.0 | Apache-2.0 | low | 直接 |
| redis | 4.6.10 | MIT | low | 直接 |
| moment | 2.29.4 | MIT | low | 直接 |
| nodemailer | 6.9.7 | MIT | low | 直接 |
| multer | 1.4.5-lts.1 | MIT | low | 直接 |
| accepts | 1.3.8 | MIT | low | 传递 |
| array-flatten | 1.1.1 | MIT | low | 传递 |
| body-parser | 1.20.1 | MIT | low | 传递 |
| content-disposition | 0.5.4 | MIT | low | 传递 |
| content-type | 1.0.5 | MIT | low | 传递 |
| cookie | 0.5.0 | MIT | low | 传递 |
| cookie-signature | 1.0.6 | MIT | low | 传递 |
| debug | 2.6.9 | MIT | low | 传递 |
| depd | 2.0.0 | MIT | low | 传递 |
| encodeurl | 1.0.2 | MIT | low | 传递 |
| escape-html | 1.0.3 | MIT | low | 传递 |
| etag | 1.8.1 | MIT | low | 传递 |
| finalhandler | 1.2.0 | MIT | low | 传递 |
| fresh | 0.5.2 | MIT | low | 传递 |
| http-errors | 2.0.0 | MIT | low | 传递 |
| merge-descriptors | 1.0.1 | MIT | low | 传递 |
| methods | 1.1.2 | MIT | low | 传递 |
| on-finished | 2.4.1 | MIT | low | 传递 |
| parseurl | 1.3.3 | MIT | low | 传递 |
| path-to-regexp | 0.1.7 | MIT | low | 传递 |
| proxy-addr | 2.0.7 | MIT | low | 传递 |
| qs | 6.11.0 | BSD-3-Clause | low | 传递 |
| range-parser | 1.2.1 | MIT | low | 传递 |
| safe-buffer | 5.2.1 | MIT | low | 传递 |
| send | 0.18.0 | MIT | low | 传递 |
| serve-static | 1.15.0 | MIT | low | 传递 |
| setprototypeof | 1.2.0 | ISC | low | 传递 |
| statuses | 2.0.1 | MIT | low | 传递 |
| type-is | 1.6.18 | MIT | low | 传递 |
| utils-merge | 1.0.1 | MIT | low | 传递 |
| vary | 1.1.2 | MIT | low | 传递 |
| follow-redirects | 1.15.3 | MIT | low | 传递 |
| form-data | 4.0.0 | MIT | low | 传递 |
| proxy-from-env | 1.1.0 | MIT | low | 传递 |
| loose-envify | 1.4.0 | MIT | low | 传递 |
| react-is | 18.2.0 | MIT | low | 传递 |
| @babel/runtime | 7.23.2 | MIT | low | 传递 |
| @vue/shared | 3.3.8 | MIT | low | 传递 |
| @vue/compiler-dom | 3.3.8 | MIT | low | 传递 |
| @vue/runtime-dom | 3.3.8 | MIT | low | 传递 |
| @vue/reactivity | 3.3.8 | MIT | low | 传递 |
| @vue/runtime-core | 3.3.8 | MIT | low | 传递 |
| @vue/compiler-core | 3.3.8 | MIT | low | 传递 |
| bson | 6.2.0 | Apache-2.0 | low | 传递 |
| mongodb-connection-string-url | 3.0.0 | Apache-2.0 | low | 传递 |
| socks | 2.7.1 | MIT | low | 传递 |
| whatwg-url | 13.0.0 | MIT | low | 传递 |
| tr46 | 4.1.1 | MIT | low | 传递 |
| punycode | 2.3.1 | MIT | low | 传递 |
| smart-buffer | 4.2.0 | MIT | low | 传递 |
| ipaddr.js | 2.1.0 | MIT | low | 传递 |
| ms | 2.0.0 | MIT | low | 传递 |
| ee-first | 1.1.1 | MIT | low | 传递 |
| destroy | 1.2.0 | MIT | low | 传递 |
| unpipe | 1.0.0 | MIT | low | 传递 |
| forwarded | 0.2.0 | MIT | low | 传递 |
| mime | 1.6.0 | MIT | low | 传递 |
| mime-types | 2.1.35 | MIT | low | 传递 |
| mime-db | 1.52.0 | MIT | low | 传递 |
| negotiator | 0.6.3 | MIT | low | 传递 |
| inherits | 2.0.4 | ISC | low | 传递 |
| asynckit | 0.4.0 | MIT | low | 传递 |
| combined-stream | 1.0.8 | MIT | low | 传递 |
| delayed-stream | 1.0.0 | MIT | low | 传递 |
| js-tokens | 4.0.0 | MIT | low | 传递 |
| regenerator-runtime | 0.14.0 | MIT | low | 传递 |
| entities | 4.5.0 | BSD-2-Clause | low | 传递 |
| estree-walker | 2.0.2 | MIT | low | 传递 |
| source-map-js | 1.0.2 | BSD-3-Clause | low | 传递 |
| iconv-lite | 0.4.24 | MIT | low | 传递 |
| raw-body | 2.5.1 | MIT | low | 传递 |
| bytes | 3.1.2 | MIT | low | 传递 |
| safer-buffer | 2.1.2 | MIT | low | 传递 |
| busboy | 1.6.0 | MIT | low | 传递 |
| streamsearch | 1.1.0 | MIT | low | 传递 |
| append-field | 1.0.0 | MIT | low | 传递 |
| buffer-from | 1.1.2 | MIT | low | 传递 |
| concat-stream | 1.6.2 | MIT | low | 传递 |
| mkdirp | 0.5.6 | MIT | low | 传递 |
| object-assign | 4.1.1 | MIT | low | 传递 |
| on-finished | 2.4.1 | MIT | low | 传递 |
| type-is | 1.6.18 | MIT | low | 传递 |
| xtend | 4.0.2 | MIT | low | 传递 |
| minimist | 1.2.8 | MIT | low | 传递 |
| typedarray | 0.0.6 | MIT | low | 传递 |
| readable-stream | 2.3.8 | MIT | low | 传递 |
| core-util-is | 1.0.3 | MIT | low | 传递 |
| isarray | 1.0.0 | MIT | low | 传递 |
| process-nextick-args | 2.0.1 | MIT | low | 传递 |
| string_decoder | 1.1.1 | MIT | low | 传递 |
| util-deprecate | 1.0.2 | MIT | low | 传递 |
| nodemailer | 6.9.7 | MIT | low | 传递 |
| node-fetch | 2.7.0 | MIT | low | 传递 |
| whatwg-url | 5.0.0 | MIT | low | 传递 |
| tr46 | 0.0.3 | MIT | low | 传递 |
| webidl-conversions | 3.0.1 | BSD-2-Clause | low | 传递 |
| acorn | 8.11.2 | MIT | low | 传递 |
| @babel/parser | 7.23.0 | MIT | low | 传递 |
| magic-string | 0.30.5 | MIT | low | 传递 |
| @jridgewell/sourcemap-codec | 1.4.15 | MIT | low | 传递 |
| license-checker-rseidelsohn | 4.3.0 [例外] | SSPL | critical | 传递 |
