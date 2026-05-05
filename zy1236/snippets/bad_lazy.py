"""错误示例: 惰性求值相关陷阱

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
