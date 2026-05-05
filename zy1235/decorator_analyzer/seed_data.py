"""Seed data generation for example projects."""

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


def generate_seed_data(project_dir: Path) -> None:
    """Generate seed data for a new project."""
    snippets_dir = project_dir / "snippets"
    snippets_dir.mkdir(parents=True, exist_ok=True)
    
    (project_dir / ".decorator_analyzer").mkdir(exist_ok=True)
    
    _generate_decorators_yaml(project_dir)
    _generate_events_jsonl(project_dir)
    _generate_snippet_simple(snippets_dir)
    _generate_snippet_with_wraps(snippets_dir)
    _generate_snippet_with_args(snippets_dir)
    _generate_snippet_stacked(snippets_dir)
    _generate_snippet_class_decorator(snippets_dir)
    _generate_snippet_descriptor(snippets_dir)
    _generate_snippet_async(snippets_dir)
    _generate_snippet_bad_exception(snippets_dir)


def _generate_decorators_yaml(project_dir: Path) -> None:
    """Generate decorators.yaml with example data."""
    yaml_content = """# 装饰器定义配置文件
# 此文件包含样例数据，用于演示装饰器分析功能

functions:
  - name: process_data
    module: data_processor
    signature: (data: list[dict], filter_key: str = "active") -> list[dict]
    docstring: 处理数据并应用过滤器
    is_async: false
    is_method: false
    decorators:
      - name: timer
        type: simple
        line_number: 15
        has_wraps: false
        parameters: {}
        source_code: |
          def timer(func):
              def wrapper(*args, **kwargs):
                  start = time.time()
                  result = func(*args, **kwargs)
                  end = time.time()
                  print(f"{func.__name__} took {end-start}s")
                  return result
              return wrapper

  - name: fetch_api_data
    module: api_client
    signature: (endpoint: str, timeout: int = 30) -> dict
    docstring: 从 API 获取数据
    is_async: true
    is_method: false
    decorators:
      - name: retry
        type: with_args
        line_number: 23
        has_wraps: true
        parameters:
          max_attempts: "3"
          delay: "1.0"
        source_code: |
          def retry(max_attempts=3, delay=1.0):
              def decorator(func):
                  @functools.wraps(func)
                  async def wrapper(*args, **kwargs):
                      for attempt in range(max_attempts):
                          try:
                              return await func(*args, **kwargs)
                          except Exception as e:
                              if attempt == max_attempts - 1:
                                  raise
                              await asyncio.sleep(delay)
                  return wrapper
              return decorator

  - name: User.get_full_name
    module: models
    signature: () -> str
    docstring: 获取用户全名
    is_async: false
    is_method: true
    decorators:
      - name: property
        type: descriptor
        line_number: 42
        has_wraps: false
        parameters: {}

  - name: validate_request
    module: middleware
    signature: (request: Request, user: User) -> bool
    docstring: 验证请求权限
    is_async: false
    is_method: false
    decorators:
      - name: cache_result
        type: with_args
        line_number: 58
        has_wraps: true
        parameters:
          ttl: "300"
        source_code: |
          def cache_result(ttl=60):
              def decorator(func):
                  @functools.wraps(func)
                  def wrapper(*args, **kwargs):
                      key = cache_key(func, args, kwargs)
                      if key in cache:
                          return cache[key]
                      result = func(*args, **kwargs)
                      cache[key] = result
                      return result
                  return wrapper
              return decorator
      - name: log_access
        type: simple
        line_number: 57
        has_wraps: false
        parameters: {}
        source_code: |
          def log_access(func):
              def wrapper(*args, **kwargs):
                  logger.info(f"Accessing {func.__name__}")
                  return func(*args, **kwargs)
              return wrapper
"""
    (project_dir / "decorators.yaml").write_text(yaml_content, encoding="utf-8")


