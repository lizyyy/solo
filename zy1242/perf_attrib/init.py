"""
init 模块 - 生成样例文件帮助快速上手
"""

import os
import json
import pstats
import tempfile
import subprocess
from typing import Dict, List, Any
from datetime import datetime


def generate_examples(output_dir: str, force: bool = False) -> Dict[str, Any]:
    """
    生成样例文件
    
    Args:
        output_dir: 输出目录
        force: 是否强制覆盖已存在的文件
    
    Returns:
        包含生成结果的字典
    """
    result = {
        "success": False,
        "files": [],
        "message": ""
    }
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    elif not force and len(os.listdir(output_dir)) > 0:
        result["message"] = f"目录 {output_dir} 已存在且非空。使用 --force 强制覆盖。"
        return result
    
    example_files = []
    
    slow_script_path = os.path.join(output_dir, "slow_script.py")
    _create_slow_script(slow_script_path)
    example_files.append(slow_script_path)
    
    cprofile_path = os.path.join(output_dir, "cprofile_example.prof")
    _create_cprofile_example(cprofile_path, slow_script_path)
    example_files.append(cprofile_path)
    
    pystats_path = os.path.join(output_dir, "pystats_example.json")
    _create_pystats_example(pystats_path)
    example_files.append(pystats_path)
    
    benchmark_path = os.path.join(output_dir, "benchmark_example.json")
    _create_benchmark_example(benchmark_path)
    example_files.append(benchmark_path)
    
    timeit_path = os.path.join(output_dir, "timeit_example.txt")
    _create_timeit_example(timeit_path)
    example_files.append(timeit_path)
    
    cprofile_text_path = os.path.join(output_dir, "cprofile_text_example.txt")
    _create_cprofile_text_example(cprofile_text_path)
    example_files.append(cprofile_text_path)
    
    result["success"] = True
    result["files"] = example_files
    result["message"] = f"成功生成 {len(example_files)} 个样例文件"
    
    return result


def _create_slow_script(file_path: str):
    """
    创建一个包含各种性能问题的慢脚本样例
    """
    script = '''"""
性能问题演示脚本
包含以下问题：
1. CPU 密集型计算
2. 重复 I/O 操作
3. 过度内存分配
4. 函数调用扇出
"""

import time
import os


def slow_calculation(n: int) -> int:
    result = 0
    for i in range(n):
        for j in range(n):
            result += i * j
    return result


def repeated_file_io():
    for i in range(100):
        with open("/tmp/temp_file.txt", "w") as f:
            f.write(f"iteration {i}")
        with open("/tmp/temp_file.txt", "r") as f:
            content = f.read()
    return content


def excessive_memory_allocation():
    big_list = []
    for i in range(10000):
        temp_list = list(range(i))
        big_list.extend(temp_list)
    return len(big_list)


def function_a():
    time.sleep(0.01)
    return function_b()


def function_b():
    time.sleep(0.01)
    return function_c()


def function_c():
    time.sleep(0.01)
    return "done"


def deep_call_chain():
    results = []
    for _ in range(50):
        results.append(function_a())
    return results


def main():
    print("开始性能测试...")
    
    result1 = slow_calculation(200)
    print(f"计算完成: {result1}")
    
    result2 = repeated_file_io()
    print(f"I/O 完成")
    
    result3 = excessive_memory_allocation()
    print(f"内存操作完成: {result3} 元素")
    
    result4 = deep_call_chain()
    print(f"调用链完成")
    
    print("所有任务完成!")


if __name__ == "__main__":
    main()
'''
    
    with open(file_path, "w") as f:
        f.write(script)


def _create_cprofile_example(file_path: str, script_path: str):
    """
    运行脚本并生成 cProfile 文件
    """
    try:
        cmd = [
            "python", "-m", "cProfile",
            "-o", file_path,
            script_path
        ]
        subprocess.run(cmd, capture_output=True, timeout=30)
    except Exception:
        _create_mock_cprofile(file_path)


def _create_mock_cprofile(file_path: str):
    """
    创建模拟的 cProfile 数据（如果无法运行真实脚本）
    """
    import cProfile
    import io
    
    profiler = cProfile.Profile()
    profiler.enable()
    
    def mock_slow():
        import time
        for _ in range(10000):
            pass
        time.sleep(0.001)
    
    def mock_io():
        import time
        time.sleep(0.002)
    
    mock_slow()
    mock_io()
    mock_slow()
    
    profiler.disable()
    
    profiler.dump_stats(file_path)


