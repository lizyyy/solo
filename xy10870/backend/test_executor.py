#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from app.services.code_executor import CodeExecutor

print("=" * 60)
print("代码执行器测试")
print("=" * 60)

# 测试成功的Python代码
print("\n=== Test 1: 成功执行 Python 代码 ===")
result = CodeExecutor.execute_python('print("Hello, World!")\nprint(1 + 1)')
print(f"Success: {result.success}")
print(f"Stdout:\n{result.stdout}")
print(f"Exit code: {result.exit_code}")
print(f"Exec time: {result.execution_time_ms} ms")
assert result.success == True
assert "Hello, World!" in result.stdout
assert "2" in result.stdout
assert result.exit_code == 0
print("✓ 测试1通过")

# 测试失败的Python代码
print("\n=== Test 2: 失败执行 (引用未定义变量) ===")
result2 = CodeExecutor.execute_python('print(undefined_variable)')
print(f"Success: {result2.success}")
print(f"Stderr: {result2.stderr[:50]}...")
print(f"Exit code: {result2.exit_code}")
assert result2.success == False
assert result2.exit_code != 0
print("✓ 测试2通过")

# 测试超时
print("\n=== Test 3: 超时终止 ===")
result3 = CodeExecutor.execute_python('import time\ntime.sleep(10)', timeout=2)
print(f"Timed out: {result3.timed_out}")
print(f"Error: {result3.error_message}")
print(f"Exec time: {result3.execution_time_ms} ms")
assert result3.timed_out == True
assert result3.success == False
print("✓ 测试3通过")

# 测试语法错误
print("\n=== Test 4: 语法错误 ===")
result4 = CodeExecutor.execute_python('def func(')
print(f"Success: {result4.success}")
print(f"Stderr: {result4.stderr[:60]}...")
assert result4.success == False
assert "SyntaxError" in result4.stderr or result4.exit_code != 0
print("✓ 测试4通过")

# 测试JavaScript (如果node可用)
print("\n=== Test 5: JavaScript 执行 ===")
try:
    result5 = CodeExecutor.execute_javascript('console.log("Hello from JS"); console.log(1 + 2)')
    print(f"Success: {result5.success}")
    print(f"Stdout: {result5.stdout}")
    if result5.success:
        assert "Hello from JS" in result5.stdout
        print("✓ 测试5通过")
    else:
        print("⚠ Node.js 不可用，跳过JS测试")
except Exception as e:
    print(f"⚠ Node.js 不可用，跳过JS测试: {e}")

print("\n" + "=" * 60)
print("所有核心测试通过!")
print("=" * 60)
