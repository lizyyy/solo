class CustomMeta(type):
    @classmethod
    def __prepare__(mcs, name, bases, **kwargs):
        print(f"__prepare__ called for {name}")
        return {}

    def __new__(mcs, name, bases, namespace, **kwargs):
        print(f"__new__ called for {name}")
        namespace['_custom_attr'] = 'added by metaclass'
        return super().__new__(mcs, name, bases, namespace)

    def __init__(cls, name, bases, namespace, **kwargs):
        print(f"__init__ called for {name}")
        super().__init__(name, bases, namespace)


class MetaClassExample(metaclass=CustomMeta):
    data = None
    version = "1.0"

    def process(self):
        return f"Processing with version {self.version}"
