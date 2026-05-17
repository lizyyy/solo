import yaml
from typing import List, Tuple, Dict, Any, Optional
from .models import ServiceConfig, HealthCheckConfig, HealthCheckType, ValidationError


def parse_health_check(data: Dict[str, Any], line_num: int, service_name: str) -> Tuple[Optional[HealthCheckConfig], List[ValidationError]]:
    errors: List[ValidationError] = []
    
    if not isinstance(data, dict):
        errors.append(ValidationError(
            line=line_num,
            field=f"services.{service_name}.health_check",
            message="health_check must be an object",
            raw_value=data,
            error_type="type_error"
        ))
        return None, errors
    
    type_str = data.get("type", "none").lower()
    try:
        check_type = HealthCheckType(type_str)
    except ValueError:
        errors.append(ValidationError(
            line=line_num,
            field=f"services.{service_name}.health_check.type",
            message=f"Invalid health check type: {type_str}. Valid types: http, tcp, command, none",
            raw_value=type_str,
            error_type="enum_error"
        ))
        return None, errors
    
    if check_type == HealthCheckType.HTTP and "endpoint" not in data:
        errors.append(ValidationError(
            line=line_num,
            field=f"services.{service_name}.health_check.endpoint",
            message="HTTP health check requires 'endpoint' field",
            error_type="missing_field"
        ))
    
    if check_type == HealthCheckType.COMMAND and "command" not in data:
        errors.append(ValidationError(
            line=line_num,
            field=f"services.{service_name}.health_check.command",
            message="Command health check requires 'command' field",
            error_type="missing_field"
        ))
    
    config = HealthCheckConfig(
        type=check_type,
        endpoint=data.get("endpoint"),
        timeout=data.get("timeout", 10),
        interval=data.get("interval", 2),
        max_retries=data.get("max_retries", 30),
        command=data.get("command"),
        expected_status=data.get("expected_status", 200)
    )
    
    return config, errors


def parse_service(data: Dict[str, Any], line_num: int) -> Tuple[Optional[ServiceConfig], List[ValidationError]]:
    errors: List[ValidationError] = []
    raw_data = data.copy()
    
    name = data.get("name")
    if not name or not isinstance(name, str):
        errors.append(ValidationError(
            line=line_num,
            field=f"services[{line_num}].name",
            message="Service 'name' is required and must be a string",
            raw_value=name,
            error_type="missing_field"
        ))
        return None, errors
    
    port = data.get("port")
    if port is not None and not isinstance(port, int):
        errors.append(ValidationError(
            line=line_num,
            field=f"services.{name}.port",
            message="Port must be an integer",
            raw_value=port,
            error_type="type_error"
        ))
        port = None
    
    dependencies = data.get("dependencies", [])
    if not isinstance(dependencies, list):
        errors.append(ValidationError(
            line=line_num,
            field=f"services.{name}.dependencies",
            message="Dependencies must be a list",
            raw_value=dependencies,
            error_type="type_error"
        ))
        dependencies = []
    
    start_command = data.get("start_command")
    if not start_command or not isinstance(start_command, str):
        errors.append(ValidationError(
            line=line_num,
            field=f"services.{name}.start_command",
            message="Service 'start_command' is required and must be a string",
            raw_value=start_command,
            error_type="missing_field"
        ))
        return None, errors
    
    health_check_data = data.get("health_check", {"type": "none"})
    health_check, hc_errors = parse_health_check(health_check_data, line_num, name)
    errors.extend(hc_errors)
    
    if health_check is None:
        return None, errors
    
    env = data.get("env", {})
    if not isinstance(env, dict):
        errors.append(ValidationError(
            line=line_num,
            field=f"services.{name}.env",
            message="Env must be an object with string key-value pairs",
            raw_value=env,
            error_type="type_error"
        ))
        env = {}
    
    service = ServiceConfig(
        name=name,
        port=port,
        dependencies=dependencies,
        start_command=start_command,
        stop_command=data.get("stop_command"),
        health_check=health_check,
        env=env,
        working_dir=data.get("working_dir"),
        wait_before_start=data.get("wait_before_start", 0),
        wait_after_start=data.get("wait_after_start", 0),
        line_number=line_num,
        raw_data=raw_data
    )
    
    return service, errors


class ConfigParser:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.services: Dict[str, ServiceConfig] = {}
        self.validation_errors: List[ValidationError] = []
    
    def parse(self) -> Tuple[Dict[str, ServiceConfig], List[ValidationError]]:
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            self.validation_errors.append(ValidationError(
                line=None,
                field=None,
                message=f"Config file not found: {self.config_path}",
                error_type="file_not_found"
            ))
            return {}, self.validation_errors
        except Exception as e:
            self.validation_errors.append(ValidationError(
                line=None,
                field=None,
                message=f"Failed to read config file: {str(e)}",
                error_type="file_read_error"
            ))
            return {}, self.validation_errors
        
        try:
            data = yaml.safe_load(content)
        except yaml.YAMLError as e:
            line_num = getattr(e, 'problem_mark', None)
            line = line_num.line + 1 if line_num else None
            self.validation_errors.append(ValidationError(
                line=line,
                field=None,
                message=f"YAML parse error: {str(e)}",
                error_type="yaml_error"
            ))
            return {}, self.validation_errors
        
        if not isinstance(data, dict):
            self.validation_errors.append(ValidationError(
                line=None,
                field=None,
                message="Config file root must be an object",
                raw_value=type(data).__name__,
                error_type="type_error"
            ))
            return {}, self.validation_errors
        
        services_data = data.get("services", [])
        if not isinstance(services_data, list):
            self.validation_errors.append(ValidationError(
                line=None,
                field="services",
                message="'services' must be a list",
                raw_value=type(services_data).__name__,
                error_type="type_error"
            ))
            return {}, self.validation_errors
        
        for i, service_data in enumerate(services_data):
            line_num = i + 1
            if not isinstance(service_data, dict):
                self.validation_errors.append(ValidationError(
                    line=line_num,
                    field=f"services[{i}]",
                    message="Service entry must be an object",
                    raw_value=service_data,
                    error_type="type_error"
                ))
                continue
            
            service, errors = parse_service(service_data, line_num)
            self.validation_errors.extend(errors)
            
            if service is not None:
                if service.name in self.services:
                    self.validation_errors.append(ValidationError(
                        line=line_num,
                        field=f"services.{service.name}.name",
                        message=f"Duplicate service name: {service.name}",
                        raw_value=service.name,
                        error_type="duplicate_error"
                    ))
                else:
                    self.services[service.name] = service
        
        for name, service in self.services.items():
            for dep in service.dependencies:
                if dep not in self.services:
                    self.validation_errors.append(ValidationError(
                        line=service.line_number,
                        field=f"services.{name}.dependencies",
                        message=f"Dependency '{dep}' not found in service list",
                        raw_value=dep,
                        error_type="missing_dependency"
                    ))
        
        return self.services, self.validation_errors
