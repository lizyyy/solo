"""错误示例: send/throw/close 高级方法使用问题

问题:
1. 向刚启动的生成器发送非 None 值
2. 没有正确处理 close()
3. throw() 使用不当
"""


def bad_send_usage():
    """问题: 向刚启动的生成器发送非 None 值"""

    def echo_generator():
        while True:
            received = yield
            print(f"Received: {received}")

    gen = echo_generator()

    # 问题: 刚启动的生成器第一次不能 send 非 None
    try:
        gen.send("Hello")  # TypeError: can't send non-None value to a just-started generator
    except TypeError as e:
        print(f"Error: {e}")

    # 正确做法: 先 send(None) 或 next()
    gen = echo_generator()
    next(gen)  # 或 gen.send(None)
    gen.send("Hello")  # 现在可以了


def bad_close_handling():
    """问题: 没有正确处理 GeneratorExit"""

    def resource_generator():
        try:
            while True:
                yield "data"
        except GeneratorExit:
            # 问题: 在 GeneratorExit 中 yield
            yield "cleanup"  # RuntimeError: generator ignored GeneratorExit

    gen = resource_generator()
    next(gen)
    gen.close()  # 会抛出 RuntimeError


def bad_throw_usage():
    """问题: throw() 使用不当"""

    def faulty_generator():
        try:
            yield 1
            yield 2
            yield 3
        except ValueError:
            # 问题: 捕获异常后没有正确处理
            print("Caught ValueError")
            # 没有 yield 或重新抛出，会导致 StopIteration

    gen = faulty_generator()
    print(next(gen))  # 1
    print(gen.throw(ValueError("test")))  # Caught ValueError，然后 StopIteration
