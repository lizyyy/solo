"""错误示例: __iter__/__next__ 协议实现问题

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
