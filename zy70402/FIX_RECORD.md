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

## 附录

### 受影响的配置项
- `url_alive_check` 规则的 `check_methods` 配置生效

### 相关测试用例
- 边界案例: 无效域名
- 正常案例: 200 OK 链接
- 特殊案例: 不支持 HEAD 的服务器
