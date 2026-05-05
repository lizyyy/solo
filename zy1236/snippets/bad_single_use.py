"""错误示例: 一次性迭代器被重复消费

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
