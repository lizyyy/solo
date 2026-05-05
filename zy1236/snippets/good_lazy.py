"""正确示例: 惰性求值的正确使用

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
