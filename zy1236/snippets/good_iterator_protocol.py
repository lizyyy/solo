"""正确示例: __iter__/__next__ 协议实现

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
