class SimpleClass:
    x = 1
    y = 2

    def __init__(self, name: str):
        self.name = name

    def greet(self) -> str:
        return f"Hello, {self.name}!"
