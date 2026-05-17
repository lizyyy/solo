import socket
import time
import subprocess
import requests
from typing import Optional
from .models import (
    PortCheckResult,
    HealthCheckResult,
    HealthCheckConfig,
    HealthCheckType
)


class HealthChecker:
    @staticmethod
    def check_port(port: int, host: str = "localhost") -> PortCheckResult:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex((host, port))
            sock.close()
            
            if result == 0:
                return PortCheckResult(port=port, is_available=False, error=f"Port {port} is already in use")
            return PortCheckResult(port=port, is_available=True)
        except Exception as e:
            return PortCheckResult(port=port, is_available=False, error=str(e))
    
    @staticmethod
    def check_http(endpoint: str, expected_status: int = 200, timeout: int = 10) -> HealthCheckResult:
        start_time = time.time()
        try:
            response = requests.get(endpoint, timeout=timeout)
            elapsed = time.time() - start_time
            
            if response.status_code == expected_status:
                return HealthCheckResult(
                    success=True,
                    status_code=response.status_code,
                    response_time=elapsed
                )
            else:
                return HealthCheckResult(
                    success=False,
                    status_code=response.status_code,
                    response_time=elapsed,
                    error=f"Expected status {expected_status}, got {response.status_code}"
                )
        except requests.exceptions.RequestException as e:
            return HealthCheckResult(
                success=False,
                error=str(e)
            )
    
    @staticmethod
    def check_tcp(port: int, host: str = "localhost", timeout: int = 10) -> HealthCheckResult:
        start_time = time.time()
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()
            elapsed = time.time() - start_time
            
            if result == 0:
                return HealthCheckResult(success=True, response_time=elapsed)
            else:
                return HealthCheckResult(success=False, error=f"Connection failed with code {result}")
        except Exception as e:
            return HealthCheckResult(success=False, error=str(e))
    
    @staticmethod
    def check_command(command: str, timeout: int = 30) -> HealthCheckResult:
        start_time = time.time()
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            elapsed = time.time() - start_time
            
            if result.returncode == 0:
                return HealthCheckResult(
                    success=True,
                    response_time=elapsed,
                    output=result.stdout
                )
            else:
                return HealthCheckResult(
                    success=False,
                    response_time=elapsed,
                    error=f"Command exited with code {result.returncode}",
                    output=result.stderr or result.stdout
                )
        except subprocess.TimeoutExpired:
            return HealthCheckResult(
                success=False,
                error=f"Command timed out after {timeout}s"
            )
        except Exception as e:
            return HealthCheckResult(success=False, error=str(e))
    
    @classmethod
    def check(cls, config: HealthCheckConfig) -> HealthCheckResult:
        if config.type == HealthCheckType.NONE:
            return HealthCheckResult(success=True, error="No health check configured")
        elif config.type == HealthCheckType.HTTP:
            return cls.check_http(config.endpoint, config.expected_status, config.timeout)
        elif config.type == HealthCheckType.TCP:
            return cls.check_tcp(config.port, "localhost", config.timeout)
        elif config.type == HealthCheckType.COMMAND:
            return cls.check_command(config.command, config.timeout)
        else:
            return HealthCheckResult(success=False, error=f"Unknown health check type: {config.type}")
    
    @classmethod
    def wait_until_healthy(cls, config: HealthCheckConfig) -> HealthCheckResult:
        if config.type == HealthCheckType.NONE:
            return HealthCheckResult(success=True, error="No health check configured")
        
        for attempt in range(config.max_retries):
            result = cls.check(config)
            if result.success:
                return result
            if attempt < config.max_retries - 1:
                time.sleep(config.interval)
        
        return result
