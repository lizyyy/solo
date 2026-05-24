# 正确的示例：使用 user:read 别名（应该被正确识别为 user.read）
# @api: GET /api/v1/users
# @scope: user:read
def get_users_example():
    """获取用户列表示例"""
    client.get("/api/v1/users", scopes=["user:read"])


# 错误示例：缺少必需的 scope（应该检测到缺口）
# @api: POST /api/v1/users
# @scope: user.read
def create_user_bad_example():
    """创建用户 - 权限不足示例"""
    # 需要 user.write，但只声明了 user.read
    client.post("/api/v1/users", data=user_data)


# 正确示例：使用别名 user:write
# @api: POST /api/v1/users
# @scope: user:write
def create_user_good_example():
    """创建用户 - 正确权限示例"""
    client.post("/api/v1/users", data=user_data, scopes=["user:write"])


# 错误示例：使用过期的 deprecated_scope
# @api: GET /api/v1/orders
# @scope: deprecated_scope
def get_orders_deprecated_example():
    """获取订单 - 使用过期 scope 示例"""
    client.get("/api/v1/orders", scopes=["deprecated_scope"])


# 正确示例：admin.full 包含所有权限
# @api: POST /api/v1/orders
# @scope: admin.full
def create_order_admin_example():
    """创建订单 - 管理员权限示例"""
    # admin.full 包含 order.write，应该通过
    client.post("/api/v1/orders", data=order_data)


# 多余权限示例：声明了多余的 scope
# @api: GET /api/v1/users
# @scope: user.read, order.write
def get_users_extra_scope_example():
    """获取用户 - 多余权限示例"""
    # 只需要 user.read，但声明了 order.write
    client.get("/api/v1/users", scopes=["user.read", "order.write"])