def _create_pystats_example(file_path: str):
    """
    创建 py-spy 采样 JSON 样例
    """
    pystats_data = {
        "metadata": {
            "version": "1.0",
            "sampler": "py-spy",
            "duration_seconds": 5.2,
            "sample_count": 156,
            "timestamp": datetime.now().isoformat()
        },
        "samples": [
            {
                "count": 45,
                "percentage": 28.8,
                "frames": [
                    {"file": "slow_script.py", "line": 15, "function": "slow_calculation"},
                    {"file": "slow_script.py", "line": 85, "function": "main"}
                ]
            },
            {
                "count": 30,
                "percentage": 19.2,
                "frames": [
                    {"file": "slow_script.py", "line": 45, "function": "excessive_memory_allocation"},
                    {"file": "slow_script.py", "line": 88, "function": "main"}
                ]
            },
            {
                "count": 25,
                "percentage": 16.0,
                "frames": [
                    {"file": "slow_script.py", "line": 28, "function": "repeated_file_io"},
                    {"file": "slow_script.py", "line": 86, "function": "main"}
                ]
            },
            {
                "count": 20,
                "percentage": 12.8,
                "frames": [
                    {"file": "slow_script.py", "line": 70, "function": "function_a"},
                    {"file": "slow_script.py", "line": 91, "function": "main"}
                ]
            },
            {
                "count": 15,
                "percentage": 9.6,
                "frames": [
                    {"file": "slow_script.py", "line": 75, "function": "function_b"},
                    {"file": "slow_script.py", "line": 70, "function": "function_a"},
                    {"file": "slow_script.py", "line": 91, "function": "main"}
                ]
            },
            {
                "count": 10,
                "percentage": 6.4,
                "frames": [
                    {"file": "slow_script.py", "line": 80, "function": "function_c"},
                    {"file": "slow_script.py", "line": 75, "function": "function_b"},
                    {"file": "slow_script.py", "line": 70, "function": "function_a"},
                    {"file": "slow_script.py", "line": 91, "function": "main"}
                ]
            }
        ],
        "by_function": [
            {
                "function": "slow_calculation",
                "file": "slow_script.py",
                "line": 15,
                "count": 45,
                "percentage": 28.8
            },
            {
                "function": "excessive_memory_allocation",
                "file": "slow_script.py",
                "line": 45,
                "count": 30,
                "percentage": 19.2
            },
            {
                "function": "repeated_file_io",
                "file": "slow_script.py",
                "line": 28,
                "count": 25,
                "percentage": 16.0
            },
            {
                "function": "function_a",
                "file": "slow_script.py",
                "line": 70,
                "count": 20,
                "percentage": 12.8
            },
            {
                "function": "function_b",
                "file": "slow_script.py",
                "line": 75,
                "count": 15,
                "percentage": 9.6
            },
            {
                "function": "function_c",
                "file": "slow_script.py",
                "line": 80,
                "count": 10,
                "percentage": 6.4
            }
        ]
    }
    
    with open(file_path, "w") as f:
        json.dump(pystats_data, f, indent=2)


def _create_benchmark_example(file_path: str):
    """
    创建 pytest-benchmark JSON 样例
    """
    benchmark_data = {
        "machine_info": {
            "node": "test-machine",
            "processor": "x86_64",
            "cpu_count": 8,
            "ram": "16GB"
        },
        "commit_info": {
            "id": "abc123",
            "time": datetime.now().isoformat()
        },
        "benchmarks": [
            {
                "name": "test_slow_calculation",
                "fullname": "tests/test_benchmark.py::test_slow_calculation",
                "params": None,
                "extra_info": {},
                "options": {
                    "disable_gc": False,
                    "timer": "time.perf_counter",
                    "min_rounds": 5,
                    "max_time": 1.0,
                    "min_time": 1e-05
                },
                "stats": {
                    "min": 0.123456,
                    "max": 0.145678,
                    "mean": 0.134567,
                    "stddev": 0.005678,
                    "median": 0.132456,
                    "iqr": 0.008901,
                    "q1": 0.128901,
                    "q3": 0.137802,
                    "iqr_outliers": 0,
                    "stddev_outliers": 0,
                    "rounds": 10,
                    "iterations": 1,
                    "total": 1.345678
                }
            },
            {
                "name": "test_memory_allocation",
                "fullname": "tests/test_benchmark.py::test_memory_allocation",
                "params": None,
                "extra_info": {},
                "options": {
                    "disable_gc": False,
                    "timer": "time.perf_counter",
                    "min_rounds": 5,
                    "max_time": 1.0,
                    "min_time": 1e-05
                },
                "stats": {
                    "min": 0.087654,
                    "max": 0.102345,
                    "mean": 0.094567,
                    "stddev": 0.004321,
                    "median": 0.093456,
                    "iqr": 0.006543,
                    "q1": 0.090123,
                    "q3": 0.096666,
                    "iqr_outliers": 0,
                    "stddev_outliers": 0,
                    "rounds": 10,
                    "iterations": 1,
                    "total": 0.945670
                }
            },
            {
                "name": "test_repeated_io",
                "fullname": "tests/test_benchmark.py::test_repeated_io",
                "params": None,
                "extra_info": {},
                "options": {
                    "disable_gc": False,
                    "timer": "time.perf_counter",
                    "min_rounds": 5,
                    "max_time": 1.0,
                    "min_time": 1e-05
                },
                "stats": {
                    "min": 0.156789,
                    "max": 0.189012,
                    "mean": 0.172345,
                    "stddev": 0.009876,
                    "median": 0.170123,
                    "iqr": 0.012345,
                    "q1": 0.163456,
                    "q3": 0.175801,
                    "iqr_outliers": 0,
                    "stddev_outliers": 0,
                    "rounds": 10,
                    "iterations": 1,
                    "total": 1.723450
                }
            }
        ]
    }
    
    with open(file_path, "w") as f:
        json.dump(benchmark_data, f, indent=2)


