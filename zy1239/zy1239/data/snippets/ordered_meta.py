from collections import OrderedDict


class OrderedMeta(type):
    @classmethod
    def __prepare__(mcs, name, bases, **kwargs):
        print(f"OrderedMeta.__prepare__ called for {name}")
        return OrderedDict()

    def __new__(mcs, name, bases, namespace, **kwargs):
        print(f"OrderedMeta.__new__ called for {name}")
        attrs = [(k, v) for k, v in namespace.items() if not k.startswith('_')]
        namespace['_field_order'] = [k for k, _ in attrs]
        return super().__new__(mcs, name, bases, namespace)

    def __init__(cls, name, bases, namespace, **kwargs):
        print(f"OrderedMeta.__init__ called for {name}")
        super().__init__(name, bases, namespace)


class OrderedAttrClass(metaclass=OrderedMeta):
    first = 1
    second = 2
    third = 3

    def get_ordered_fields(self):
        return [(k, getattr(self, k)) for k in self._field_order]
