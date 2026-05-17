# 依赖升级破坏面分析报告
**依赖名称**: requests  
**版本升级**: `2.25.0` → `2.31.0`  
**扫描时间**: 2026-05-17T23:26:42.840557  
**扫描文件数**: 2  
**发现引用数**: 17  
**相关测试文件**: 1  

## 影响分组详情

### 🟡 HIGH: 函数签名变更，需要更新调用方式
- **受影响文件数**: 2
- **引用数**: 17
- **相关测试文件**: 1

#### 受影响文件列表:
- `sample.py`
- `test_sample.py`

#### 引用详情:
- `test_sample.py:2`
  ```python
  import requests
  ```
- `test_sample.py:14`
  ```python
  response = requests.get("https://example.com")
  ```
- `test_sample.py:14`
  ```python
  response = requests.get("https://example.com")
  ```
- `sample.py:1`
  ```python
  import requests
  ```
- `sample.py:2`
  ```python
  from requests import get, post
  ```
- `sample.py:2`
  ```python
  from requests import get, post
  ```
- `sample.py:3`
  ```python
  import requests.some_function
  ```
- `sample.py:4`
  ```python
  from requests.utils import helper
  ```
- `sample.py:7`
  ```python
  response = requests.get("https://example.com")
  ```
- `sample.py:11`
  ```python
  result = requests.post("https://example.com/api", json=data)
  ```

  ... 还有 7 个引用未显示

## 测试建议

### 🟡 P1 - 高: 优先测试签名变更的API调用

**行动项:**
1. 检查函数参数是否匹配新签名
2. 运行集成测试验证行为一致性
3. 更新类型注解和文档字符串

**涉及测试文件 (1):**
- `test_sample.py`

### 🟢 P3 - 低: 运行完整回归测试套件

**行动项:**
1. 运行完整测试套件排查潜在问题
2. 关注边界情况和边缘用例
3. 更新性能基准测试

**涉及测试文件 (1):**
- `test_sample.py`

---
*报告由 dep-break-scanner 自动生成于 2026-05-17T23:26:42.840557*