def _create_timeit_example(file_path: str):
    """
    创建 timeit 输出样例
    """
    timeit_output = '''100 loops, best of 5: 12.3 msec per loop
slow_calculation: 1234567 function calls in 12.345 seconds

   Ordered by: cumulative time

   ncalls  tottime  percall  cumtime  percall filename:lineno(function)
        1    0.001    0.001   12.345   12.345 <string>:1(<module>)
        1    8.234    8.234   12.344   12.344 slow_script.py:15(slow_calculation)
  1000000    2.100    0.000    2.100    0.000 {method 'append' of 'list' objects}
      100    1.010    0.010    1.010    0.010 {built-in method builtins.sleep}
        1    0.000    0.000    0.000    0.000 {method 'disable' of '_lsprof.Profiler' objects}
'''
    
    with open(file_path, "w") as f:
        f.write(timeit_output)


def _create_cprofile_text_example(file_path: str):
    """
    创建 cProfile 文本格式样例
    """
    text_output = '''Sat May  4 12:00:00 2024    profile.prof

         123456 function calls (120000 primitive calls) in 12.345 seconds

   Ordered by: cumulative time

   ncalls  tottime  percall  cumtime  percall filename:lineno(function)
        1    0.000    0.000   12.345   12.345 slow_script.py:95(main)
        1    8.234    8.234   12.344   12.344 slow_script.py:15(slow_calculation)
      100    1.500    0.015    2.500    0.025 slow_script.py:28(repeated_file_io)
        1    1.200    1.200    1.200    1.200 slow_script.py:45(excessive_memory_allocation)
       50    0.500    0.010    1.000    0.020 slow_script.py:70(function_a)
       50    0.300    0.006    0.500    0.010 slow_script.py:75(function_b)
       50    0.200    0.004    0.200    0.004 slow_script.py:80(function_c)
      200    0.300    0.002    0.300    0.002 {built-in method builtins.sleep}
  1000000    0.110    0.000    0.110    0.000 {method 'write' of '_io.TextIOWrapper' objects}
      100    0.100    0.001    0.100    0.001 {built-in method io.open}
        1    0.001    0.001    0.001    0.001 {built-in method builtins.print}

   Ordered by: internal time

   ncalls  tottime  percall  cumtime  percall filename:lineno(function)
        1    8.234    8.234   12.344   12.344 slow_script.py:15(slow_calculation)
      100    1.500    0.015    2.500    0.025 slow_script.py:28(repeated_file_io)
        1    1.200    1.200    1.200    1.200 slow_script.py:45(excessive_memory_allocation)
       50    0.500    0.010    1.000    0.020 slow_script.py:70(function_a)
       50    0.300    0.006    0.500    0.010 slow_script.py:75(function_b)
      200    0.300    0.002    0.300    0.002 {built-in method builtins.sleep}
  1000000    0.110    0.000    0.110    0.000 {method 'write' of '_io.TextIOWrapper' objects}
       50    0.200    0.004    0.200    0.004 slow_script.py:80(function_c)
      100    0.100    0.001    0.100    0.001 {built-in method io.open}
        1    0.001    0.001    0.001    0.001 {built-in method builtins.print}
'''
    
    with open(file_path, "w") as f:
        f.write(text_output)
