import subprocess
import time
import os
from typing import Dict, List
from .models import (
    ServiceConfig,
    ServiceExecutionResult,
    ServiceStatus,
    OrchestrationReport
)
from .health_checker import HealthChecker
from .dependency_graph import DependencyGraph


class ServiceRunner:
    def __init__(self, services: Dict[str, ServiceConfig]):
        self.services = services
        self.results: Dict[str, ServiceExecutionResult] = {}
        self.dependency_graph = DependencyGraph(services)
    
    def run_service(self, name: str, order: int) -> ServiceExecutionResult:
        service = self.services[name]
        result = ServiceExecutionResult(
            service_name=name,
            status=ServiceStatus.RUNNING,
            start_order=order
        )
        result.start_time = time.time()
        
        for dep in service.dependencies:
            if dep in self.results and self.results[dep].status != ServiceStatus.SUCCESS:
                result.status = ServiceStatus.SKIPPED
                result.error = f"Skipped due to failed dependency: {dep}"
                result.end_time = time.time()
                return result
        
        if service.wait_before_start > 0:
            time.sleep(service.wait_before_start)
        
        if service.port is not None:
            port_result = HealthChecker.check_port(service.port)
            result.port_check = port_result
            if not port_result.is_available:
                result.status = ServiceStatus.FAILED
                result.error = f"Port {service.port} is already in use"
                result.end_time = time.time()
                return result
        
        try:
            env = os.environ.copy()
            env.update(service.env)
            
            proc = subprocess.Popen(
                service.start_command,
                shell=True,
                cwd=service.working_dir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            if service.wait_after_start > 0:
                time.sleep(service.wait_after_start)
            
            if service.health_check.type.value != "none":
                health_result = HealthChecker.wait_until_healthy(service.health_check)
                result.health_check = health_result
                
                if not health_result.success:
                    proc.terminate()
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                    
                    stdout, stderr = proc.communicate()
                    result.stdout = stdout
                    result.stderr = stderr
                    result.exit_code = proc.returncode
                    result.status = ServiceStatus.FAILED
                    result.error = f"Health check failed: {health_result.error}"
                    result.end_time = time.time()
                    return result
            
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
            
            stdout, stderr = proc.communicate()
            result.stdout = stdout
            result.stderr = stderr
            result.exit_code = proc.returncode
            
            result.status = ServiceStatus.SUCCESS
            
        except Exception as e:
            result.status = ServiceStatus.FAILED
            result.error = str(e)
        
        result.end_time = time.time()
        return result
    
    def run_all(self) -> OrchestrationReport:
        total_start = time.time()
        
        start_order, cycles = self.dependency_graph.get_topological_order()
        
        if cycles:
            report = OrchestrationReport(
                total_services=len(self.services),
                successful=0,
                failed=0,
                skipped=len(self.services),
                start_order=[],
                results={},
                circular_dependencies=cycles
            )
            return report
        
        successful = 0
        failed = 0
        skipped = 0
        
        for i, name in enumerate(start_order):
            result = self.run_service(name, i + 1)
            self.results[name] = result
            
            if result.status == ServiceStatus.SUCCESS:
                successful += 1
            elif result.status == ServiceStatus.FAILED:
                failed += 1
            elif result.status == ServiceStatus.SKIPPED:
                skipped += 1
        
        total_time = time.time() - total_start
        
        return OrchestrationReport(
            total_services=len(self.services),
            successful=successful,
            failed=failed,
            skipped=skipped,
            start_order=start_order,
            results=self.results,
            total_time=total_time
        )
    
    def diagnose_failure(self, service_name: str) -> Dict[str, str]:
        result = self.results.get(service_name)
        if not result:
            return {"error": "No result found for service"}
        
        diagnosis = {}
        
        if result.error:
            diagnosis["root_cause"] = result.error
        
        if result.port_check and not result.port_check.is_available:
            diagnosis["port_issue"] = result.port_check.error
        
        if result.health_check and not result.health_check.success:
            diagnosis["health_check_issue"] = result.health_check.error
            if result.health_check.output:
                diagnosis["health_check_output"] = result.health_check.output
        
        if result.stderr:
            diagnosis["stderr"] = result.stderr[:500]
        
        if result.exit_code is not None and result.exit_code != 0:
            diagnosis["exit_code"] = str(result.exit_code)
        
        for dep in self.services[service_name].dependencies:
            dep_result = self.results.get(dep)
            if dep_result and dep_result.status != ServiceStatus.SUCCESS:
                diagnosis[f"dependency_{dep}_failed"] = dep_result.error or "Unknown failure"
        
        return diagnosis
