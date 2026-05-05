"""真值判断魔术方法示例"""


class HasBoolAndLen:
    """同时定义 __bool__ 和 __len__"""

    def __init__(self, value):
        self.value = value

    def __bool__(self):
        print(f"[__bool__] 被调用")
        return self.value > 0

    def __len__(self):
        print(f"[__len__] 被调用")
        return self.value


class OnlyLen:
    """只定义 __len__"""

    def __init__(self, size):
        self.size = size

    def __len__(self):
        print(f"[__len__] 被调用, 返回 {self.size}")
        return self.size


class BadLen:
    """__len__ 返回负值 - 错误示例"""

    def __len__(self):
        return -1


class EmptyContainer:
    """空容器的真值判断"""

    def __init__(self, items):
        self.items = items

    def __bool__(self):
        return len(self.items) > 0

    def __len__(self):
        return len(self.items)


class CallableCounter:
    """使用 __call__ 的计数器"""

    def __init__(self):
        self.count = 0

    def __call__(self, increment=1):
        self.count += increment
        return self.count

    def __bool__(self):
        return self.count > 0


if __name__ == "__main__":
    print("=== 测试 HasBoolAndLen ===")
    obj1 = HasBoolAndLen(5)
    obj0 = HasBoolAndLen(0)

    print(f"bool(obj1) = {bool(obj1)}")
    print(f"bool(obj0) = {bool(obj0)}")
    print(f"len(obj1) = {len(obj1)}")

    print("\n=== 测试 OnlyLen ===")
    ol5 = OnlyLen(5)
    ol0 = OnlyLen(0)

    print(f"bool(ol5) = {bool(ol5)}")
    print(f"bool(ol0) = {bool(ol0)}")

    print("\n=== 测试 BadLen ===")
    bl = BadLen()
    try:
        len(bl)
    except ValueError as e:
        print(f"len(bl) 抛出 ValueError: {e}")

    print("\n=== 测试 EmptyContainer ===")
    ec_full = EmptyContainer([1, 2, 3])
    ec_empty = EmptyContainer([])

    print(f"ec_full 在 if 中: {'truthy' if ec_full else 'falsy'}")
    print(f"ec_empty 在 if 中: {'truthy' if ec_empty else 'falsy'}")

    print("\n=== 测试 CallableCounter ===")
    counter = CallableCounter()
    print(f"初始 counter 在 if 中: {'truthy' if counter else 'falsy'}")
    counter()
    print(f"调用一次后 counter 在 if 中: {'truthy' if counter else 'falsy'}")
