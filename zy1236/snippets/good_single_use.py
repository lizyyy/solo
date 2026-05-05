"""正确示例: 避免一次性迭代器被重复消费

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
