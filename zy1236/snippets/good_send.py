"""正确示例: send/throw/close 使用

关键点:
1. 先启动生成器（next() 或 send(None)）
2. 正确处理 GeneratorExit
3. throw() 后正确恢复或退出
"""


def good_send_usage():
    """正确: 先启动生成器"""

    def echo_generator():
        while True:
            received = yield
            if received is None:
                break
            print(f"Received: {received}")

    gen = echo_generator()

    # 正确启动: next() 或 send(None)
    next(gen)  # 或 gen.send(None)

    # 现在可以发送值
    gen.send("Hello")
    gen.send("World")

    # 结束生成器
    gen.send(None)


def good_close_handling():
    """正确: 处理 GeneratorExit"""

    def resource_generator():
        resource = acquire_resource()
        try:
            while True:
                yield "data"
        except GeneratorExit:
            # 正确: 只清理，不 yield
            release_resource(resource)
            # 不需要重新抛出，GeneratorExit 会自然传播

    def acquire_resource():
        return "some_resource"

    def release_resource(r):
        print(f"Released: {r}")

    gen = resource_generator()
    next(gen)
    gen.close()  # 正确关闭


def good_throw_usage():
    """正确: throw() 的正确使用"""

    def resilient_generator():
        try:
            for i in range(5):
                try:
                    yield i
                except ValueError:
                    print(f"Recovered from error at {i}")
                    # 继续迭代
        except StopIteration:
            return

    gen = resilient_generator()
    print(next(gen))  # 0
    print(gen.throw(ValueError("test")))  # Recovered... 然后 1
    print(next(gen))  # 2
