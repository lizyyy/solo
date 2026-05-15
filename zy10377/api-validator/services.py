import hashlib
import json
import re
import httpx
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from models import (
    DocumentPage, RequestExample, EnvironmentVariable,
    ValidationResult, ErrorCause, FixTrace,
    ValidationStatus, ErrorCategory
)
from schemas import (
    DocumentPageCreate, RequestExampleCreate,
    EnvironmentVariableCreate, ValidationRequest
)
from config import get_settings

settings = get_settings()


def generate_hash(*args) -> str:
    content = "|".join(str(arg) for arg in args if arg is not None)
    return hashlib.sha256(content.encode()).hexdigest()


class EnvironmentService:
    @staticmethod
    def get_all(db: Session) -> List[EnvironmentVariable]:
        return db.query(EnvironmentVariable).all()

    @staticmethod
    def get_by_key(db: Session, key: str) -> Optional[EnvironmentVariable]:
        return db.query(EnvironmentVariable).filter(EnvironmentVariable.key == key).first()

    @staticmethod
    def create(db: Session, env_var: EnvironmentVariableCreate) -> EnvironmentVariable:
        existing = EnvironmentService.get_by_key(db, env_var.key)
        if existing:
            return existing
        db_env = EnvironmentVariable(**env_var.model_dump())
        db.add(db_env)
        db.commit()
        db.refresh(db_env)
        return db_env

    @staticmethod
    def get_environment_dict(db: Session) -> Dict[str, str]:
        envs = EnvironmentService.get_all(db)
        return {env.key: env.value for env in envs if not env.is_secret}

    @staticmethod
    def inject_environment(value: str, env: Dict[str, str]) -> str:
        if not value:
            return value
        pattern = r'\{\{\s*(\w+)\s*\}\}'
        def replace(match):
            key = match.group(1)
            return env.get(key, match.group(0))
        return re.sub(pattern, replace, value)


class ExampleExtractor:
    @staticmethod
    def extract_from_markdown(content: str) -> List[Dict]:
        examples = []
        code_block_pattern = r'```(\w+)?\s*\n([\s\S]*?)\n```'
        matches = re.findall(code_block_pattern, content)
        for lang, code in matches:
            if lang in ['json', 'http'] or 'curl' in code:
                example = ExampleExtractor._parse_code_block(code, lang)
                if example:
                    examples.append(example)
        return examples

    @staticmethod
    def _parse_code_block(code: str, lang: str) -> Optional[Dict]:
        if 'curl' in code:
            return ExampleExtractor._parse_curl(code)
        elif lang == 'http' or code.startswith(('GET', 'POST', 'PUT', 'DELETE')):
            return ExampleExtractor._parse_http(code)
        return None

    @staticmethod
    def _parse_curl(curl_cmd: str) -> Optional[Dict]:
        method = 'GET'
        url = ''
        headers = {}
        body = None
        method_match = re.search(r'-X\s+(\w+)', curl_cmd)
        if method_match:
            method = method_match.group(1).upper()
        url_match = re.search(r'curl\s+["\']([^"\']+)["\']', curl_cmd)
        if not url_match:
            url_match = re.search(r'curl\s+(https?://\S+)', curl_cmd)
        if not url_match:
            url_match = re.search(r'["\'](https?://[^"\']+)["\']', curl_cmd)
        if not url_match:
            url_match = re.search(r'(https?://\S+)', curl_cmd)
        if url_match:
            url = url_match.group(1).rstrip('\\').strip()
        header_matches = re.findall(r'-H\s+["\']([^:]+):\s*([^"\']+)["\']', curl_cmd)
        for key, value in header_matches:
            headers[key.strip()] = value.strip()
        body_match = re.search(r'-d\s+["\']([^"\']+)["\']', curl_cmd)
        if body_match:
            body = body_match.group(1)
            method = method if method != 'GET' else 'POST'
        if url:
            return {
                'name': f'curl example - {method} {url[:50]}',
                'method': method,
                'url': url,
                'headers': headers,
                'body': body,
                'expected_status': 200
            }
        return None

    @staticmethod
    def _parse_http(http_content: str) -> Optional[Dict]:
        lines = http_content.strip().split('\n')
        if not lines:
            return None
        first_line = lines[0].strip()
        match = re.match(r'(\w+)\s+(\S+)', first_line)
        if not match:
            return None
        method = match.group(1).upper()
        url = match.group(2)
        headers = {}
        body = None
        i = 1
        while i < len(lines) and lines[i].strip() and ':' in lines[i]:
            key, value = lines[i].split(':', 1)
            headers[key.strip()] = value.strip()
            i += 1
        if i < len(lines):
            body_lines = lines[i+1:] if not lines[i].strip() else lines[i:]
            body = '\n'.join(body_lines).strip() or None
        return {
            'name': f'HTTP example - {method} {url[:50]}',
            'method': method,
            'url': url,
            'headers': headers,
            'body': body,
            'expected_status': 200
        }


