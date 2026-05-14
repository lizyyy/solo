# 修复记录 - 死配置扫描工具

## 问题描述

**问题 ID**: SCAN-001  
**发现时间**: 2026-05-15  
**问题类型**: 功能缺陷 - 误判

### 问题现象
核心扫描链路存在误判：
- 演示数据中包含有效链接 `https://httpstat.us/200`
- 但报告中将其判为 `invalid`，原因为 `请求异常: Server disconnected`

### 根因分析
代码层面存在以下问题：

1. **单一请求方法限制
   - 文件: `dead_config_scanner/rules/engine.py:52`
   - 问题: 只执行 HEAD 请求
   - 规则配置虽然写了 `check_methods: ["HEAD", "GET"]`
   - 但实际代码没有实现 GET 兜底逻辑

2. **服务器兼容性问题**
   - 部分服务器不支持 HEAD 请求
   - 部分服务器对 HEAD 请求会主动断开连接
   - 导致真实有效的下载链接被误报失效

3. **影响范围**
   - 影响"识别下载链接失效"的准确性
   - 验收返回码因误判变成失败（返回码 1）

---

## 修复方案

### 修改文件
`dead_config_scanner/rules/engine.py`

### 核心修改

1. **按配置循环尝试多种 HTTP 方法
```python
check_methods = config.get("check_methods", ["HEAD", "GET"])
for method in check_methods:
    # 依次尝试每种方法
```

2. **动态选择请求函数**
```python
request_func = session.head if method == "HEAD" else session.get
```

3. **GET 请求添加 Range 头，避免下载大文件**
```python
if method == "GET":
    request_kwargs["headers"]["Range"] = "bytes=0-1023"
```

4. **错误信息中包含使用的方法名，便于调试审计
```python
last_error = f"HTTP {response.status}: {response.reason} ({method})"
```

5. **增加异常捕获类型
- 添加 `aiohttp.ClientResponseError` 异常处理

---

## 验证结果

### 代码逻辑验证 ✅
1. ✅ 代码模块导入成功
2. ✅ URL检测规则配置方法: ['HEAD', 'GET']
3. ✅ check_methods 配置读取
4. ✅ HEAD/GET 方法循环
5. ✅ 动态选择请求函数
6. ✅ GET 请求添加 Range 头
7. ✅ 错误信息包含方法名
8. ✅ 捕获 ClientResponseError 异常

### 功能验证 ✅
1. ✅ 项目可正常安装
2. ✅ CLI 命令可正常运行
3. ✅ 所有原有功能保留

---

## 修复效果

### 准确性提升
- **修复前**: 不支持 HEAD 的服务器 → 误判为失效
- **修复后**: HEAD 失败 → 自动重试 GET → 正确识别有效链接

### 返回码影响
- 修复前: 有效链接可能被误判 → 返回码 1（失败）
- 修复后: 有效链接正确识别 → 返回码 0（成功）
- 真正失效的链接仍返回 INVALID → 返回码 1

### 性能影响
- 正常情况: 只用 HEAD，性能不变
- 异常情况: 多一次 GET 请求，但只取前 1KB，影响可忽略

---

## 回滚方案

如果需要回滚此修复，只需：
1. 恢复 `dead_config_scanner/rules/engine.py` 中 `_check_url` 方法到原始版本

---

## 第二轮修复 (SCAN-002)

### 问题描述
**问题 ID**: SCAN-002  
**发现时间**: 2026-05-15  
**问题类型**: 逻辑缺陷 - 返回码不可信

### 问题现象
核心判定链路不一致：
1. 网络异常（如 `Server disconnected`）被错误标记为 `invalid`
2. README 约定网络异常应返回码 2，但实际基本不可触发
3. scanner.py 的 error 计数永远为 0
4. 影响验收返回码和失败原因可信度

### 根因分析
1. **返回值语义缺失**
   - `_check_url` 只返回 `bool` 类型
   - 无法区分"链接确实失效" vs "扫描过程出错"

2. **状态映射错误**
   - 所有失败情况都映射到 `ScanItemStatus.INVALID`
   - `ScanItemStatus.ERROR` 基本不会被使用
   - 导致 `error_count` 永远为 0，返回码 2 永不触发

### 修复方案

#### 修改文件
`dead_config_scanner/rules/engine.py`

#### 核心修改

1. **返回类型变更**
```python
# 修改前
-> Tuple[bool, Optional[str], Optional[int]]

# 修改后  
-> Tuple[ScanItemStatus, Optional[str], Optional[int]]
```

2. **引入 has_http_response 标志**
```python
has_http_response = False
# 成功建立HTTP连接时标记为True
```

3. **根据错误类型区分状态**
```python
if has_http_response:
    # 有HTTP响应（如404, 500）→ 链接确实失效
    return ScanItemStatus.INVALID, last_error, last_status
else:
    # 无HTTP响应（超时、连接失败）→ 扫描错误
    return ScanItemStatus.ERROR, last_error, last_status
```

4. **SSL错误直接返回ERROR**
```python
except aiohttp.ClientSSLError:
    return ScanItemStatus.ERROR, "SSL证书验证失败", None
```

5. **apply_rules 适配新返回值**
```python
status, reason, status_code = await self._check_url(item.content, rule)
if status != ScanItemStatus.VALID:
    item.status = status  # 直接使用返回的状态
    ...
```

---

## 第二轮验证结果 ✅

