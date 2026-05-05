"""错误示例: itertools.tee 缓存膨胀问题

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
