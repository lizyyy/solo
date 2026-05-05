#!/usr/bin/env python3
"""init 命令：初始化示例数据目录。"""

import json
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import yaml


def init_command(args) -> int:
    """执行 init 命令。"""
    target_dir = Path(args.directory).resolve()
    force = args.force

    print(f"初始化示例数据到: {target_dir}")

    try:
        target_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        print(f"错误: 无法创建目录 {target_dir}，权限不足", file=sys.stderr)
        return 1

    snippets_dir = target_dir / "snippets"
    snippets_dir.mkdir(exist_ok=True)

    pipelines_path = target_dir / "pipelines.yaml"
    events_path = target_dir / "events.jsonl"

    if not force:
        existing_files = []
        if pipelines_path.exists():
            existing_files.append("pipelines.yaml")
        if events_path.exists():
            existing_files.append("events.jsonl")
        if any(snippets_dir.iterdir()):
            existing_files.append("snippets/*")

        if existing_files:
            print(f"错误: 以下文件已存在: {', '.join(existing_files)}")
            print("使用 -f 或 --force 强制覆盖")
            return 1

    create_pipelines_yaml(pipelines_path)
    create_events_jsonl(events_path)
    create_snippets(snippets_dir)

    print("\n初始化完成！创建了以下文件:")
    print(f"  - {pipelines_path.relative_to(target_dir)}")
    print(f"  - {events_path.relative_to(target_dir)}")
    print(f"  - {snippets_dir.relative_to(target_dir)}/")
    for f in sorted(snippets_dir.iterdir()):
        print(f"    - {f.name}")

    print("\n下一步:")
    print("  1. 运行 'pitfall analyze' 分析示例数据")
    print("  2. 修改 snippets 中的代码后再次分析")
    print("  3. 使用 'pitfall compare' 对比改进效果")

    return 0


def create_pipelines_yaml(path: Path):
    """创建示例 pipelines.yaml 文件。"""
    pipelines = {
        "version": "1.0",
        "pipelines": [
            {
                "name": "data_processing",
                "description": "数据处理流水线",
                "stages": [
                    {
                        "name": "reader",
                        "type": "iterator",
                        "class": "FileReader",
                        "description": "读取文件数据",
                    },
                    {
                        "name": "transformer",
                        "type": "generator",
                        "function": "transform_data",
                        "description": "数据转换",
                    },
                    {
                        "name": "filter",
                        "type": "generator_expression",
                        "description": "过滤无效数据",
                    },
                    {
                        "name": "writer",
                        "type": "iterator",
                        "class": "DataWriter",
                        "description": "写入处理结果",
                    },
                ],
                "risks": [
                    {
                        "type": "single_use_iterator",
                        "stage": "reader",
                        "description": "FileReader 是一次性迭代器，被多个 stage 消费",
                    },
                    {
                        "type": "lazy_evaluation",
                        "stage": "filter",
                        "description": "生成器表达式延迟执行，错误可能在下游才暴露",
                    },
                ],
            },
            {
                "name": "event_stream",
                "description": "事件流处理",
                "stages": [
                    {
                        "name": "event_source",
                        "type": "async_generator",
                        "function": "event_stream",
                        "description": "异步事件源",
                    },
                    {
                        "name": "processor",
                        "type": "generator",
                        "function": "process_events",
                        "description": "处理事件",
                    },
                ],
                "risks": [
                    {
                        "type": "stopiteration",
                        "stage": "processor",
                        "description": "手动处理 StopIteration 可能在 Python 3.7+ 导致 RuntimeError",
                    },
                ],
            },
        ],
    }

    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(pipelines, f, allow_unicode=True, sort_keys=False, default_flow_style=False)


