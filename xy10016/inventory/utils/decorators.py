from functools import wraps
from typing import Callable, Any


class PermissionDenied(Exception):
    pass


def require_permission(permission: str):
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user', None)
            if current_user is None:
                for arg in args:
                    if hasattr(arg, 'has_permission'):
                        current_user = arg
                        break

            if current_user is None:
                raise PermissionDenied("No user context provided")

            if not current_user.has_permission(permission):
                raise PermissionDenied(
                    f"User '{current_user.username}' does not have permission '{permission}'"
                )

            return func(*args, **kwargs)
        return wrapper
    return decorator


def require_role(role_name: str):
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user', None)
            if current_user is None:
                for arg in args:
                    if hasattr(arg, 'roles'):
                        current_user = arg
                        break

            if current_user is None:
                raise PermissionDenied("No user context provided")

            user_has_role = any(role.name == role_name for role in current_user.roles)
            if not user_has_role:
                raise PermissionDenied(
                    f"User '{current_user.username}' does not have role '{role_name}'"
                )

            return func(*args, **kwargs)
        return wrapper
    return decorator