class ValidationService:
    @staticmethod
    def classify_error(exception: Exception, response: Optional[httpx.Response] = None) -> Tuple[ErrorCategory, str, Dict]:
        if isinstance(exception, httpx.TimeoutException):
            return ErrorCategory.TIMEOUT, "Request timeout", {'timeout': settings.VALIDATION_TIMEOUT}
        if isinstance(exception, httpx.NetworkError):
            return ErrorCategory.NETWORK_ERROR, "Network connection error", {'error': str(exception)}
        if isinstance(exception, httpx.HTTPStatusError):
            if response:
                if response.status_code in [401, 403]:
                    return ErrorCategory.AUTH_ERROR, "Authentication failed", {'status_code': response.status_code}
                return ErrorCategory.STATUS_CODE_MISMATCH, f"Status code mismatch: {response.status_code}", {
                    'expected': 200,
                    'actual': response.status_code
                }
        return ErrorCategory.UNKNOWN, str(exception), {}

    @staticmethod
    async def validate_example(
        db: Session,
        example: RequestExample,
        custom_env: Optional[Dict[str, str]] = None
    ) -> ValidationResult:
        env = EnvironmentService.get_environment_dict(db)
        if custom_env:
            env.update(custom_env)
        url = EnvironmentService.inject_environment(example.url, env)
        headers = example.headers or {}
        injected_headers = {k: EnvironmentService.inject_environment(v, env) for k, v in headers.items()}
        body = EnvironmentService.inject_environment(example.body, env) if example.body else None
        for key in re.findall(r'\{\{\s*(\w+)\s*\}\}', url):
            if key not in env:
                result = ValidationResult(
                    example_id=example.id,
                    status=ValidationStatus.FAILED,
                    started_at=datetime.utcnow(),
                    completed_at=datetime.utcnow()
                )
                db.add(result)
                db.commit()
                db.refresh(result)
                error = ErrorCause(
                    validation_result_id=result.id,
                    category=ErrorCategory.ENVIRONMENT_MISSING,
                    message=f"Missing environment variable: {key}",
                    details={'missing_key': key},
                    suggested_fix=f"Add environment variable '{key}' in environment management"
                )
                db.add(error)
                db.commit()
                return result
        result = ValidationResult(
            example_id=example.id,
            status=ValidationStatus.RUNNING,
            started_at=datetime.utcnow()
        )
        db.add(result)
        db.commit()
        try:
            async with httpx.AsyncClient(timeout=settings.VALIDATION_TIMEOUT) as client:
                request_body = json.loads(body) if body and body.strip().startswith('{') else body
                response = await client.request(
                    method=example.method,
                    url=url,
                    headers=injected_headers,
                    json=request_body if isinstance(request_body, dict) else None,
                    content=body if not isinstance(request_body, dict) else None
                )
                result.actual_status = response.status_code
                result.actual_response = response.text[:5000]
                expected_status = example.expected_status or 200
                if response.status_code == expected_status:
                    result.status = ValidationStatus.SUCCESS
                else:
                    result.status = ValidationStatus.FAILED
                    error_category = ErrorCategory.STATUS_CODE_MISMATCH
                    if response.status_code in [401, 403]:
                        error_category = ErrorCategory.AUTH_ERROR
                    error = ErrorCause(
                        validation_result_id=result.id,
                        category=error_category,
                        message=f"Expected status {expected_status} but got {response.status_code}",
                        details={'expected': expected_status, 'actual': response.status_code},
                        suggested_fix="Check authentication credentials or request parameters"
                    )
                    db.add(error)
        except Exception as e:
            result.status = ValidationStatus.FAILED
            category, message, details = ValidationService.classify_error(e)
            error = ErrorCause(
                validation_result_id=result.id,
                category=category,
                message=message,
                details=details,
                suggested_fix=ValidationService._get_suggested_fix(category)
            )
            db.add(error)
        finally:
            result.completed_at = datetime.utcnow()
            if result.started_at:
                result.response_time_ms = int((result.completed_at - result.started_at).total_seconds() * 1000)
            db.commit()
            db.refresh(result)
        return result

    @staticmethod
    def _get_suggested_fix(category: ErrorCategory) -> str:
        suggestions = {
            ErrorCategory.TIMEOUT: "Check network connectivity or increase timeout",
            ErrorCategory.NETWORK_ERROR: "Verify API endpoint is accessible",
            ErrorCategory.AUTH_ERROR: "Update authentication credentials in environment",
            ErrorCategory.STATUS_CODE_MISMATCH: "Verify request parameters match API requirements",
            ErrorCategory.RESPONSE_SCHEMA_ERROR: "Update expected response schema",
            ErrorCategory.ENVIRONMENT_MISSING: "Add missing environment variables"
        }
        return suggestions.get(category, "Review request configuration manually")


class DuplicateGuard:
    @staticmethod
    def check_duplicate_example(db: Session, content_hash: str) -> Optional[RequestExample]:
        return db.query(RequestExample).filter(RequestExample.content_hash == content_hash).first()

    @staticmethod
    def check_duplicate_page(db: Session, content_hash: str) -> Optional[DocumentPage]:
        return db.query(DocumentPage).filter(DocumentPage.content_hash == content_hash).first()

    @staticmethod
    def check_pending_validation(db: Session, example_id: int) -> Optional[ValidationResult]:
        return db.query(ValidationResult).filter(
            ValidationResult.example_id == example_id,
            ValidationResult.status.in_([ValidationStatus.PENDING, ValidationStatus.RUNNING])
        ).first()


class FixTraceService:
    @staticmethod
    def create_fix_trace(
        db: Session,
        validation_result_id: int,
        action_taken: str,
        operator: str,
        remark: Optional[str] = None
    ) -> FixTrace:
        fix_trace = FixTrace(
            validation_result_id=validation_result_id,
            action_taken=action_taken,
            operator=operator,
            remark=remark
        )
        db.add(fix_trace)
        db.commit()
        db.refresh(fix_trace)
        return fix_trace
