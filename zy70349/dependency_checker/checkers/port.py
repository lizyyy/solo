from .base import Checker, CheckResult
from typing import Dict, Any, List
import socket


class PortChecker(Checker):
    name = "port"
    description = "检查端口占用情况"

    def check(self, config: Dict[str, Any]) -> CheckResult:
        ports_config = config.get("ports", [])
        if not ports_config:
            return self._skip("未配置端口检查")

        occupied_ports = []
        available_ports = []

        for port_item in ports_config:
            port = int(port_item) if isinstance(port_item, (int, str)) else port_item.get("port")
            name = port_item.get("name", f"端口 {port}") if isinstance(port_item, dict) else f"端口 {port}"

            if not (1 <= int(port) <= 65535):
                occupied_ports.append({
                    "port": port,
                    "name": name,
                    "issue": "端口号无效"
                })
                continue

            if self._is_port_occupied(int(port), config):
                occupied_ports.append({
                    "port": port,
                    "name": name,
                    "issue": "已被占用"
                })
            else:
                available_ports.append({
                    "port": port,
                    "name": name
                })

        if occupied_ports:
            occupied_list = ", ".join([f"{p['name']}({p['port']})" for p in occupied_ports])
            hints = []
            for p in occupied_ports:
                if p['issue'] == "已被占用":
                    hints.append(f"{p['name']}({p['port']}): 请使用 `lsof -i :{p['port']}` 查看占用进程，停止该进程或修改配置使用其他端口")
                else:
                    hints.append(f"{p['name']}({p['port']}): 请将端口配置为 1-65535 之间的有效端口")

            return self._fail(
                f"端口冲突或无效: {occupied_list}",
                details={
                    "occupied": occupied_ports,
                    "available": available_ports
                },
                fix_hint="\n".join(hints),
                severity=8
            )

        return self._pass(
            f"所有 {len(available_ports)} 个端口可用",
            details={"ports": available_ports}
        )

    def _is_port_occupied(self, port: int, config: Dict[str, Any]) -> bool:
        simulated_occupied = config.get("simulated_ports_occupied", {})
        if port in simulated_occupied:
            return simulated_occupied[port]

        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                result = s.connect_ex(('127.0.0.1', port))
                return result == 0
        except Exception:
            return True
