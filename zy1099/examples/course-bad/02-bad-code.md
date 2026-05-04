---
title: 包含错误代码的章节
description: 这个文件包含有语法错误和危险命令的代码片段
date: 2024-01-02
tags: [code, error, test]
---

# 包含错误代码的章节

## 语法错误的代码

### JavaScript 语法错误

```javascript
// 这是一个语法错误 - 缺少闭合括号
function broken() {
  console.log('Hello'
```

### Python 语法错误

```python
# 这是一个语法错误 - 缩进问题
def broken_function():
print('Hello')
```

## 运行时错误的代码

### JavaScript 运行时错误

```javascript
// 尝试访问 undefined 的属性
const obj = null;
console.log(obj.name);
```

### Python 运行时错误

```python
# 尝试除以零
result = 10 / 0
print(result)
```

## 危险命令

### 危险的 Shell 命令

```bash
# 危险命令 - 删除文件
rm -rf /important/data

# 危险命令 - 使用 sudo
sudo rm -rf /
```

### 危险的 Python 命令

```python
# 危险命令 - 执行系统命令
import os
os.system('rm -rf /')

# 危险命令 - 使用 eval
eval("__import__('os').system('rm -rf /')")
```

### 危险的 JavaScript 命令

```javascript
// 危险命令 - 使用 eval
eval('console.log("dangerous")');

// 危险命令 - 使用 Function 构造函数
const fn = new Function('return process.exit()');
fn();
```

## 正确的代码示例

### 正确的 JavaScript

```javascript
// 这是正确的代码
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet('World'));
```

### 正确的 Python

```python
# 这是正确的代码
def add(a, b):
    return a + b

print(add(1, 2))
```
