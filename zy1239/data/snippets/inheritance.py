from simple_class import SimpleClass


class DerivedClass(SimpleClass):
    z = 3

    def __init__(self, name: str, value: int):
        super().__init__(name)
        self.value = value

    def combine(self):
        return self.x + self.y + self.z
