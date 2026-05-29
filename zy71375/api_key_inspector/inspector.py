import logging
from typing import Dict, Any

from .config import Config
from .data_loader import DataLoader
from .key_version_checker import KeyVersionChecker
from .service_scanner import ServiceScanner
from .callback_validator import CallbackValidator
from .alert_manager import AlertManager
from .report_exporter import ReportExporter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class APIKeyRotationInspector:
    def __init__(self, config_path: str = None):
        self.config = Config(config_path)
        self.data_loader = DataLoader(self.config)
        self.key_checker = KeyVersionChecker(self.config)
        self.service_scanner = ServiceScanner(self.config)
        self.callback_validator = CallbackValidator(self.config)
        self.alert_manager = AlertManager(self.config)
        self.report_exporter = ReportExporter(self.config)

    def run_inspection(self, run_id: str = None) -> Dict[str, Any]:
        logger.info("开始API密钥轮换巡检")

        raw_data = self.data_loader.load_all()

        key_check_results = self.key_checker.check_key_versions(
            raw_data.get("key_versions"),
            raw_data.get("service_list")
        )
        logger.info(f"密钥版本检查完成，发现 {len(key_check_results.get('deprecated_keys_in_use', []))} 个旧密钥仍在使用")

        service_scan_results = self.service_scanner.scan_services(
            raw_data.get("service_list"),
            raw_data.get("owners"),
            raw_data.get("task_logs"),
            key_check_results.get("service_key_mapping", {})
        )
        logger.info(f"服务扫描完成，发现 {len(service_scan_results.get('services_missing_owner', []))} 个服务缺少负责人")

        callback_validation_results = self.callback_validator.validate_callbacks(
            raw_data.get("callback_urls"),
            raw_data.get("key_versions")
        )
        logger.info(f"回调验证完成，发现 {len(callback_validation_results.get('signature_failures', []))} 个回调签名失败")

        alert_results = self.alert_manager.collect_and_deduplicate_alerts(
            key_check_results,
            service_scan_results,
            callback_validation_results
        )
        logger.info(f"告警收集完成，共 {alert_results.get('summary', {}).get('total', 0)} 个告警")

        inspection_results = {
            "run_id": run_id or self.report_exporter.generate_run_id(),
            "data_summary": self.data_loader.get_data_summary(),
            "key_check_results": key_check_results,
            "service_scan_results": service_scan_results,
            "callback_validation_results": callback_validation_results,
            "alert_results": alert_results,
            "raw_data": raw_data
        }

        exported_files = self.report_exporter.export_full_report(inspection_results, run_id)
        logger.info(f"报告已导出到: {exported_files}")

        self._print_summary(inspection_results)

        return inspection_results

    def compare_runs(self, run_id1: str, run_id2: str) -> Dict[str, Any]:
        logger.info(f"对比运行 {run_id1} 和 {run_id2}")
        diff_result = self.report_exporter.compare_runs(run_id1, run_id2)
        print(self.report_exporter.format_diff_report(diff_result))
        return diff_result

    def list_runs(self):
        runs = self.report_exporter.list_available_runs()
        print("可用的运行记录:")
        for i, run_id in enumerate(runs, 1):
            print(f"  {i}. {run_id}")
        return runs

    def _print_summary(self, results: Dict[str, Any]):
        print("\n" + "=" * 60)
        print("API密钥轮换巡检 - 检查结果摘要")
        print("=" * 60)

        summary = results.get("alert_results", {}).get("summary", {})
        print(f"\n告警统计:")
        print(f"  严重(Critical): {summary.get('critical', 0)}")
        print(f"  高级(High): {summary.get('high', 0)}")
        print(f"  中级(Medium): {summary.get('medium', 0)}")
        print(f"  总计: {summary.get('total', 0)}")

        key_check = results.get("key_check_results", {})
        print(f"\n密钥检查:")
        print(f"  旧密钥仍启用: {len(key_check.get('deprecated_keys_in_use', []))}")

        service_scan = results.get("service_scan_results", {})
        print(f"\n服务扫描:")
        print(f"  缺少负责人: {len(service_scan.get('services_missing_owner', []))}")
        print(f"  使用旧密钥: {len(service_scan.get('services_with_old_keys', []))}")

        callback = results.get("callback_validation_results", {})
        print(f"\n回调验证:")
        print(f"  签名失败: {len(callback.get('signature_failures', []))}")
        print(f"  URL格式错误: {len(callback.get('url_format_errors', []))}")

        print("\n" + "=" * 60)
        print("重点关注问题（按风险排序）:")
        print("-" * 60)

        critical_issues = []
        if key_check.get("deprecated_keys_in_use"):
            critical_issues.append("【高危】旧密钥版本仍在使用中 - 存在安全风险，应立即禁用")
        if callback.get("signature_failures"):
            critical_issues.append("【高危】回调签名验证失败 - 影响第三方对接稳定性")
        if service_scan.get("services_missing_owner"):
            critical_issues.append("【中危】服务缺少负责人 - 出现问题无法快速定位")

        if critical_issues:
            for issue in critical_issues:
                print(f"  {issue}")
        else:
            print("  本次巡检未发现严重问题")

        print("=" * 60 + "\n")