def create_events_jsonl(path: Path):
    """创建示例 events.jsonl 文件。"""
    base_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    events = [
        {
            "timestamp": (base_time - timedelta(hours=8)).isoformat(),
            "type": "iterator_exhausted",
            "level": "error",
            "message": "Iterator has been exhausted",
            "context": {
                "iterator_type": "FileReader",
                "function": "process_batch",
                "line_number": 42,
            },
        },
        {
            "timestamp": (base_time - timedelta(hours=7, minutes=30)).isoformat(),
            "type": "stopiteration_raised",
            "level": "warning",
            "message": "StopIteration raised inside generator",
            "context": {
                "generator_name": "transform_data",
                "line_number": 128,
            },
        },
        {
            "timestamp": (base_time - timedelta(hours=6)).isoformat(),
            "type": "tee_memory_warning",
            "level": "warning",
            "message": "itertools.tee cache size exceeded threshold",
            "context": {
                "tee_id": "tee_0x7f8b1c2d3e4f",
                "cache_size": 1048576,
                "threshold": 524288,
            },
        },
        {
            "timestamp": (base_time - timedelta(hours=5)).isoformat(),
            "type": "send_to_unstarted_generator",
            "level": "error",
            "message": "Can't send non-None value to a just-started generator",
            "context": {
                "generator_name": "event_stream",
                "line_number": 56,
            },
        },
        {
            "timestamp": (base_time - timedelta(hours=4)).isoformat(),
            "type": "lazy_error_delayed",
            "level": "warning",
            "message": "Exception occurred during lazy evaluation",
            "context": {
                "expression_type": "generator_expression",
                "delayed_by": "2.3 seconds",
                "original_exception": "ValueError",
            },
        },
        {
            "timestamp": (base_time - timedelta(hours=3)).isoformat(),
            "type": "iterator_reused",
            "level": "warning",
            "message": "Iterator instance being reused after exhaustion",
            "context": {
                "iterator_type": "DataIterator",
                "reuse_count": 2,
            },
        },
    ]

    with open(path, "w", encoding="utf-8") as f:
        for event in events:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")


def create_snippets(snippets_dir: Path):
    """创建示例代码片段。"""

    snippets = {
        "bad_iterator_protocol.py": BAD_ITERATOR_PROTOCOL,
        "bad_stopiteration.py": BAD_STOPITERATION,
        "bad_single_use.py": BAD_SINGLE_USE,
        "bad_tee.py": BAD_TEE,
        "bad_send.py": BAD_SEND,
        "bad_lazy.py": BAD_LAZY,
        "good_iterator_protocol.py": GOOD_ITERATOR_PROTOCOL,
        "good_stopiteration.py": GOOD_STOPITERATION,
        "good_single_use.py": GOOD_SINGLE_USE,
        "good_tee.py": GOOD_TEE,
        "good_send.py": GOOD_SEND,
        "good_lazy.py": GOOD_LAZY,
    }

    for filename, content in snippets.items():
        (snippets_dir / filename).write_text(content, encoding="utf-8")


BAD_ITERATOR_PROTOCOL = '''"""错误示例: __iter__/__next__ 协议实现问题

问题:
1. __iter__ 没有返回 self，导致每次迭代创建新迭代器
2. __next__ 没有正确处理边界情况
3. 没有实现正确的可迭代对象协议
"""


class BadDataLoader:
    def __init__(self, data):
        self.data = data
        self.index = 0

    def __iter__(self):
        # 问题1: 每次迭代都重置，返回新对象而不是 self
        self.index = 0
        return BadDataLoader(self.data)

    def __next__(self):
        if self.index >= len(self.data):
            # 问题2: 没有正确抛出 StopIteration
            return None
        value = self.data[self.index]
        self.index += 1
        return value


# 问题3: 当类不是真正的迭代器时，行为混乱
loader = BadDataLoader([1, 2, 3])
iterator1 = iter(loader)
iterator2 = iter(loader)

print(next(iterator1))  # 1
print(next(iterator2))  # 1 (期望是 2，但每次 iter 都创建新对象)
'''


