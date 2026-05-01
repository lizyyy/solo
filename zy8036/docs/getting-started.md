# SDK 快速入门

## 安装

使用 pip 安装 SDK:

```bash python:demo:install
echo "Installing my-sdk..."
```

## 基础用法

一个简单的 Python 示例:

```python python:demo:success
print("Hello from Python!")
```

## 环境变量示例

需要设置环境变量的示例:

```bash shell:demo:env_demo env:MY_SECRET_KEY
echo "My secret key is: $MY_SECRET_KEY"
```

## 超时测试

这个示例会超时（设置短超时来测试）:

```python python:demo:timeout
import time
time.sleep(10)
print("Completed after delay")
```

## JavaScript 示例

```javascript js:demo:js_test
console.log("Hello from JavaScript");
```

## 失败示例

这个示例会失败:

```python python:demo:fail_test
print("This will fail")
raise ValueError("Intentional failure")
```

## 数学运算示例

```python python:demo:math
result = 2 + 3 * 4
print(f"Result: {result}")
```

## Shell 命令示例

```bash shell:demo:echo_test
echo "Hello from Shell!"
date
```