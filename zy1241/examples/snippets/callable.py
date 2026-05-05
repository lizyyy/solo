"""__call__ 魔术方法示例"""


class Multiplier:
    """可调用的乘法器"""

    def __init__(self, factor):
        self.factor = factor

    def __call__(self, x):
        return x * self.factor


class FunctionRegistry:
    """函数注册表 - 使用 __call__ 作为装饰器"""

    def __init__(self):
        self.functions = {}

    def __call__(self, name=None):
        def decorator(func):
            key = name or func.__name__
            self.functions[key] = func
            return func
        return decorator

    def execute(self, name, *args, **kwargs):
        if name in self.functions:
            return self.functions[name](*args, **kwargs)
        raise ValueError(f"函数 '{name}' 未注册")


class Trace:
    """追踪函数调用的装饰器类"""

    def __init__(self, func):
        self.func = func
        self.call_count = 0

    def __call__(self, *args, **kwargs):
        self.call_count += 1
        print(f"[Trace] 调用 {self.func.__name__} (次数: {self.call_count})")
        print(f"  args: {args}")
        print(f"  kwargs: {kwargs}")
        result = self.func(*args, **kwargs)
        print(f"  result: {result}")
        return result


class DataProcessor:
    """数据处理器管道"""

    def __init__(self):
        self.pipeline = []

    def add_step(self, step):
        self.pipeline.append(step)
        return self

    def __call__(self, data):
        result = data
        for step in self.pipeline:
            result = step(result)
        return result


if __name__ == "__main__":
    print("=== 测试 Multiplier ===")
    times2 = Multiplier(2)
    times3 = Multiplier(3)

    print(f"times2(5) = {times2(5)}")
    print(f"times3(5) = {times3(5)}")
    print(f"times2(times3(2)) = {times2(times3(2))}")

    print("\n=== 测试 FunctionRegistry ===")
    registry = FunctionRegistry()

    @registry("add")
    def add(a, b):
        return a + b

    @registry()
    def multiply(a, b):
        return a * b

    print(f"已注册函数: {list(registry.functions.keys())}")
    print(f"registry.execute('add', 2, 3) = {registry.execute('add', 2, 3)}")
    print(f"registry.execute('multiply', 2, 3) = {registry.execute('multiply', 2, 3)}")

    print("\n=== 测试 Trace ===")

    @Trace
    def greet(name, greeting="Hello"):
        return f"{greeting}, {name}!"

    greet("Alice")
    greet("Bob", greeting="Hi")
    print(f"greet.call_count = {greet.call_count}")

    print("\n=== 测试 DataProcessor ===")
    processor = DataProcessor()
    processor.add_step(lambda x: x * 2)
    processor.add_step(lambda x: x + 1)
    processor.add_step(str)

    result = processor(5)
    print(f"processor(5) = {result!r} (类型: {type(result).__name__})")