BAD_STOPITERATION = '''"""错误示例: StopIteration 处理问题

问题:
1. 在生成器中手动抛出 StopIteration (Python 3.7+ 会变成 RuntimeError)
2. 没有正确处理 StopIteration 异常
3. yield from 中的 StopIteration 处理
"""


def bad_generator(data):
    """错误: 在生成器中手动抛出 StopIteration"""
    for item in data:
        if item is None:
            # 问题1: Python 3.7+ 会将其转换为 RuntimeError
            raise StopIteration("End of data")
        yield item


def bad_yield_from():
    """错误: 没有正确处理 yield from 中的 StopIteration"""
    gen = bad_generator([1, 2, None, 3])
    try:
        # 问题2: yield from 会捕获 StopIteration，但这里手动抛出的有问题
        result = yield from gen
        print(f"Result: {result}")
    except RuntimeError as e:
        print(f"RuntimeError: {e}")


def bad_next_handling():
    """错误: 没有正确处理 next() 的 StopIteration"""
    items = iter([1, 2, 3])
    while True:
        try:
            item = next(items)
            print(item)
        except StopIteration:
            # 问题3: 继续调用已耗尽的迭代器
            item = next(items)  # 再次抛出 StopIteration
'''


BAD_SINGLE_USE = '''"""错误示例: 一次性迭代器被重复消费

问题:
1. 同一个迭代器实例被多次循环使用
2. 函数返回迭代器而不是可迭代对象
3. 没有意识到生成器是一次性的
"""


def get_data():
    """问题: 返回生成器（一次性）而不是可迭代对象"""
    for i in range(3):
        yield i


def process_data(data):
    """问题: 多次迭代同一个迭代器"""
    # 第一次迭代
    total = sum(data)
    print(f"Total: {total}")

    # 第二次迭代 - 生成器已耗尽
    count = 0
    for item in data:
        count += 1
    print(f"Count: {count}")  # 0，因为生成器已经耗尽


class BadFileReader:
    """问题: __iter__ 返回 self，导致每次迭代状态混乱"""

    def __init__(self, lines):
        self.lines = lines
        self.index = 0

    def __iter__(self):
        return self  # 问题: 不返回新的迭代器

    def __next__(self):
        if self.index >= len(self.lines):
            raise StopIteration
        value = self.lines[self.index]
        self.index += 1
        return value


# 使用示例
data = get_data()
process_data(data)  # Count 为 0

reader = BadFileReader(["a", "b", "c"])
list(reader)  # 第一次: ["a", "b", "c"]
list(reader)  # 第二次: [] (已耗尽)
'''


BAD_TEE = '''"""错误示例: itertools.tee 缓存膨胀问题

问题:
1. 一个迭代器消费过快，导致 tee 缓存无限增长
2. 长时间保留 tee 迭代器引用
3. 没有意识到 tee 的内存开销
"""

import itertools


def bad_tee_usage():
    """问题: 两个迭代器消费速度不一致"""
    # 模拟无限数据流
    def infinite_data():
        i = 0
        while True:
            yield i
            i += 1

    data = infinite_data()
    tee1, tee2 = itertools.tee(data, 2)

    # tee1 消费很快
    for i in range(1000000):
        next(tee1)

    # tee2 消费很慢或根本不消费
    # 问题: tee 需要缓存所有未被 tee2 消费的数据
    # 内存使用会持续增长！


def bad_tee_reuse():
    """问题: 错误地复用 tee 迭代器"""
    original = iter([1, 2, 3, 4, 5])
    tee1, tee2 = itertools.tee(original, 2)

    # 使用 tee1
    print(list(tee1))  # [1, 2, 3, 4, 5]

    # 问题: tee 也是一次性的
    print(list(tee1))  # [] (已耗尽)

    # tee2 独立工作
    print(list(tee2))  # [1, 2, 3, 4, 5]


def bad_tee_memory_leak():
    """问题: 保留 tee 引用导致内存无法释放"""
    def process_stream():
        data = iter(range(1000000))
        tee_a, tee_b = itertools.tee(data, 2)

        # 只消费 tee_a
        result = list(tee_a)

        # 问题: tee_b 没有被消费，缓存保留所有数据
        # 如果函数返回 tee_b，内存不会释放
        return tee_b  # 调用者持有这个引用会导致内存泄漏
'''


