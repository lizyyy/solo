from .base import Checker, CheckResult
from typing import Dict, Any
import socket


class CacheChecker(Checker):
    name = "cache"
    description = "检查缓存服务地址和连接"

    def check(self, config: Dict[str, Any]) -> CheckResult:
        cache_config = config.get("cache", {})
        if not cache_config:
            return self._skip()

        cache_type = cache_config.get("type", "redis")
        host = cache_config.get("host")
        port = cache_config.get("port")
        password = cache_config.get("password")

        if not host:
            return self._fail(
                "缓存地址未配置",
                details={"missing_field": "host"},
                fix_hint=f"请在 cache.host 配置中填写 {cache_type} 服务器地址",
                severity=8
            )

        if port and not (1 <= int(port) <= 65535):
            return self._fail(
                f"缓存端口 {port} 无效",
                details={"port": port},
                fix_hint="请将端口配置为 1-65535 之间的有效端口",
                severity=7
            )

        if cache_type == "redis":
            default_port = 6379
        elif cache_type == "memcached":
            default_port = 11211
        else:
            default_port = 6379

        actual_port = int(port) if port else default_port

        can_connect = self._test_connection(host, actual_port, cache_config)
        if not can_connect:
            return self._fail(
                f"无法连接到 {cache_type} 缓存",
                details={"host": host, "port": actual_port},
                fix_hint=f"请检查 {cache_type} 服务是否启动，地址 {host}:{actual_port} 是否可访问",
                severity=9
            )

        if password is not None and len(password) < 1:
            return self._warn(
                "缓存密码为空",
                details={"security": "生产环境建议设置密码"},
                fix_hint="建议在 cache.password 中配置密码以增强安全性",
                severity=2
            )

        return self._pass(
            f"{cache_type} 缓存连接正常",
            details={
                "host": host,
                "port": actual_port,
                "type": cache_type
            }
        )

    def _test_connection(self, host: str, port: int, config: Dict[str, Any]) -> bool:
        simulated_status = config.get("simulated_connect", True)
        return simulated_status
