class StringDescriptor:
    def __set_name__(self, owner, name):
        self.name = name
        print(f"StringDescriptor.__set_name__ called for {name} in {owner.__name__}")

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__.get(self.name, "")

    def __set__(self, instance, value):
        if not isinstance(value, str):
            raise TypeError(f"Expected string for {self.name}")
        instance.__dict__[self.name] = value


class IntegerDescriptor:
    def __set_name__(self, owner, name):
        self.name = name
        print(f"IntegerDescriptor.__set_name__ called for {name} in {owner.__name__}")

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__.get(self.name, 0)

    def __set__(self, instance, value):
        if not isinstance(value, int):
            raise TypeError(f"Expected integer for {self.name}")
        instance.__dict__[self.name] = value


class DescriptorClass:
    name = StringDescriptor()
    value = IntegerDescriptor()

    def __init__(self, name: str, value: int):
        self.name = name
        self.value = value