def _generate_events_jsonl(project_dir: Path) -> None:
    """Generate events.jsonl with example call events."""
    base_time = datetime.now() - timedelta(hours=1)
    
    events = [
        {
            "function_id": "process_data",
            "timestamp": (base_time + timedelta(seconds=0)).isoformat(),
            "caller": "main",
            "args": [["active", "inactive"]],
            "kwargs": {"filter_key": "active"},
            "return_value": ["filtered_data"],
            "exception": None,
            "decorator_stack": ["timer"],
            "duration_ms": 156.23,
        },
        {
            "function_id": "fetch_api_data",
            "timestamp": (base_time + timedelta(seconds=2)).isoformat(),
            "caller": "data_loader",
            "args": ["/api/users"],
            "kwargs": {"timeout": 30},
            "return_value": {"status": "ok", "data": []},
            "exception": None,
            "decorator_stack": ["retry"],
            "duration_ms": 245.78,
        },
        {
            "function_id": "validate_request",
            "timestamp": (base_time + timedelta(seconds=5)).isoformat(),
            "caller": "api_handler",
            "args": ["request_obj", "user_obj"],
            "kwargs": {},
            "return_value": True,
            "exception": None,
            "decorator_stack": ["log_access", "cache_result"],
            "duration_ms": 12.45,
        },
        {
            "function_id": "fetch_api_data",
            "timestamp": (base_time + timedelta(seconds=10)).isoformat(),
            "caller": "data_loader",
            "args": ["/api/orders"],
            "kwargs": {"timeout": 60},
            "return_value": None,
            "exception": "ConnectionTimeout",
            "decorator_stack": ["retry"],
            "duration_ms": 3000.0,
        },
    ]
    
    lines = [json.dumps(event, ensure_ascii=False) for event in events]
    (project_dir / "events.jsonl").write_text("\n".join(lines), encoding="utf-8")


def _generate_snippet_simple(snippets_dir: Path) -> None:
    """Generate a simple decorator example without wraps."""
    code = '''"""简单装饰器示例 - 无 functools.wraps"""

import time


def timer(func):
    """计时装饰器 - 不使用 functools.wraps
    
    风险：函数元数据（名称、文档字符串）会丢失
    """
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"函数执行耗时: {end - start:.4f}秒")
        return result
    return wrapper


@timer
def slow_function(n: int) -> int:
    """一个执行较慢的函数，用于演示计时装饰器。
    
    Args:
        n: 计算的上限
    
    Returns:
        从 1 到 n 的和
    """
    total = 0
    for i in range(n):
        total += i
        time.sleep(0.001)
    return total


if __name__ == "__main__":
    result = slow_function(100)
    print(f"结果: {result}")
    print(f"函数名: {slow_function.__name__}")  # 会显示 'wrapper' 而不是 'slow_function'
    print(f"文档字符串: {slow_function.__doc__}")  # 会显示 None 或 wrapper 的文档
'''
    (snippets_dir / "01_simple_decorator.py").write_text(code, encoding="utf-8")


def _generate_snippet_with_wraps(snippets_dir: Path) -> None:
    """Generate a decorator example with functools.wraps."""
    code = '''"""正确使用 functools.wraps 的装饰器示例"""

import functools
import time


def timer(func):
    """计时装饰器 - 使用 functools.wraps 保留元数据"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"[{func.__name__}] 执行耗时: {end - start:.4f}秒")
        return result
    return wrapper


@timer
def fast_function(n: int) -> int:
    """一个快速的计算函数。
    
    Args:
        n: 计算的上限
    
    Returns:
        从 1 到 n 的平方和
    """
    return sum(i * i for i in range(n))


if __name__ == "__main__":
    result = fast_function(1000)
    print(f"结果: {result}")
    print(f"函数名: {fast_function.__name__}")  # 正确显示 'fast_function'
    print(f"文档字符串: {fast_function.__doc__}")  # 正确显示原始文档
'''
    (snippets_dir / "02_decorator_with_wraps.py").write_text(code, encoding="utf-8")


