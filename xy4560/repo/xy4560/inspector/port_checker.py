"""端口检查器 - 检查端口占用情况"""

import subprocess
import re
import socket
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple


@dataclass
class PortInfo:
    """端口信息"""
    
    port: int
    is_listening: bool = False
    protocol: str = ""
    local_address: str = ""
    foreign_address: str = ""
    state: str = ""
    process_id: Optional[int] = None
    process_name: str = ""
    process_command: str = ""


@dataclass
class PortCheckResult:
    """端口检查结果"""
    
    documented_ports: List[int] = field(default_factory=list)
    actual_ports: List[PortInfo] = field(default_factory=list)
    mismatches: List[Dict[str, Any]] = field(default_factory=list)
    unexpected_ports: List[PortInfo] = field(default_factory=list)
    missing_ports: List[int] = field(default_factory=list)


class PortChecker:
    """端口检查器"""
    
    def __init__(self):
        pass
    
    def check_port(self, port: int) -> PortInfo:
        """检查单个端口"""
        info = PortInfo(port=port)
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        try:
            result = sock.connect_ex(('127.0.0.1', port))
            info.is_listening = (result == 0)
        except Exception:
            info.is_listening = False
        finally:
            sock.close()
        
        if info.is_listening:
            process_info = self._get_process_for_port(port)
            if process_info:
                info.process_id = process_info.get("pid")
                info.process_name = process_info.get("name", "")
                info.process_command = process_info.get("command", "")
                info.protocol = process_info.get("protocol", "tcp")
                info.state = process_info.get("state", "LISTEN")
        
        return info
    
    def check_ports(self, ports: List[int]) -> List[PortInfo]:
        """检查多个端口"""
        return [self.check_port(port) for port in ports]
    
    def check_all_listening_ports(self) -> List[PortInfo]:
        """检查所有正在监听的端口"""
        return self._get_all_listening_ports()
    
    def compare_ports(
        self, 
        documented_ports: List[int], 
        check_additional: bool = True
    ) -> PortCheckResult:
        """比较文档中的端口与实际占用端口"""
        result = PortCheckResult()
        result.documented_ports = documented_ports
        
        actual_info = self.check_ports(documented_ports)
        result.actual_ports = actual_info
        
        for info in actual_info:
            if not info.is_listening:
                result.missing_ports.append(info.port)
                result.mismatches.append({
                    "type": "port_not_listening",
                    "port": info.port,
                    "description": f"文档中提到的端口 {info.port} 未在监听",
                    "suggestion": "请确保服务已启动或检查端口配置"
                })
        
        if check_additional:
            all_listening = self._get_all_listening_ports()
            documented_set = set(documented_ports)
            
            for info in all_listening:
                if info.port not in documented_set and info.port > 1024:
                    result.unexpected_ports.append(info)
                    result.mismatches.append({
                        "type": "unexpected_port",
                        "port": info.port,
                        "process": info.process_name,
                        "description": f"发现未在文档中声明的监听端口 {info.port} (进程: {info.process_name})",
                        "suggestion": "请确认该端口是否应该在文档中声明，或者是否有无关服务在运行"
                    })
        
        return result
    
    def _get_process_for_port(self, port: int) -> Optional[Dict[str, Any]]:
        """获取占用指定端口的进程信息"""
        try:
            import platform
            system = platform.system()
            
            if system == "Darwin":
                return self._get_process_for_port_macos(port)
            elif system == "Linux":
                return self._get_process_for_port_linux(port)
            elif system == "Windows":
                return self._get_process_for_port_windows(port)
            
            return None
        except Exception:
            return None
    
    def _get_process_for_port_macos(self, port: int) -> Optional[Dict[str, Any]]:
        """macOS 下获取端口进程"""
        try:
            result = subprocess.run(
                ["lsof", "-i", f":{port}", "-n", "-P"],
                capture_output=True,
                text=True,
                check=False
            )
            
            lines = result.stdout.strip().split("\n")
            for line in lines[1:]:
                if not line:
                    continue
                
                parts = line.split()
                if len(parts) >= 9:
                    name = parts[0]
                    pid = int(parts[1])
                    proto = parts[7]
                    state = parts[9] if len(parts) >= 10 else "UNKNOWN"
                    
                    return {
                        "pid": pid,
                        "name": name,
                        "command": self._get_command_for_pid(pid),
                        "protocol": proto,
                        "state": state
                    }
            
            return None
        except Exception:
            return None
    
    def _get_process_for_port_linux(self, port: int) -> Optional[Dict[str, Any]]:
        """Linux 下获取端口进程"""
        try:
            result = subprocess.run(
                ["ss", "-tlnp", "sport", "=", f":{port}"],
                capture_output=True,
                text=True,
                check=False
            )
            
            lines = result.stdout.strip().split("\n")
            for line in lines[1:]:
                if not line:
                    continue
                
                match = re.search(r'pid=(\d+),fd=\d+', line)
                if match:
                    pid = int(match.group(1))
                    return {
                        "pid": pid,
                        "name": self._get_process_name_for_pid(pid),
                        "command": self._get_command_for_pid(pid),
                        "protocol": "tcp",
                        "state": "LISTEN"
                    }
            
            return None
        except Exception:
            return None
    
    def _get_process_for_port_windows(self, port: int) -> Optional[Dict[str, Any]]:
        """Windows 下获取端口进程"""
        try:
            result = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True,
                text=True,
                check=False
            )
            
            lines = result.stdout.strip().split("\n")
            for line in lines:
                if f":{port}" in line and "LISTENING" in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        pid = int(parts[4])
                        return {
                            "pid": pid,
                            "name": self._get_process_name_for_pid_windows(pid),
                            "command": "",
                            "protocol": "tcp",
                            "state": "LISTENING"
                        }
            
            return None
        except Exception:
            return None
    
    def _get_all_listening_ports(self) -> List[PortInfo]:
        """获取所有正在监听的端口"""
        ports = []
        seen_ports = set()
        
        try:
            import platform
            system = platform.system()
            
            if system == "Darwin":
                result = subprocess.run(
                    ["lsof", "-i", "-n", "-P"],
                    capture_output=True,
                    text=True,
                    check=False
                )
                
                lines = result.stdout.strip().split("\n")
                for line in lines[1:]:
                    if "LISTEN" in line:
                        match = re.search(r':(\d+)\s+\(LISTEN\)', line)
                        if match:
                            port = int(match.group(1))
                            if port not in seen_ports:
                                seen_ports.add(port)
                                info = self.check_port(port)
                                if info.is_listening:
                                    ports.append(info)
            
            elif system == "Linux":
                result = subprocess.run(
                    ["ss", "-tlnp"],
                    capture_output=True,
                    text=True,
                    check=False
                )
                
                lines = result.stdout.strip().split("\n")
                for line in lines[1:]:
                    match = re.search(r':(\d+)', line)
                    if match:
                        port = int(match.group(1))
                        if port not in seen_ports:
                            seen_ports.add(port)
                            info = self.check_port(port)
                            if info.is_listening:
                                ports.append(info)
        
        except Exception:
            pass
        
        return ports
    
    def _get_command_for_pid(self, pid: int) -> str:
        """获取进程的命令行"""
        try:
            import platform
            system = platform.system()
            
            if system in ["Darwin", "Linux"]:
                result = subprocess.run(
                    ["ps", "-p", str(pid), "-o", "command="],
                    capture_output=True,
                    text=True,
                    check=False
                )
                return result.stdout.strip()
            
            return ""
        except Exception:
            return ""
    
    def _get_process_name_for_pid(self, pid: int) -> str:
        """获取进程名称"""
        try:
            result = subprocess.run(
                ["ps", "-p", str(pid), "-o", "comm="],
                capture_output=True,
                text=True,
                check=False
            )
            return result.stdout.strip()
        except Exception:
            return ""
    
    def _get_process_name_for_pid_windows(self, pid: int) -> str:
        """Windows 下获取进程名称"""
        try:
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                capture_output=True,
                text=True,
                check=False
            )
            lines = result.stdout.strip().split("\n")
            if lines:
                parts = lines[0].split()
                if parts:
                    return parts[0]
            return ""
        except Exception:
            return ""
    
    def get_port_summary(self, ports: List[int]) -> Dict[str, Any]:
        """获取端口状态摘要"""
        results = self.check_ports(ports)
        
        listening = [p for p in results if p.is_listening]
        not_listening = [p for p in results if not p.is_listening]
        
        return {
            "total": len(ports),
            "listening": len(listening),
            "not_listening": len(not_listening),
            "listening_ports": [
                {
                    "port": p.port,
                    "process": p.process_name,
                    "pid": p.process_id
                }
                for p in listening
            ],
            "not_listening_ports": [p.port for p in not_listening]
        }
