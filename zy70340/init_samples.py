#!/usr/bin/env python3
"""初始化样例数据"""
import json
import shutil
from pathlib import Path
from datetime import date, timedelta


def main():
    data_dir = Path("./data")
    samples_dir = Path("./samples")
    
    if data_dir.exists():
        shutil.rmtree(data_dir)
    data_dir.mkdir(parents=True)
    
    with open(samples_dir / "scan_results.json", "r", encoding="utf-8") as f:
        scan_data = json.load(f)
    
    vulnerabilities = []
    for item in scan_data:
        vuln = {
            "id": item["id"],
            "cve_id": item.get("cve_id"),
            "title": item["title"],
            "description": item["description"],
            "ecosystem": item["ecosystem"],
            "package_name": item["package_name"],
            "severity": item["severity"],
            "exploitability": item["exploitability"],
            "fixed_version": item["fixed_version"],
            "cwe": item.get("cwe", ""),
            "cvss_score": item.get("cvss_score"),
            "references": item.get("references", []),
            "import_date": date.today().isoformat(),
            "scan_id": "sample-scan-001"
        }
        vulnerabilities.append(vuln)
    
    with open(data_dir / "vulnerabilities.json", "w", encoding="utf-8") as f:
        json.dump(vulnerabilities, f, indent=2, ensure_ascii=False)
    
    shutil.copy(samples_dir / "services.json", data_dir / "services.json")
    shutil.copy(samples_dir / "dependencies.json", data_dir / "dependencies.json")
    
    exceptions = [
        {
            "id": "exc-GHSA-33pv-vcgg-jfpc-api-gateway",
            "vulnerability_id": "GHSA-33pv-vcgg-jfpc",
            "service_name": "api-gateway",
            "reason": "minimist 仅在构建时使用，运行时不加载，不影响实际服务",
            "owner": "安全团队",
            "approve_date": date.today().isoformat(),
            "expire_date": (date.today() + timedelta(days=90)).isoformat(),
            "notes": "经过代码审查，确认该依赖仅用于构建脚本"
        }
    ]
    
    with open(data_dir / "exceptions.json", "w", encoding="utf-8") as f:
        json.dump(exceptions, f, indent=2, ensure_ascii=False)
    
    triage_results = [
        {
            "id": "tr-SNYK-PYTHON-URLLIB3-559452-payment-service",
            "vulnerability_id": "SNYK-PYTHON-URLLIB3-559452",
            "service_name": "payment-service",
            "status": "fixed",
            "triager": "赵敏",
            "triage_date": date.today().isoformat(),
            "notes": "升级 requests 到 2.26.0，间接升级 urllib3 到 1.26.7",
            "fixed_version": "1.26.7"
        }
    ]
    
    with open(data_dir / "triage_results.json", "w", encoding="utf-8") as f:
        json.dump(triage_results, f, indent=2, ensure_ascii=False)
    
    print("样例数据初始化完成！")
    print(f"\n数据目录: {data_dir.absolute()}")
    print("\n漏洞分布:")
    print("  1. 高危可利用 (lodash) - 影响 api-gateway (公网暴露) 和 user-service")
    print("  2. 中危内部服务 (jackson-databind) - 影响 order-service")
    print("  3. 已例外 (minimist) - 影响 api-gateway，已批准90天例外")
    print("  4. 已修复 (urllib3) - payment-service 已升级修复")


if __name__ == "__main__":
    main()