def _generate_snippet_with_args(snippets_dir: Path) -> None:
    """Generate a decorator example with arguments."""
    code = '''"""带参数的装饰器示例"""

import functools
import time


def retry(max_attempts: int = 3, delay: float = 1.0, raise_on_fail: bool = True):
    """重试装饰器 - 带参数的装饰器工厂
    
    Args:
        max_attempts: 最大重试次数
        delay: 每次重试之间的延迟（秒）
        raise_on_fail: 最后一次失败后是否抛出异常
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    print(f"尝试 {attempt + 1}/{max_attempts} 失败: {e}")
                    if attempt < max_attempts - 1:
                        time.sleep(delay)
            
            if raise_on_fail and last_exception:
                raise last_exception
            return None
        return wrapper
    return decorator


@retry(max_attempts=3, delay=0.5)
def unreliable_operation(success_probability: float = 0.3) -> str:
    """一个可能失败的操作，用于演示重试装饰器。
    
    Args:
        success_probability: 成功的概率 (0.0 - 1.0)
    
    Returns:
        成功消息
    """
    import random
    if random.random() > success_probability:
        raise RuntimeError("操作失败！")
    return "操作成功！"


@retry(max_attempts=5, delay=0.2, raise_on_fail=False)
def tolerant_operation() -> str:
    """一个更容错的操作"""
    import random
    if random.random() > 0.5:
        raise RuntimeError("临时故障")
    return "成功！"


if __name__ == "__main__":
    try:
        result = unreliable_operation(0.5)
        print(f"结果: {result}")
    except Exception as e:
        print(f"最终失败: {e}")
'''
    (snippets_dir / "03_decorator_with_args.py").write_text(code, encoding="utf-8")


def _generate_snippet_stacked(snippets_dir: Path) -> None:
    """Generate an example with stacked decorators."""
    code = '''"""装饰器叠加示例 - 多个装饰器应用于同一函数"""

import functools
import time


def log_calls(func):
    """记录函数调用的装饰器"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f"[LOG] 调用 {func.__name__}，参数: args={args}, kwargs={kwargs}")
        result = func(*args, **kwargs)
        print(f"[LOG] {func.__name__} 返回: {result}")
        return result
    return wrapper


def measure_time(func):
    """测量执行时间的装饰器"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"[TIME] {func.__name__} 耗时: {end - start:.4f}秒")
        return result
    return wrapper


def validate_input(min_value: int = 0):
    """验证输入参数的装饰器（带参数）"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for arg in args:
                if isinstance(arg, (int, float)) and arg < min_value:
                    raise ValueError(f"参数值 {arg} 小于最小值 {min_value}")
            return func(*args, **kwargs)
        return wrapper
    return decorator


@log_calls
@measure_time
@validate_input(min_value=0)
def calculate_factorial(n: int) -> int:
    """计算阶乘的函数，应用了多个装饰器。
    
    装饰器执行顺序（从外到内）：
    1. log_calls - 记录调用
    2. measure_time - 测量时间
    3. validate_input - 验证输入
    4. 原始函数
    
    返回顺序（从内到外）：
    原始函数 -> validate_input -> measure_time -> log_calls
    """
    if n == 0:
        return 1
    result = 1
    for i in range(1, n + 1):
        result *= i
        time.sleep(0.001)
    return result


if __name__ == "__main__":
    try:
        result = calculate_factorial(5)
        print(f"\\n最终结果: 5! = {result}")
        
        print("\\n测试无效输入:")
        calculate_factorial(-1)
    except ValueError as e:
        print(f"捕获到预期错误: {e}")
'''
    (snippets_dir / "04_stacked_decorators.py").write_text(code, encoding="utf-8")


