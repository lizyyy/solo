class InitSubclassExample:
    registry = []

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        cls.registry.append(cls)
        print(f"Registered subclass: {cls.__name__}")


class SubClass1(InitSubclassExample):
    pass


class SubClass2(InitSubclassExample):
    pass


# Now InitSubclassExample.registry contains [SubClass1, SubClass2]
