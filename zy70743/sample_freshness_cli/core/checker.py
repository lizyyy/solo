import time
import uuid
import json
import re
from typing import Dict, Any, Tuple, Optional
from core.models import (
    Sample, RunResult, RunStatus, FailureCategory,
    FixRecord, FixStatus, FreshnessReport
)


class SampleChecker:
    def __init__(self):
        self.current_api_versions = self._load_current_api_versions()

    def _load_current_api_versions(self) -> Dict[str, str]:
        return {
            "/api/v1/users": "2.0.0",
            "/api/v1/orders": "1.5.0",
            "/api/v1/products": "3.0.0",
            "/api/v1/auth": "1.0.0",
            "/api/v2/users": "3.0.0",
        }

    def check_version_match(self, sample: Sample) -> Tuple[bool, str]:
        current_version = self.current_api_versions.get(sample.api_endpoint)
        if not current_version:
            return True, f"未找到接口 {sample.api_endpoint} 的版本信息，跳过检查"
        if sample.api_version == current_version:
            return True, f"版本匹配: 样例版本 {sample.api_version} == 当前版本 {current_version}"
        return False, f"版本不匹配: 样例版本 {sample.api_version} != 当前版本 {current_version}"

    def _simulate_api_call(self, sample: Sample) -> Tuple[Dict[str, Any], Optional[str]]:
        input_data = sample.input_data
        expected_output = sample.expected_output

        if not input_data:
            return {"result": None}, "输入数据为空"

        if sample.tags and "脏数据" in sample.tags:
            return None, "参数格式错误: 包含非法字符"

        if sample.tags and "边界冲突" in sample.tags:
            return {"error": "rate_limit_exceeded", "message": "请求频率超限"}, None

        if sample.tags and "空结果" in sample.tags:
            return {"data": [], "total": 0}, None

        if sample.tags and "版本不匹配" in sample.tags:
            return None, f"API版本已升级，当前接口期望版本 {sample.expected_api_version}"

        if sample.tags and "API变更" in sample.tags:
            return None, "接口字段已变更: 'user_name' 改为 'username'"

        return expected_output, None

    def _classify_failure(self, error_message: str, sample: Sample) -> FailureCategory:
        if not error_message:
            return FailureCategory.UNKNOWN

        error_lower = error_message.lower()
        if "版本" in error_lower or "version" in error_lower:
            return FailureCategory.VERSION_MISMATCH
        if "字段" in error_lower or "参数" in error_lower or "格式" in error_lower:
            return FailureCategory.API_CHANGED
        if "非法" in error_lower or "脏数据" in error_lower or "invalid" in error_lower:
            return FailureCategory.INVALID_DATA
        if "超时" in error_lower or "timeout" in error_lower:
            return FailureCategory.TIMEOUT
        if "认证" in error_lower or "auth" in error_lower or "token" in error_lower:
            return FailureCategory.AUTH_ERROR
        return FailureCategory.UNKNOWN

    def _compare_outputs(self, actual: Dict[str, Any], expected: Dict[str, Any]) -> Tuple[bool, Dict[str, bool], str]:
        checks = {}
        errors = []

        if not expected:
            checks["output_exists"] = True
            return True, checks, "空结果预期匹配"

        for key, expected_value in expected.items():
            if key not in actual:
                checks[f"has_{key}"] = False
                errors.append(f"缺少字段: {key}")
            elif actual[key] == expected_value:
                checks[f"{key}_matches"] = True
            else:
                checks[f"{key}_matches"] = False
                errors.append(f"字段 {key} 值不匹配: 预期 {expected_value}, 实际 {actual[key]}")

        checks["all_fields_match"] = len(errors) == 0
        return checks["all_fields_match"], checks, "; ".join(errors)

    def run_sample(self, sample: Sample) -> RunResult:
        start_time = time.time()
        run_id = f"run_{uuid.uuid4().hex[:8]}"

        version_matched, version_note = self.check_version_match(sample)
        checks = {"version_match": version_matched}

        if not version_matched:
            duration = int((time.time() - start_time) * 1000)
            return RunResult(
                run_id=run_id,
                sample_id=sample.sample_id,
                status=RunStatus.FAILED,
                error_message=version_note,
                failure_category=FailureCategory.VERSION_MISMATCH,
                duration_ms=duration,
                version_matched=False,
                checks=checks
            )

        try:
            actual_output, error = self._simulate_api_call(sample)
            checks["api_call_success"] = error is None

            if error:
                duration = int((time.time() - start_time) * 1000)
                failure_category = self._classify_failure(error, sample)
                return RunResult(
                    run_id=run_id,
                    sample_id=sample.sample_id,
                    status=RunStatus.FAILED,
                    error_message=error,
                    failure_category=failure_category,
                    duration_ms=duration,
                    version_matched=version_matched,
                    checks=checks
                )

            output_matched, output_checks, output_error = self._compare_outputs(
                actual_output, sample.expected_output
            )
            checks.update(output_checks)
            checks["output_matches"] = output_matched

            duration = int((time.time() - start_time) * 1000)

            if output_matched:
                return RunResult(
                    run_id=run_id,
                    sample_id=sample.sample_id,
                    status=RunStatus.PASSED,
                    actual_output=actual_output,
                    duration_ms=duration,
                    version_matched=version_matched,
                    checks=checks
                )
            else:
                failure_category = self._classify_failure(output_error, sample)
                return RunResult(
                    run_id=run_id,
                    sample_id=sample.sample_id,
                    status=RunStatus.FAILED,
                    actual_output=actual_output,
                    error_message=output_error,
                    failure_category=failure_category,
                    duration_ms=duration,
                    version_matched=version_matched,
                    checks=checks
                )

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            return RunResult(
                run_id=run_id,
                sample_id=sample.sample_id,
                status=RunStatus.FAILED,
                error_message=f"运行时异常: {str(e)}",
                failure_category=FailureCategory.UNKNOWN,
                duration_ms=duration,
                version_matched=version_matched,
                checks=checks
            )

    def generate_fix_recommendation(self, result: RunResult, sample: Sample) -> str:
        if result.failure_category == FailureCategory.VERSION_MISMATCH:
            current_version = self.current_api_versions.get(sample.api_endpoint, "latest")
            return f"请将样例版本从 {sample.api_version} 升级到 {current_version}"
        elif result.failure_category == FailureCategory.API_CHANGED:
            return "请根据最新接口文档更新请求参数和字段映射"
        elif result.failure_category == FailureCategory.INVALID_DATA:
            return "请清理样例中的脏数据，使用符合接口规范的测试数据"
        elif result.failure_category == FailureCategory.TIMEOUT:
            return "请检查网络连接或增加超时时间，接口响应较慢"
        else:
            return f"请参考接口文档排查错误: {result.error_message}"
