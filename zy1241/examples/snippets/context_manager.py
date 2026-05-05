"""上下文管理器魔术方法示例"""


class ResourceManager:
    """安全的资源管理器"""

    def __init__(self, resource_name):
        self.resource_name = resource_name
        self.is_open = False

    def __enter__(self):
        print(f"[__enter__] 打开资源: {self.resource_name}")
        self.is_open = True
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"[__exit__] 关闭资源: {self.resource_name}")
        if exc_type:
            print(f"  捕获异常: {exc_type} - {exc_val}")
        self.is_open = False
        return False


class SuppressErrorManager:
    """抑制异常的上下文管理器 - 谨慎使用"""

    def __enter__(self):
        print("[__enter__] 进入上下文")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print("[__exit__] 退出上下文")
        if exc_type:
            print(f"  抑制异常: {exc_type} - {exc_val}")
            return True
        return False


class DatabaseConnection:
    """模拟数据库连接的上下文管理器"""

    def __init__(self, connection_string):
        self.connection_string = connection_string
        self._conn = None

    def __enter__(self):
        print(f"[__enter__] 建立数据库连接: {self.connection_string}")
        self._conn = "connected"
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print("[__exit__] 关闭数据库连接")
        self._conn = None
        if exc_type:
            print(f"  回滚事务: {exc_val}")
        else:
            print("  提交事务")
        return False


if __name__ == "__main__":
    print("=== 测试 ResourceManager ===")
    with ResourceManager("file.txt") as rm:
        print(f"资源是否打开: {rm.is_open}")
        print("使用资源中...")

    print("\n=== 测试 SuppressErrorManager ===")
    with SuppressErrorManager():
        raise ValueError("测试错误")
    print("程序继续执行...")

    print("\n=== 测试 DatabaseConnection ===")
    with DatabaseConnection("postgres://localhost/mydb") as db:
        print("执行数据库操作...")