def _generate_snippet_class_decorator(snippets_dir: Path) -> None:
    """Generate a class decorator example."""
    code = '''"""类装饰器示例"""

import functools
from dataclasses import dataclass


def singleton(cls):
    """单例模式类装饰器
    
    确保一个类只有一个实例。
    """
    instances = {}
    
    @functools.wraps(cls)
    def wrapper(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    
    return wrapper


def add_logging(cls):
    """为类的所有方法添加日志的装饰器"""
    class Wrapped(cls):
        def __getattribute__(self, name):
            attr = super().__getattribute__(name)
            if callable(attr) and not name.startswith("__"):
                @functools.wraps(attr)
                def logged_method(*args, **kwargs):
                    print(f"[CLASS LOG] 调用 {cls.__name__}.{name}")
                    return attr(*args, **kwargs)
                return logged_method
            return attr
    
    Wrapped.__name__ = cls.__name__
    Wrapped.__doc__ = cls.__doc__
    return Wrapped


@singleton
class DatabaseConnection:
    """数据库连接类 - 使用单例装饰器"""
    
    def __init__(self, connection_string: str = "default://localhost"):
        self.connection_string = connection_string
        self.connected = False
        print(f"创建新的 DatabaseConnection 实例")
    
    def connect(self) -> bool:
        self.connected = True
        print(f"连接到 {self.connection_string}")
        return True
    
    def disconnect(self) -> bool:
        self.connected = False
        print(f"断开与 {self.connection_string} 的连接")
        return True


@add_logging
@dataclass
class UserService:
    """用户服务类 - 使用日志装饰器"""
    
    service_name: str = "user_service"
    
    def create_user(self, name: str, email: str) -> dict:
        """创建新用户"""
        return {"id": 1, "name": name, "email": email}
    
    def get_user(self, user_id: int) -> dict:
        """获取用户信息"""
        return {"id": user_id, "name": "Test User"}


if __name__ == "__main__":
    print("=== 测试单例装饰器 ===")
    db1 = DatabaseConnection("postgres://localhost/mydb")
    db2 = DatabaseConnection("postgres://localhost/otherdb")
    
    print(f"db1 和 db2 是同一个实例: {db1 is db2}")
    print(f"db1.connection_string: {db1.connection_string}")
    print(f"db2.connection_string: {db2.connection_string}")
    
    print("\\n=== 测试日志装饰器 ===")
    service = UserService()
    user = service.create_user("张三", "zhangsan@example.com")
    print(f"创建用户结果: {user}")
'''
    (snippets_dir / "05_class_decorator.py").write_text(code, encoding="utf-8")


def _generate_snippet_descriptor(snippets_dir: Path) -> None:
    """Generate descriptor and bound method examples."""
    code = '''"""描述符（Descriptor）和绑定方法示例"""

from typing import Any


class ValidatedAttribute:
    """验证属性描述符
    
    实现了描述符协议，用于验证属性值。
    """
    
    def __init__(self, name: str, validator=None):
        self.name = name
        self.validator = validator
        self._storage_name = f"_validated_{name}"
    
    def __get__(self, instance: Any, owner: type) -> Any:
        if instance is None:
            return self
        return getattr(instance, self._storage_name, None)
    
    def __set__(self, instance: Any, value: Any) -> None:
        if self.validator is not None:
            if not self.validator(value):
                raise ValueError(f"属性 {self.name} 的值 {value!r} 无效")
        setattr(instance, self._storage_name, value)
    
    def __delete__(self, instance: Any) -> None:
        if hasattr(instance, self._storage_name):
            delattr(instance, self._storage_name)


class CachedProperty:
    """缓存属性描述符
    
    类似于 @property，但只计算一次值并缓存结果。
    """
    
    def __init__(self, func):
        self.func = func
        self.name = func.__name__
        self.__doc__ = func.__doc__
    
    def __get__(self, instance: Any, owner: type) -> Any:
        if instance is None:
            return self
        
        if self.name not in instance.__dict__:
            instance.__dict__[self.name] = self.func(instance)
        
        return instance.__dict__[self.name]


class Person:
    """人类 - 使用描述符验证属性"""
    
    age = ValidatedAttribute(
        "age",
        validator=lambda x: isinstance(x, int) and 0 <= x <= 150
    )
    
    email = ValidatedAttribute(
        "email",
        validator=lambda x: isinstance(x, str) and "@" in x
    )
    
    def __init__(self, name: str):
        self.name = name
    
    @property
    def full_name(self) -> str:
        """使用 @property 装饰器的属性"""
        return self.name.upper()
    
    @CachedProperty
    def expensive_computation(self) -> int:
        """使用自定义缓存描述符的属性"""
        print("执行耗时计算...")
        import time
        time.sleep(0.1)
        return sum(i * i for i in range(10000))
    
    @staticmethod
    def is_adult(age: int) -> bool:
        """静态方法 - 不绑定到实例"""
        return age >= 18
    
    @classmethod
    def create_child(cls, name: str) -> "Person":
        """类方法 - 绑定到类"""
        child = cls(name)
        child.age = 0
        return child


if __name__ == "__main__":
    print("=== 测试 ValidatedAttribute ===")
    p = Person("张三")
    
    try:
        p.age = 25
        print(f"设置 age=25 成功")
    except ValueError as e:
        print(f"设置 age=25 失败: {e}")
    
    try:
        p.age = 200
        print(f"设置 age=200 成功")
    except ValueError as e:
        print(f"设置 age=200 失败: {e}")
    
    print("\\n=== 测试 CachedProperty ===")
    p2 = Person("李四")
    print("第一次访问 expensive_computation:")
    result1 = p2.expensive_computation
    print(f"结果: {result1}")
    
    print("\\n第二次访问 expensive_computation (应该直接返回缓存):")
    result2 = p2.expensive_computation
    print(f"结果: {result2}")
    
    print("\\n=== 测试 staticmethod 和 classmethod ===")
    print(f"Person.is_adult(20): {Person.is_adult(20)}")
    print(f"Person.is_adult(15): {Person.is_adult(15)}")
    
    child = Person.create_child("小明")
    print(f"create_child 创建的对象: {child.name}, age={child.age}")
'''
    (snippets_dir / "06_descriptor_methods.py").write_text(code, encoding="utf-8")


