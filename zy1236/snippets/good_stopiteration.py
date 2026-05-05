"""正确示例: StopIteration 处理

关键点:
1. 生成器中使用 return 而不是 raise StopIteration
2. yield from 正确处理 StopIteration
3. 使用 next() 的默认值参数
"""


def good_generator(data):
    """正确: 使用 return 而不是 raise StopIteration"""
    for item in data:
        if item is None:
            # Python 3.7+ 生成器中应该用 return
            return
        yield item


def good_yield_from():
    """正确: yield from 自动处理 StopIteration"""

    def inner():
        yield 1
        yield 2
        return "done"

    def outer():
        # yield from 会捕获 StopIteration 并获取返回值
        result = yield from inner()
        print(f"Inner returned: {result}")
        yield 3

    print(list(outer()))


def good_next_handling():
    """正确: 使用 next() 的默认值或正确的异常处理"""
    items = iter([1, 2, 3])

    # 方法1: 使用默认值
    while True:
        item = next(items, None)
        if item is None:
            break
        print(item)

    # 方法2: 正确的 try-except
    items = iter([4, 5, 6])
    while True:
        try:
            item = next(items)
            print(item)
        except StopIteration:
            break
