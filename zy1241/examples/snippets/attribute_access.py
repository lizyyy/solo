"""属性访问魔术方法示例"""


class SafeAttributeAccess:
    """安全的属性访问实现"""

    def __init__(self):
        self._data = {"name": "Alice", "age": 30}

    def __getattribute__(self, name):
        print(f"[__getattribute__] 访问: {name}")
        try:
            return object.__getattribute__(self, name)
        except AttributeError:
            pass
        data = object.__getattribute__(self, "_data")
        if name in data:
            return data[name]
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")

    def __getattr__(self, name):
        print(f"[__getattr__] 处理缺失属性: {name}")
        return f"default_{name}"

    def __setattr__(self, name, value):
        print(f"[__setattr__] 设置: {name} = {value}")
        if name.startswith("_"):
            object.__setattr__(self, name, value)
        else:
            self._data[name] = value

    def __delattr__(self, name):
        print(f"[__delattr__] 删除: {name}")
        if name.startswith("_"):
            object.__delattr__(self, name)
        else:
            if name in self._data:
                del self._data[name]
            else:
                raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")


class BadSetattrExample:
    """__setattr__ 错误实现示例 - 会导致无限递归"""

    def __setattr__(self, name, value):
        print(f"Setting {name} = {value}")
        self.name = value


if __name__ == "__main__":
    print("=== 测试 SafeAttributeAccess ===")
    obj = SafeAttributeAccess()
    print(f"obj.name = {obj.name}")
    print(f"obj.age = {obj.age}")
    print(f"obj.missing = {obj.missing}")
    obj.new_attr = "new_value"
    print(f"obj.new_attr = {obj.new_attr}")