def _generate_snippet_async(snippets_dir: Path) -> None:
    """Generate async decorator examples."""
    code = '''"""异步装饰器示例"""

import asyncio
import functools
import time
from typing import Callable, Any


def async_timer(func: Callable[..., Any]) -> Callable[..., Any]:
    """异步函数的计时装饰器"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.time()
        result = await func(*args, **kwargs)
        end = time.time()
        print(f"[ASYNC TIMER] {func.__name__} 耗时: {end - start:.4f}秒")
        return result
    return wrapper


def async_retry(max_attempts: int = 3, delay: float = 1.0):
    """带参数的异步重试装饰器"""
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    print(f"[ASYNC RETRY] 尝试 {attempt + 1}/{max_attempts} 失败: {e}")
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(delay)
            
            if last_exception:
                raise last_exception
            return None
        return wrapper
    return decorator


def sync_to_async(func: Callable[..., Any]) -> Callable[..., Any]:
    """将同步函数包装为异步函数的装饰器
    
    注意：这只是一个简单示例，实际生产中应该使用
    asyncio.to_thread 或 concurrent.futures.ThreadPoolExecutor
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: func(*args, **kwargs)
        )
    return wrapper


@async_timer
async def fetch_data(url: str) -> dict:
    """模拟异步获取数据"""
    print(f"开始获取 {url}")
    await asyncio.sleep(0.5)
    return {"url": url, "status": 200, "data": "sample data"}


@async_retry(max_attempts=3, delay=0.5)
async def unreliable_api_call(success_probability: float = 0.3) -> str:
    """模拟不可靠的 API 调用"""
    import random
    if random.random() > success_probability:
        raise ConnectionError("网络连接失败")
    return "API 调用成功！"


@sync_to_async
def blocking_operation(n: int) -> int:
    """阻塞操作，被包装为异步"""
    print(f"执行阻塞操作，n={n}")
    total = 0
    for i in range(n):
        total += i
        time.sleep(0.001)
    return total


async def main():
    print("=== 测试 async_timer ===")
    result = await fetch_data("https://api.example.com/data")
    print(f"fetch_data 结果: {result}")
    
    print("\\n=== 测试 async_retry ===")
    try:
        result = await unreliable_api_call(0.4)
        print(f"unreliable_api_call 结果: {result}")
    except ConnectionError as e:
        print(f"最终失败: {e}")
    
    print("\\n=== 测试 sync_to_async ===")
    result = await blocking_operation(100)
    print(f"blocking_operation 结果: {result}")
    
    print("\\n=== 测试并发调用 ===")
    start = time.time()
    results = await asyncio.gather(
        fetch_data("https://api.example.com/users"),
        fetch_data("https://api.example.com/posts"),
        fetch_data("https://api.example.com/comments"),
    )
    end = time.time()
    print(f"并发调用总耗时: {end - start:.4f}秒")
    for r in results:
        print(f"  - {r['url']}")


if __name__ == "__main__":
    asyncio.run(main())
'''
    (snippets_dir / "07_async_decorators.py").write_text(code, encoding="utf-8")


