#!/usr/bin/env python3
import argparse
import json
import yaml
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional


class InstallationReceiptChecker:
    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        self.results = {
            "check_time": datetime.now().isoformat(),
            "total_files": 0,
            "passed": 0,
            "failed": 0,
            "parse_errors": 0,
            "success_files": [],
            "failed_files": [],
            "error_summary": []
        }
        self.rules = self.config.get("appliance_installation_check", {}).get("rules", {})
        self.business_rules = self.config.get("appliance_installation_check", {}).get("business_rules", {})

    def _load_config(self, config_path: str) -> Dict:
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            self._print_error(f"配置文件未找到: {config_path}")
            sys.exit(1)
        except yaml.YAMLError as e:
            self._print_error(f"配置文件解析错误: {str(e)}")
            sys.exit(1)

    def _print_error(self, message: str):
        RED = '\033[91m'
        RESET = '\033[0m'
        print(f"{RED}[错误] {message}{RESET}", file=sys.stderr)

    def _print_warning(self, message: str):
        YELLOW = '\033[93m'
        RESET = '\033[0m'
        print(f"{YELLOW}[警告] {message}{RESET}")

    def _print_success(self, message: str):
        GREEN = '\033[92m'
        RESET = '\033[0m'
        print(f"{GREEN}[通过] {message}{RESET}")

    def _print_info(self, message: str):
        CYAN = '\033[96m'
        RESET = '\033[0m'
        print(f"{CYAN}[信息] {message}{RESET}")

    def check_photo_blur(self, receipt_data: Dict) -> Dict[str, Any]:
        rule = self.rules.get("photo_blur", {})
        if not rule.get("enabled", True):
            return {"passed": True, "details": "照片模糊检查已禁用"}

        threshold = rule.get("threshold", 100)
        errors = []
        photos = receipt_data.get("photos", [])
        
        for photo in photos:
            photo_type = photo.get("type", "unknown")
            blur_score = photo.get("blur_score", 0)
            file_path = photo.get("file_path", "unknown")
            
            if blur_score < threshold:
                errors.append({
                    "photo_type": photo_type,
                    "file_path": file_path,
                    "blur_score": blur_score,
                    "threshold": threshold,
                    "issue": f"照片模糊度={blur_score} < 阈值={threshold}"
                })

        if errors:
            return {
                "passed": False,
                "rule": "photo_blur",
                "error_message": rule.get("error_message", "照片模糊度不达标"),
                "details": errors
            }
        
        return {"passed": True, "details": f"所有{len(photos)}张照片清晰度达标"}

    def check_signature_missing(self, receipt_data: Dict) -> Dict[str, Any]:
        rule = self.rules.get("signature_missing", {})
        if not rule.get("enabled", True):
            return {"passed": True, "details": "签名缺失检查已禁用"}

        required_fields = rule.get("required_fields", [])
        missing_fields = []
        
        for field in required_fields:
            value = receipt_data.get(field, "")
            if not value or value.strip() == "":
                missing_fields.append(field)

        if missing_fields:
            return {
                "passed": False,
                "rule": "signature_missing",
                "error_message": rule.get("error_message", "缺少必要签名"),
                "details": {
                    "missing_fields": missing_fields,
                    "required_fields": required_fields
                }
            }
        
        return {"passed": True, "details": "所有签名字段完整"}

    def check_business_rules(self, receipt_data: Dict) -> Dict[str, Any]:
        errors = []
        photos = receipt_data.get("photos", [])
        
        min_photo_count = self.business_rules.get("min_photo_count", 3)
        if len(photos) < min_photo_count:
            errors.append({
                "rule": "min_photo_count",
                "issue": f"照片数量不足: {len(photos)}张 < 要求{min_photo_count}张"
            })

        required_types = self.business_rules.get("required_photo_types", [])
        actual_types = [p.get("type") for p in photos]
        missing_types = [t for t in required_types if t not in actual_types]
        if missing_types:
            errors.append({
                "rule": "required_photo_types",
                "issue": f"缺少必要照片类型: {', '.join(missing_types)}"
            })

        if errors:
            return {"passed": False, "rule": "business_rules", "error_message": "业务规则校验失败", "details": errors}
        
        return {"passed": True, "details": "业务规则校验通过"}

    def check_single_receipt(self, file_path: str) -> Dict:
        receipt_result = {
            "file_path": os.path.abspath(file_path),
            "file_name": os.path.basename(file_path),
            "check_time": datetime.now().isoformat(),
            "rules_checked": [],
            "all_passed": True,
            "parse_error": None
        }

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                receipt_data = json.load(f)
        except json.JSONDecodeError as e:
            receipt_result["parse_error"] = f"JSON解析失败: {str(e)}"
            receipt_result["all_passed"] = False
            self._print_error(f"文件解析失败 - {os.path.basename(file_path)}: {str(e)}")
            return receipt_result
        except Exception as e:
            receipt_result["parse_error"] = f"文件读取失败: {str(e)}"
            receipt_result["all_passed"] = False
            self._print_error(f"文件读取失败 - {os.path.basename(file_path)}: {str(e)}")
            return receipt_result

        receipt_result["installation_id"] = receipt_data.get("installation_id", "unknown")
        receipt_result["technician"] = receipt_data.get("technician", "unknown")

        blur_result = self.check_photo_blur(receipt_data)
        receipt_result["rules_checked"].append(blur_result)
        if not blur_result["passed"]:
            receipt_result["all_passed"] = False

        sig_result = self.check_signature_missing(receipt_data)
        receipt_result["rules_checked"].append(sig_result)
        if not sig_result["passed"]:
            receipt_result["all_passed"] = False

        business_result = self.check_business_rules(receipt_data)
        receipt_result["rules_checked"].append(business_result)
        if not business_result["passed"]:
            receipt_result["all_passed"] = False

        return receipt_result

    def process_files(self, input_paths: List[str]):
        all_files = []
        
        for path in input_paths:
            if os.path.isdir(path):
                for root, _, files in os.walk(path):
                    for file in files:
                        if file.endswith('.json'):
                            all_files.append(os.path.join(root, file))
            elif os.path.isfile(path) and path.endswith('.json'):
                all_files.append(path)

        self.results["total_files"] = len(all_files)
        
        if not all_files:
            self._print_warning("未找到任何JSON回执文件")
            return

        self._print_info(f"开始检查 {len(all_files)} 个家电安装回执文件...")
        print("=" * 80)

        for i, file_path in enumerate(all_files, 1):
            self._print_info(f"处理中 ({i}/{len(all_files)}): {os.path.basename(file_path)}")
            
            result = self.check_single_receipt(file_path)
            
            if result["parse_error"]:
                self.results["parse_errors"] += 1
                self.results["error_summary"].append({
                    "file": file_path,
                    "error": result["parse_error"]
                })
            elif result["all_passed"]:
                self.results["passed"] += 1
                self.results["success_files"].append(result)
                self._print_success(f"检查通过 - {os.path.basename(file_path)}")
            else:
                self.results["failed"] += 1
                self.results["failed_files"].append(result)
                
                failed_rules = [r for r in result["rules_checked"] if not r["passed"]]
                for rule in failed_rules:
                    self._print_warning(f"  未通过规则: {rule['rule']} - {rule['error_message']}")
                    if "details" in rule:
                        if isinstance(rule["details"], list):
                            for detail in rule["details"]:
                                self._print_warning(f"    - {detail.get('issue', str(detail))}")
                        elif isinstance(rule["details"], dict):
                            if "missing_fields" in rule["details"]:
                                self._print_warning(f"    - 缺失字段: {', '.join(rule['details']['missing_fields'])}")

            print("-" * 80)

    def generate_report(self, output_dir: Optional[str] = None):
        if output_dir is None:
            output_config = self.config.get("appliance_installation_check", {}).get("output", {})
            output_dir = output_config.get("retry_output_dir", "./output")
        
        os.makedirs(output_dir, exist_ok=True)
        
        summary_filename = self.config.get("appliance_installation_check", {}).get("output", {}).get("summary_filename", "check_summary.json")
        summary_path = os.path.join(output_dir, summary_filename)
        
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        
        failed_files_path = os.path.join(output_dir, "failed_files_only.json")
        with open(failed_files_path, "w", encoding="utf-8") as f:
            json.dump(self.results["failed_files"] + self.results["error_summary"], f, ensure_ascii=False, indent=2)

        self._print_info(f"检查报告已生成至: {output_dir}")
        self._print_info(f"  - 完整报告: {summary_path}")
        self._print_info(f"  - 问题文件列表: {failed_files_path}")
        
        self.print_summary()

    def print_summary(self):
        print("\n" + "=" * 80)
        print("家电安装队安装回执检查 - 汇总报告")
        print("=" * 80)
        self._print_info(f"检查时间: {self.results['check_time']}")
        print(f"总文件数: {self.results['total_files']}")
        self._print_success(f"通过: {self.results['passed']}")
        self._print_warning(f"未通过: {self.results['failed']}")
        self._print_error(f"解析错误: {self.results['parse_errors']}")
        
        if self.results["error_summary"]:
            print("\n解析错误文件列表:")
            for err in self.results["error_summary"]:
                self._print_error(f"  - {os.path.basename(err['file'])}: {err['error']}")
        
        if self.results["failed_files"]:
            print("\n未通过检查的文件列表:")
            for f in self.results["failed_files"]:
                failed_rules = [r["rule"] for r in f["rules_checked"] if not r["passed"]]
                self._print_warning(f"  - {f['file_name']} (安装ID: {f.get('installation_id', 'N/A')}): "
                                 f"未通过规则 - {', '.join(failed_rules)}")
        
        print("=" * 80)


def main():
    parser = argparse.ArgumentParser(
        description="家电安装队安装回执检查 CLI - 检查照片模糊、签名缺失等问题",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python install_check_cli.py ./receipts/          # 检查目录下所有回执
  python install_check_cli.py receipt1.json        # 检查单个回执文件
  python install_check_cli.py -c ./my_config.yaml  # 指定配置文件
  python install_check_cli.py -o ./my_output       # 指定输出目录
        """
    )
    parser.add_argument("inputs", nargs="+", help="要检查的JSON文件或目录路径")
    parser.add_argument("-c", "--config", default="config.yaml", help="配置文件路径 (默认: config.yaml)")
    parser.add_argument("-o", "--output", help="报告输出目录 (默认使用配置中的目录)")
    
    args = parser.parse_args()

    try:
        checker = InstallationReceiptChecker(args.config)
        checker.process_files(args.inputs)
        checker.generate_report(args.output)
        
        if checker.results["failed"] > 0 or checker.results["parse_errors"] > 0:
            sys.exit(1)
        
    except KeyboardInterrupt:
        print("\n用户中断操作")
        sys.exit(1)
    except Exception as e:
        print(f"\n程序执行出错: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