BAD_SEND = '''"""错误示例: send/throw/close 高级方法使用问题

问题:
1. 向刚启动的生成器发送非 None 值
2. 没有正确处理 close()
3. throw() 使用不当
"""


def bad_send_usage():
    """问题: 向刚启动的生成器发送非 None 值"""

    def echo_generator():
        while True:
            received = yield
            print(f"Received: {received}")

    gen = echo_generator()

    # 问题: 刚启动的生成器第一次不能 send 非 None
    try:
        gen.send("Hello")  # TypeError: can't send non-None value to a just-started generator
    except TypeError as e:
        print(f"Error: {e}")

    # 正确做法: 先 send(None) 或 next()
    gen = echo_generator()
    next(gen)  # 或 gen.send(None)
    gen.send("Hello")  # 现在可以了


def bad_close_handling():
    """问题: 没有正确处理 GeneratorExit"""

    def resource_generator():
        try:
            while True:
                yield "data"
        except GeneratorExit:
            # 问题: 在 GeneratorExit 中 yield
            yield "cleanup"  # RuntimeError: generator ignored GeneratorExit

    gen = resource_generator()
    next(gen)
    gen.close()  # 会抛出 RuntimeError


def bad_throw_usage():
    """问题: throw() 使用不当"""

    def faulty_generator():
        try:
            yield 1
            yield 2
            yield 3
        except ValueError:
            # 问题: 捕获异常后没有正确处理
            print("Caught ValueError")
            # 没有 yield 或重新抛出，会导致 StopIteration

    gen = faulty_generator()
    print(next(gen))  # 1
    print(gen.throw(ValueError("test")))  # Caught ValueError，然后 StopIteration
'''


BAD_LAZY = '''"""错误示例: 惰性求值相关陷阱

问题:
1. 生成器表达式的副作用延迟
2. 闭包变量捕获问题
3. 异常延迟暴露
"""


def bad_lazy_side_effect():
    """问题: 生成器表达式的副作用延迟执行"""
    numbers = [1, 2, 3, 4, 5]

    # 生成器表达式 - 惰性求值
    squared = (x ** 2 for x in numbers)

    # 修改原始列表
    numbers.clear()

    # 现在才求值 - 空列表！
    print(list(squared))  # []


def bad_closure_capture():
    """问题: 生成器中的闭包变量捕获"""
    multipliers = []

    for i in range(3):
        # 问题: 生成器捕获变量 i，而不是当前值
        multipliers.append((lambda x: x * i for _ in range(1)))

    # 所有生成器都使用 i 的最终值 (2)
    for gen_list in multipliers:
        for gen in gen_list:
            print(gen(10))  # 20, 20, 20 (期望 0, 10, 20)


def bad_delayed_exception():
    """问题: 异常延迟暴露，难以定位"""

    def dangerous_generator(data):
        for item in data:
            # 这里可能抛出异常
            if item == "bad":
                raise ValueError("Bad data!")
            yield item

    # 创建生成器
    data = ["good", "good", "bad", "good"]
    gen = dangerous_generator(data)

    # 前两个没问题
    print(next(gen))  # good
    print(next(gen))  # good

    # 第三个才抛出异常
    try:
        print(next(gen))
    except ValueError as e:
        print(f"Error at iteration 3: {e}")
'''


GOOD_ITERATOR_PROTOCOL = '''"""正确示例: __iter__/__next__ 协议实现

关键点:
1. 区分可迭代对象和迭代器
2. __iter__ 在可迭代对象中返回新迭代器，在迭代器中返回 self
3. __next__ 正确抛出 StopIteration
"""


class DataIterable:
    """可迭代对象: 可以多次迭代"""

    def __init__(self, data):
        self.data = data

    def __iter__(self):
        # 返回新的迭代器实例
        return DataIterator(self.data)


class DataIterator:
    """迭代器: 一次性使用"""

    def __init__(self, data):
        self.data = data
        self.index = 0

    def __iter__(self):
        # 迭代器的 __iter__ 返回 self
        return self

    def __next__(self):
        if self.index >= len(self.data):
            # 正确抛出 StopIteration
            raise StopIteration
        value = self.data[self.index]
        self.index += 1
        return value


# 使用示例
iterable = DataIterable([1, 2, 3])

# 可以多次迭代
print("First iteration:", list(iterable))  # [1, 2, 3]
print("Second iteration:", list(iterable))  # [1, 2, 3]

# 迭代器是一次性的
iterator = iter(DataIterable([4, 5, 6]))
print("Iterator first:", list(iterator))  # [4, 5, 6]
print("Iterator second:", list(iterator))  # []
'''


