from custom_metaclass import MetaClassExample, CustomMeta
from simple_class import SimpleClass


# This will cause a metaclass conflict because:
# - MetaClassExample uses CustomMeta
# - SimpleClass uses type (default)
# Python cannot automatically resolve this automatically

try:
    class MultiInheritClass(MetaClassExample, SimpleClass):
        combined = True
except TypeError as e:
    print(f"Metaclass conflict: {e}")


# Fix: Create a combined metaclass that inherits from both
class CombinedMeta(CustomMeta, type):
    pass


class FixedMultiInheritClass(MetaClassExample, SimpleClass, metaclass=CombinedMeta):
    combined = True
