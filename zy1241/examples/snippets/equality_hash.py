"""相等性和哈希魔术方法示例"""


class GoodHashable:
    """正确实现的可哈希类"""

    def __init__(self, id, name):
        self.id = id
        self.name = name

    def __eq__(self, other):
        if not isinstance(other, GoodHashable):
            return False
        return self.id == other.id

    def __hash__(self):
        return hash(self.id)

    def __repr__(self):
        return f"GoodHashable(id={self.id}, name={self.name!r})"


class NotHashable:
    """明确不可哈希的类"""

    def __init__(self, id, name):
        self.id = id
        self.name = name

    def __eq__(self, other):
        if not isinstance(other, NotHashable):
            return False
        return self.id == other.id

    __hash__ = None


class BadHashable:
    """问题实现 - 定义了 __eq__ 但没有 __hash__"""

    def __init__(self, id, name):
        self.id = id
        self.name = name

    def __eq__(self, other):
        if not isinstance(other, BadHashable):
            return False
        return self.id == other.id


class ComplexHash:
    """包含多个字段的哈希实现"""

    def __init__(self, first, second, third):
        self.first = first
        self.second = second
        self.third = third

    def __eq__(self, other):
        if not isinstance(other, ComplexHash):
            return False
        return (
            self.first == other.first
            and self.second == other.second
            and self.third == other.third
        )

    def __hash__(self):
        return hash((self.first, self.second, self.third))


if __name__ == "__main__":
    print("=== 测试 GoodHashable ===")
    a = GoodHashable(1, "Alice")
    b = GoodHashable(1, "Alice")
    c = GoodHashable(2, "Bob")

    print(f"a == b: {a == b}")
    print(f"hash(a) == hash(b): {hash(a) == hash(b)}")
    print(f"a == c: {a == c}")

    s = {a, b, c}
    print(f"集合大小 (预期 2): {len(s)}")

    print("\n=== 测试 NotHashable ===")
    nh1 = NotHashable(1, "test")
    nh2 = NotHashable(1, "test")
    print(f"nh1 == nh2: {nh1 == nh2}")
    print(f"nh1.__hash__: {nh1.__hash__}")

    try:
        hash(nh1)
    except TypeError as e:
        print(f"hash(nh1) 抛出 TypeError: {e}")

    print("\n=== 测试 ComplexHash ===")
    ch1 = ComplexHash("a", 1, True)
    ch2 = ComplexHash("a", 1, True)
    print(f"ch1 == ch2: {ch1 == ch2}")
    print(f"hash(ch1) == hash(ch2): {hash(ch1) == hash(ch2)}")