GOOD_STOPITERATION = '''"""正确示例: StopIteration 处理

关键点:
1. 生成器中使用 return 而不是 raise StopIteration
2. yield from 正确处理 StopIteration
3. 使用 next() 的默认值参数
"""


def good_generator(data):
    """正确: 使用 return 而不是 raise StopIteration"""
    for item in data:
        if item is None:
            # Python 3.7+ 生成器中应该用 return
            return
        yield item


def good_yield_from():
    """正确: yield from 自动处理 StopIteration"""

    def inner():
        yield 1
        yield 2
        return "done"

    def outer():
        # yield from 会捕获 StopIteration 并获取返回值
        result = yield from inner()
        print(f"Inner returned: {result}")
        yield 3

    print(list(outer()))


def good_next_handling():
    """正确: 使用 next() 的默认值或正确的异常处理"""
    items = iter([1, 2, 3])

    # 方法1: 使用默认值
    while True:
        item = next(items, None)
        if item is None:
            break
        print(item)

    # 方法2: 正确的 try-except
    items = iter([4, 5, 6])
    while True:
        try:
            item = next(items)
            print(item)
        except StopIteration:
            break
'''


GOOD_SINGLE_USE = '''"""正确示例: 避免一次性迭代器被重复消费

关键点:
1. 函数返回可迭代对象或列表，而不是生成器
2. 每次迭代创建新的迭代器
3. 明确区分可迭代对象和迭代器
"""


def get_data_as_list():
    """方法1: 返回列表（可以多次迭代）"""
    return list(range(3))


def get_data_as_generator():
    """方法2: 明确返回生成器，文档说明是一次性的"""
    for i in range(3):
        yield i


def get_data_as_iterable():
    """方法3: 返回可迭代对象"""
    return GoodDataIterable(range(3))


class GoodDataIterable:
    """可迭代对象: 每次迭代创建新迭代器"""

    def __init__(self, data):
        self.data = list(data) if not isinstance(data, list) else data

    def __iter__(self):
        # 返回新的迭代器
        return iter(self.data)


def process_data_correctly():
    """正确处理迭代器"""
    # 方法1: 使用列表
    data_list = get_data_as_list()
    print("Sum:", sum(data_list))  # 3
    print("Count:", len(data_list))  # 3

    # 方法2: 每次重新调用生成器函数
    print("Sum2:", sum(get_data_as_generator()))  # 3
    print("Count2:", sum(1 for _ in get_data_as_generator()))  # 3

    # 方法3: 使用可迭代对象
    iterable = get_data_as_iterable()
    print("Sum3:", sum(iterable))  # 3
    print("Count3:", len(list(iterable)))  # 3
'''


