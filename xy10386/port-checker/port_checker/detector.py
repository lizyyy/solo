import platform
import subprocess
import sys
from typing import Dict, Set, Optional

from .models import ScanResult, Project, PortConfig, PortStatus


class PortDetector:
    def __init__(self, simulate: bool = False, simulate_occupied: Optional[Dict[int, str]] = None):
        self.simulate = simulate
        self.simulate_occupied = simulate_occupied or {}

    def check(self, result: ScanResult) -> None:
        occupied_ports = self._get_occupied_ports(result)

        for project in result.projects.values():
            for port_config in project.ports:
                if port_config.status == PortStatus.INVALID:
                    continue

                port = port_config.port
                if port in occupied_ports:
                    process_info = occupied_ports[port]
                    port_config.status = PortStatus.OCCUPIED
                    port_config.process_id = process_info.get("pid")
                    port_config.process_name = process_info.get("name")

                    if port_config.process_id == 0 or not port_config.process_name:
                        port_config.status = PortStatus.UNKNOWN_PROCESS
                        port_config.error = "端口被未知进程占用"
                else:
                    port_config.status = PortStatus.AVAILABLE
                    port_config.process_id = None
                    port_config.process_name = None

        self._mark_conflicts(result)

    def _mark_conflicts(self, result: ScanResult) -> None:
        conflicts = result.find_port_conflicts()
        for port, configs in conflicts.items():
            for config in configs:
                if config.status != PortStatus.INVALID:
                    config.status = PortStatus.CONFLICT
                    config.error = f"端口 {port} 在多个项目中被配置"

    def _get_occupied_ports(self, result: ScanResult) -> Dict[int, dict]:
        if self.simulate:
            return {
                port: {"pid": 9999, "name": name}
                for port, name in self.simulate_occupied.items()
            }

        all_ports = set()
        for port_config in result.get_all_ports():
            if port_config.status != PortStatus.INVALID:
                all_ports.add(port_config.port)

        return self._detect_ports_native(all_ports)

    def _detect_ports_native(self, ports: Set[int]) -> Dict[int, dict]:
        if not ports:
            return {}

        system = platform.system()
        if system == "Darwin":
            return self._detect_macos(ports)
        elif system == "Linux":
            return self._detect_linux(ports)
        elif system == "Windows":
            return self._detect_windows(ports)
        else:
            return self._detect_generic(ports)

    def _detect_macos(self, ports: Set[int]) -> Dict[int, dict]:
        result: Dict[int, dict] = {}

        try:
            cmd = ["lsof", "-n", "-P", "-iTCP", "-sTCP:LISTEN"]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            output = proc.stdout
        except (subprocess.SubprocessError, FileNotFoundError):
            return result

        for line in output.splitlines()[1:]:
            parts = line.split()
            if len(parts) < 9:
                continue

            try:
                pid = int(parts[1])
                name = parts[0]
                addr = parts[8]

                if ":" in addr:
                    port_str = addr.split(":")[-1]
                    port = int(port_str)

                    if port in ports and port not in result:
                        result[port] = {"pid": pid, "name": name}
            except (ValueError, IndexError):
                continue

        return result

    def _detect_linux(self, ports: Set[int]) -> Dict[int, dict]:
        result: Dict[int, dict] = {}

        try:
            cmd = ["ss", "-tlnp"]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            output = proc.stdout
        except (subprocess.SubprocessError, FileNotFoundError):
            try:
                cmd = ["netstat", "-tlnp"]
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                output = proc.stdout
            except (subprocess.SubprocessError, FileNotFoundError):
                return result

        for line in output.splitlines():
            if "LISTEN" not in line:
                continue

            try:
                parts = line.split()
                if len(parts) < 5:
                    continue

                addr = parts[3]
                if ":" in addr:
                    port_str = addr.split(":")[-1]
                    port = int(port_str)

                    if port in ports and port not in result:
                        pid = 0
                        name = ""
                        if len(parts) > 6:
                            proc_info = parts[6]
                            if 'users:' in proc_info:
                                import re
                                match = re.search(r'users:\(\("([^"]+)",pid=(\d+),', proc_info)
                                if match:
                                    name = match.group(1)
                                    pid = int(match.group(2))

                        result[port] = {"pid": pid, "name": name}
            except (ValueError, IndexError):
                continue

        return result

    def _detect_windows(self, ports: Set[int]) -> Dict[int, dict]:
        result: Dict[int, dict] = {}

        try:
            cmd = ["netstat", "-ano"]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            output = proc.stdout
        except (subprocess.SubprocessError, FileNotFoundError):
            return result

        for line in output.splitlines():
            if "LISTENING" not in line:
                continue

            try:
                parts = line.split()
                if len(parts) < 5:
                    continue

                addr = parts[1]
                pid = int(parts[4])

                if ":" in addr:
                    port_str = addr.split(":")[-1]
                    port = int(port_str)

                    if port in ports and port not in result:
                        result[port] = {"pid": pid, "name": ""}
            except (ValueError, IndexError):
                continue

        if result:
            self._fill_process_names_windows(result)

        return result

    def _fill_process_names_windows(self, port_info: Dict[int, dict]) -> None:
        pids = {info["pid"] for info in port_info.values() if info["pid"] > 0}
        if not pids:
            return

        pid_to_name: Dict[int, str] = {}
        try:
            cmd = ["tasklist", "/FO", "CSV", "/NH"]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            output = proc.stdout

            for line in output.splitlines():
                parts = [p.strip('"') for p in line.split('","')]
                if len(parts) < 2:
                    continue
                try:
                    pid = int(parts[1])
                    if pid in pids:
                        pid_to_name[pid] = parts[0]
                except ValueError:
                    continue
        except (subprocess.SubprocessError, FileNotFoundError):
            pass

        for info in port_info.values():
            info["name"] = pid_to_name.get(info.get("pid", 0), "")

    def _detect_generic(self, ports: Set[int]) -> Dict[int, dict]:
        import socket

        result: Dict[int, dict] = {}

        for port in ports:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.1)
                sock.bind(("127.0.0.1", port))
                sock.close()
            except OSError:
                result[port] = {"pid": 0, "name": ""}

        return result
