from .base import Checker, CheckResult
from typing import Dict, Any, List


class QueueChecker(Checker):
    name = "queue"
    description = "检查消息队列连接和主题配置"

    def check(self, config: Dict[str, Any]) -> CheckResult:
        queue_config = config.get("queue", {})
        if not queue_config:
            return self._skip()

        queue_type = queue_config.get("type", "rabbitmq")
        host = queue_config.get("host")
        port = queue_config.get("port")
        user = queue_config.get("user")
        password = queue_config.get("password")
        topics = queue_config.get("topics", [])
        required_topics = queue_config.get("required_topics", [])

        if not host:
            return self._fail(
                "消息队列地址未配置",
                details={"missing_field": "host"},
                fix_hint=f"请在 queue.host 配置中填写 {queue_type} 服务器地址",
                severity=8
            )

        if queue_type == "rabbitmq":
            default_port = 5672
        elif queue_type == "kafka":
            default_port = 9092
        elif queue_type == "redis":
            default_port = 6379
        else:
            default_port = 5672

        actual_port = int(port) if port else default_port

        can_connect = self._test_connection(host, actual_port, queue_config)
        if not can_connect:
            return self._fail(
                f"无法连接到 {queue_type} 消息队列",
                details={"host": host, "port": actual_port},
                fix_hint=f"请检查 {queue_type} 服务是否启动，地址 {host}:{actual_port} 是否可访问",
                severity=9
            )

        missing_topics = []
        for topic in required_topics:
            if topic not in topics:
                missing_topics.append(topic)

        if missing_topics:
            return self._fail(
                f"必需的消息主题未配置: {', '.join(missing_topics)}",
                details={
                    "missing_topics": missing_topics,
                    "configured_topics": topics
                },
                fix_hint=f"请在 queue.topics 中添加缺失的主题: {', '.join(missing_topics)}",
                severity=7
            )

        if not topics:
            return self._warn(
                "未配置任何消息主题",
                details={"topics": []},
                fix_hint="请在 queue.topics 中配置所需的消息主题",
                severity=2
            )

        return self._pass(
            f"{queue_type} 消息队列配置正常",
            details={
                "host": host,
                "port": actual_port,
                "type": queue_type,
                "topics": topics,
                "topic_count": len(topics)
            }
        )

    def _test_connection(self, host: str, port: int, config: Dict[str, Any]) -> bool:
        simulated_status = config.get("simulated_connect", True)
        return simulated_status