GOOD_TEE = '''"""正确示例: itertools.tee 使用

关键点:
1. 两个迭代器消费速度大致相同
2. 及时消费或丢弃不需要的 tee
3. 了解 tee 的内存开销
"""

import itertools


def good_tee_usage():
    """正确: 两个迭代器消费速度一致"""
    data = iter(range(10))
    tee1, tee2 = itertools.tee(data, 2)

    # 同时消费两个迭代器
    for a, b in zip(tee1, tee2):
        print(f"tee1: {a}, tee2: {b}")


def good_tee_memory_management():
    """正确: 及时处理不再需要的 tee"""

    def process_parallel():
        original = iter(range(1000))
        tee_a, tee_b = itertools.tee(original, 2)

        # 并行处理
        result_a = []
        result_b = []

        # 使用 zip 同时消费，避免内存堆积
        for item_a, item_b in zip(tee_a, tee_b):
            result_a.append(item_a * 2)
            result_b.append(item_b + 1)

        return result_a, result_b


def good_tee_alternative():
    """当不需要 tee 时，考虑其他方案"""
    data = [1, 2, 3, 4, 5]

    # 如果数据量小，直接使用列表副本
    def process_twice():
        # 方式1: 多次迭代列表
        total = sum(data)
        count = len(data)
        return total, count

    # 方式2: 如果需要生成器，每次重新创建
    def get_generator():
        return (x * 2 for x in data)

    result1 = list(get_generator())
    result2 = list(get_generator())  # 独立的生成器
'''


GOOD_SEND = '''"""正确示例: send/throw/close 使用

关键点:
1. 先启动生成器（next() 或 send(None)）
2. 正确处理 GeneratorExit
3. throw() 后正确恢复或退出
"""


def good_send_usage():
    """正确: 先启动生成器"""

    def echo_generator():
        while True:
            received = yield
            if received is None:
                break
            print(f"Received: {received}")

    gen = echo_generator()

    # 正确启动: next() 或 send(None)
    next(gen)  # 或 gen.send(None)

    # 现在可以发送值
    gen.send("Hello")
    gen.send("World")

    # 结束生成器
    gen.send(None)


def good_close_handling():
    """正确: 处理 GeneratorExit"""

    def resource_generator():
        resource = acquire_resource()
        try:
            while True:
                yield "data"
        except GeneratorExit:
            # 正确: 只清理，不 yield
            release_resource(resource)
            # 不需要重新抛出，GeneratorExit 会自然传播

    def acquire_resource():
        return "some_resource"

    def release_resource(r):
        print(f"Released: {r}")

    gen = resource_generator()
    next(gen)
    gen.close()  # 正确关闭


def good_throw_usage():
    """正确: throw() 的正确使用"""

    def resilient_generator():
        try:
            for i in range(5):
                try:
                    yield i
                except ValueError:
                    print(f"Recovered from error at {i}")
                    # 继续迭代
        except StopIteration:
            return

    gen = resilient_generator()
    print(next(gen))  # 0
    print(gen.throw(ValueError("test")))  # Recovered... 然后 1
    print(next(gen))  # 2
'''


GOOD_LAZY = '''"""正确示例: 惰性求值的正确使用

关键点:
1. 理解生成器表达式的执行时机
2. 正确捕获闭包变量
3. 尽早验证数据
"""


def good_lazy_understanding():
    """正确: 理解惰性求值的时机"""
    numbers = [1, 2, 3, 4, 5]

    # 方式1: 使用列表推导式（立即求值）
    squared_list = [x ** 2 for x in numbers]
    numbers.clear()
    print("List comprehension:", squared_list)  # [1, 4, 9, 16, 25]

    # 方式2: 如果必须用生成器，先消费或复制数据
    numbers_copy = list(numbers)
    squared_gen = (x ** 2 for x in numbers_copy)


def good_closure_capture():
    """正确: 正确捕获闭包变量"""
    multipliers = []

    for i in range(3):
        # 方式1: 使用默认参数捕获当前值
        def make_multiplier(n=i):
            return lambda x: x * n

        multipliers.append(make_multiplier())

        # 方式2: 使用 functools.partial
        from functools import partial

    # 测试
    for m in multipliers:
        print(m(10))  # 0, 10, 20


def good_error_handling():
    """正确: 尽早验证数据"""

    def safe_generator(data):
        # 提前验证数据
        validated = []
        for item in data:
            if item == "bad":
                raise ValueError("Bad data found during validation!")
            validated.append(item)

        # 然后安全地生成
        for item in validated:
            yield item

    # 使用时在创建阶段就能发现错误
    try:
        gen = safe_generator(["good", "good", "bad", "good"])
    except ValueError as e:
        print(f"Validation error: {e}")
'''
