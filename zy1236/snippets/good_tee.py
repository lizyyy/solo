"""正确示例: itertools.tee 使用

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