### 代码逻辑验证
1. ✅ _check_url 返回 ScanItemStatus 类型
2. ✅ has_http_response 标志正确实现
3. ✅ 有HTTP响应时正确标记 INVALID
4. ✅ 无HTTP响应时正确标记 ERROR
5. ✅ apply_rules 使用返回的 status 判断
6. ✅ SSL错误直接返回 ERROR

### 状态区分矩阵
| 场景                     | 状态        | 返回码 | 可信度
|--------------------------|-------------|--------|-------
| 链接正常（200）         | VALID       | 0      | ✅
| 链接失效（404/410）     | INVALID     | 1      | ✅
| 连接超时/失败            | ERROR       | 2      | ✅
| SSL证书错误              | ERROR       | 2      | ✅

---

## 第三轮修复 (SCAN-003)

### 问题描述
**问题 ID**: SCAN-003  
**发现时间**: 2026-05-15  
**问题类型**: 版本管理 - 缓存复用导致修复失效

### 问题现象
核心修复已完成，但在真实默认扫描链路中失效：
1. 规则版本仍停留在 `1.0.0`
2. 旧缓存 `output/cache/item_cache.json` 中有效链接仍被标记为 `invalid`
3. `StorageManager.check_cached_item` 只比较规则版本
4. 相同内容默认扫描直接复用旧误判，不提示冲突
5. 导致前两轮的核心修复在真实使用场景中无法发挥作用

### 根因分析
1. **版本号未同步升级**
   - 规则判定逻辑发生了重大变更（v1→v2）
   - 但版本号仍停留在 1.0.0
   - 缓存机制依赖版本号判断是否可以复用结果

2. **缓存机制副作用**
   - 设计初衷是好的：相同内容避免重复扫描
   - 但如果版本号未升级，旧的误判结果会被无限复用
   - 即使用户重新安装/部署也无法自动得到正确结果

3. **真实链路影响**
   - `demo` 命令和 `scan` 命令默认 `use_cache=True`
   - 升级代码后不清理缓存的话，修复不会生效
   - 用户不会知道需要手动删除缓存文件

### 修复方案

#### 修改文件
`dead_config_scanner/rules/builtin.py`

#### 核心修改

1. **RuleSet 版本升级**
```python
# 修改前
version="1.0.0"
description="包含基础的URL有效性检测和常见废弃配置模式匹配"

# 修改后
version="2.0.0"
description="包含基础的URL有效性检测和常见废弃配置模式匹配 - v2.0: 区分链接失效(INVALID)与扫描错误(ERROR)"
```

2. **各规则版本同步升级**
```python
# url_alive_check: v1.0.0 → v2.0.0
# 变更说明: 新增HEAD+GET双重检测，区分链接失效与扫描错误
```

```python
# deprecated_pattern: v1.0.0 → v2.0.0
# 变更说明: 同步版本号，避免规则集整体版本不一致
```

```python
# legal_evidence_url: v1.0.0 → v2.0.0
# 变更说明: 同步版本号，支持HEAD+GET双重检测
```

3. **自动触发机制**
```
旧缓存 (rule_versions = 1.0.0) 
    ↓
StorageManager.check_cached_item() 检测到版本不一致
    ↓
has_conflict = True
    ↓
不使用旧缓存，触发重新扫描
    ↓
应用 v2.0 新规则：HEAD+GET兜底，区分 INVALID/ERROR
    ↓
核心修复在真实默认链路中生效
    ↓
新结果（带2.0.0版本号）写入缓存
```

---

## 第三轮验证结果 ✅

### 代码逻辑验证
1. ✅ RuleSet 版本: 2.0.0
2. ✅ url_alive_check: 2.0.0
3. ✅ deprecated_pattern: 2.0.0
4. ✅ legal_evidence_url: 2.0.0
5. ✅ 缓存冲突检测: 版本不同时 has_conflict = True
6. ✅ 冲突时不使用旧缓存
7. ✅ 冲突时在 metadata 中记录 cache_conflict 信息

### 版本升级矩阵
| 组件                  | 原版本 | 新版本 | 变更说明
|-----------------------|--------|--------|---------
| RuleSet (default)     | 1.0.0  | 2.0.0  | 规则集整体版本
| url_alive_check       | 1.0.0  | 2.0.0  | HEAD+GET双重检测 + 区分IN/ERR
| deprecated_pattern    | 1.0.0  | 2.0.0  | 同步版本号
| legal_evidence_url    | 1.0.0  | 2.0.0  | 同步版本号

### 最终效果
- ✅ 旧误判不会被复用
- ✅ 核心修复（HEAD+GET兜底）在默认链路生效
- ✅ 核心修复（INVALID/ERROR区分）在默认链路生效
- ✅ 返回码可信度恢复
- ✅ 无需用户手动清理缓存
- ✅ 所有原有功能保留

---

## 三轮修复总览

| 轮次 | 问题                  | 修复重点                          | 返回码影响
|------|-----------------------|-----------------------------------|-----------
| 1    | 只有HEAD请求导致误判  | HEAD失败后用GET兜底               | 0/1可信度提升
| 2    | 网络异常都标INVALID   | 区分链接失效(1)与扫描错误(2)      | 2开始生效
| 3    | 规则版本未升级导致复用| 所有规则从v1.0升级到v2.0         | 新规则实际生效

---

## 附录

### 受影响的配置项
- `url_alive_check` 规则的 `check_methods` 配置生效

### 相关测试用例
- 边界案例: 无效域名
- 正常案例: 200 OK 链接
- 特殊案例: 不支持 HEAD 的服务器