def _generate_snippet_bad_exception(snippets_dir: Path) -> None:
    """Generate examples of bad exception handling in decorators."""
    code = '''"""异常吞掉风险示例

这些示例展示了装饰器中常见的异常处理错误模式。
"""

import functools
import time


def silent_exception(func):
    """⚠️ 危险的装饰器：吞掉所有异常
    
    风险：
    1. 错误被静默忽略，难以调试
    2. 返回 None 可能导致后续代码崩溃
    3. 违反了"快速失败"原则
    """
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except:  # ❌ 捕获所有异常，包括 KeyboardInterrupt 和 SystemExit
            return None  # ❌ 静默返回 None
    return wrapper


def catch_all_exception(func):
    """⚠️ 有风险的装饰器：捕获 Exception 但不重新抛出
    
    比 silent_exception 稍好，但仍然危险。
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:  # ⚠️ 捕获所有普通异常
            print(f"发生错误: {e}")  # ⚠️ 只打印，不重新抛出
            # ❌ 没有重新 raise
            return None
    return wrapper


def retry_with_swallow(func):
    """⚠️ 有缺陷的重试装饰器
    
    问题：最后一次失败也被吞掉了。
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        for attempt in range(3):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                print(f"尝试 {attempt + 1} 失败: {e}")
        # ❌ 循环结束后没有重新抛出最后一个异常
        return None
    return wrapper


def good_retry_pattern(func):
    """✅ 正确的重试模式：保存并重新抛出最后一个异常"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        last_exception = None
        for attempt in range(3):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                print(f"尝试 {attempt + 1} 失败: {e}")
        
        if last_exception is not None:
            raise last_exception  # ✅ 重新抛出最后一个异常
        return None
    return wrapper


def exception_logger(func):
    """✅ 良好的异常处理模式：记录日志后重新抛出"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ValueError as e:
            print(f"[LOG] 验证错误: {e}")
            raise  # ✅ 重新抛出
        except RuntimeError as e:
            print(f"[LOG] 运行时错误: {e}")
            raise  # ✅ 重新抛出
    return wrapper


@silent_exception
def dangerous_divide(a: int, b: int) -> float:
    """危险的除法：异常被吞掉"""
    return a / b


@catch_all_exception
def risky_api_call(url: str) -> dict:
    """有风险的 API 调用"""
    if "error" in url:
        raise ConnectionError("连接失败")
    return {"status": "ok"}


@retry_with_swallow
def flaky_operation() -> str:
    """不稳定的操作：最后一次失败被吞掉"""
    raise ValueError("操作始终失败")


@good_retry_pattern
def better_flaky_operation() -> str:
    """更好的实现：最后一次失败会被抛出"""
    raise ValueError("操作始终失败")


@exception_logger
def validate_user(age: int) -> bool:
    """验证用户年龄"""
    if age < 0:
        raise ValueError("年龄不能为负数")
    if age < 18:
        raise RuntimeError("用户未成年")
    return True


if __name__ == "__main__":
    print("=== 测试 silent_exception (危险模式) ===")
    result = dangerous_divide(10, 0)
    print(f"dangerous_divide(10, 0) 返回: {result}")
    print("⚠️  注意：ZeroDivisionError 被静默吞掉了！")
    print()
    
    print("=== 测试 catch_all_exception (有风险模式) ===")
    result = risky_api_call("http://error.example.com")
    print(f"risky_api_call('error url') 返回: {result}")
    print("⚠️  注意：ConnectionError 只被打印，没有重新抛出！")
    print()
    
    print("=== 测试 retry_with_swallow (有缺陷模式) ===")
    try:
        result = flaky_operation()
        print(f"flaky_operation() 返回: {result}")
        print("⚠️  注意：最后一次 ValueError 被吞掉了！")
    except ValueError as e:
        print(f"捕获到异常: {e}")
    print()
    
    print("=== 测试 good_retry_pattern (正确模式) ===")
    try:
        result = better_flaky_operation()
        print(f"better_flaky_operation() 返回: {result}")
    except ValueError as e:
        print(f"✅ 正确捕获到异常: {e}")
    print()
    
    print("=== 测试 exception_logger (良好模式) ===")
    try:
        validate_user(-5)
    except ValueError as e:
        print(f"✅ 异常被记录后重新抛出: {e}")
'''
    (snippets_dir / "08_exception_swallow_risk.py").write_text(code, encoding="utf-8")
