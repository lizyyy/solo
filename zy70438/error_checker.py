#!/usr/bin/env python3
import click
import sys
import os
import json
import csv
from datetime import datetime
from pathlib import Path
import pandas as pd
from tabulate import tabulate

class ErrorCodeChecker:
    def __init__(self):
        self.base_dir = Path.cwd()
        self.data_dir = self.base_dir / "data"
        self.history_dir = self.base_dir / "history"
        self.export_dir = self.base_dir / "exports"
        
        for dir_path in [self.data_dir, self.history_dir, self.export_dir]:
            dir_path.mkdir(exist_ok=True)
        
        self.error_codes_db = self._init_error_codes()
        self._load_history()
    
    def _init_error_codes(self):
        return {
            "E001": {"module": "压缩包处理", "message": "压缩包路径为空", "risk_level": "high", "covered": True},
            "E002": {"module": "压缩包处理", "message": "压缩包路径不存在", "risk_level": "high", "covered": True},
            "E003": {"module": "压缩包处理", "message": "压缩包格式不支持", "risk_level": "medium", "covered": True},
            "E004": {"module": "压缩包处理", "message": "压缩包已损坏", "risk_level": "high", "covered": False},
            "E005": {"module": "压缩包处理", "message": "压缩包密码错误", "risk_level": "medium", "covered": False},
            "E006": {"module": "文件校验", "message": "MD5校验失败", "risk_level": "high", "covered": True},
            "E007": {"module": "文件校验", "message": "文件大小超限", "risk_level": "medium", "covered": True},
            "E008": {"module": "文件校验", "message": "文件名称格式错误", "risk_level": "low", "covered": False},
            "E009": {"module": "数据解析", "message": "XML格式错误", "risk_level": "high", "covered": True},
            "E010": {"module": "数据解析", "message": "缺少必要字段", "risk_level": "high", "covered": True},
            "E011": {"module": "数据解析", "message": "日期格式无效", "risk_level": "medium", "covered": False},
            "E012": {"module": "数据解析", "message": "数值范围异常", "risk_level": "medium", "covered": False},
            "E013": {"module": "配送回执", "message": "配送单号不存在", "risk_level": "high", "covered": True},
            "E014": {"module": "配送回执", "message": "配送状态异常", "risk_level": "medium", "covered": True},
            "E015": {"module": "配送回执", "message": "签收人信息缺失", "risk_level": "low", "covered": False},
        }
    
    def _load_history(self):
        self.history_file = self.history_dir / "check_history.json"
        if self.history_file.exists():
            with open(self.history_file, 'r', encoding='utf-8') as f:
                self.history = json.load(f)
        else:
            self.history = []
    
    def _save_history(self):
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)
    
    def _generate_batch_id(self):
        return f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    def check_zip_path(self, zip_path, operator="system"):
        batch_id = self._generate_batch_id()
        results = {
            "batch_id": batch_id,
            "timestamp": datetime.now().isoformat(),
            "operator": operator,
            "zip_path": zip_path,
            "success": True,
            "errors": [],
            "warnings": [],
            "risk_type": []
        }
        
        if not zip_path:
            error = {"code": "E001", **self.error_codes_db["E001"], "path": zip_path}
            results["errors"].append(error)
            results["success"] = False
            results["risk_type"].append("压缩包路径异常")
        
        elif not Path(zip_path).exists():
            error = {"code": "E002", **self.error_codes_db["E002"], "path": zip_path}
            results["errors"].append(error)
            results["success"] = False
            results["risk_type"].append("压缩包路径异常")
        
        else:
            path_obj = Path(zip_path)
            if path_obj.suffix.lower() not in ['.zip', '.rar', '.7z']:
                error = {"code": "E003", **self.error_codes_db["E003"], "path": zip_path}
                results["errors"].append(error)
                results["success"] = False
                results["risk_type"].append("压缩包格式异常")
            
            if path_obj.stat().st_size == 0:
                error = {"code": "E004", **self.error_codes_db["E004"], "path": zip_path}
                results["errors"].append(error)
                results["success"] = False
                results["risk_type"].append("压缩包损坏")
        
        self.history.append(results)
        self._save_history()
        return results
    
    def generate_candidate_list(self, days=7, risk_level=None):
        candidates = []
        cutoff = datetime.now().timestamp() - (days * 86400)
        
        for record in self.history:
            record_time = datetime.fromisoformat(record["timestamp"]).timestamp()
            if record_time < cutoff:
                continue
            
            if risk_level:
                has_risk = any(e.get("risk_level") == risk_level for e in record["errors"])
                if not has_risk:
                    continue
            
            if record["errors"]:
                candidates.append({
                    "batch_id": record["batch_id"],
                    "timestamp": record["timestamp"],
                    "operator": record["operator"],
                    "error_count": len(record["errors"]),
                    "risk_types": list(set(record["risk_type"])),
                    "zip_path": record.get("zip_path", "N/A")
                })
        
        return candidates
    
    def query_history(self, batch_id=None, operator=None, risk_type=None, risk_level=None):
        results = self.history
        
        if batch_id:
            results = [r for r in results if r["batch_id"] == batch_id]
        
        if operator:
            results = [r for r in results if r["operator"] == operator]
        
        if risk_type:
            results = [r for r in results if risk_type in r["risk_type"]]
        
        if risk_level:
            if risk_level == "normal":
                results = [r for r in results if not r["errors"]]
            else:
                results = [r for r in results if any(e.get("risk_level") == risk_level for e in r["errors"])]
        
        return results
    
    def get_uncovered_error_codes(self):
        uncovered = {}
        for code, info in self.error_codes_db.items():
            if not info["covered"]:
                module = info["module"]
                if module not in uncovered:
                    uncovered[module] = []
                uncovered[module].append({"code": code, **info})
        return uncovered
    
    def export_results(self, batch_id=None, output_format="excel", risk_level=None, export_all=False):
        records = []
        
        if batch_id:
            for r in self.history:
                if r["batch_id"] == batch_id:
                    records.append(r)
                    break
        elif risk_level:
            records = self.query_history(risk_level=risk_level)
        else:
            records = self.history
        
        if not records:
            return None
        
        corrections = []
        for record in records:
            corrections.append({
                "批次ID": record["batch_id"],
                "字段": "压缩包路径",
                "修正前": record.get("zip_path", ""),
                "修正后": "/valid/path/to/file.zip" if record["success"] else "",
                "风险等级": self._get_record_risk_level(record),
                "错误码": ",".join([e["code"] for e in record["errors"]]) if record["errors"] else "",
                "操作者": record["operator"],
                "检查时间": record["timestamp"]
            })
        
        if batch_id:
            filename = f"check_result_{batch_id}"
        elif risk_level:
            filename = f"check_result_risk_{risk_level}"
        else:
            filename = f"check_result_all"
        
        filepath = self.export_dir / filename
        
        if output_format == "excel":
            filepath = filepath.with_suffix(".xlsx")
            df = pd.DataFrame(corrections)
            df.to_excel(filepath, index=False, engine="openpyxl")
        else:
            filepath = filepath.with_suffix(".csv")
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=corrections[0].keys())
                writer.writeheader()
                writer.writerows(corrections)
        
        return str(filepath)
    
    def _get_record_risk_level(self, record):
        if not record["errors"]:
            return "normal"
        levels = [e.get("risk_level") for e in record["errors"]]
        if "high" in levels:
            return "high"
        elif "medium" in levels:
            return "medium"
        else:
            return "low"

checker = ErrorCodeChecker()

@click.group()
def cli():
    """异常码覆盖检查工具"""
    pass

@cli.command()
@click.argument('zip_path')
@click.option('--operator', '-o', default='system', help='操作者名称')
def check(zip_path, operator):
    """检查压缩包路径异常"""
    click.echo(f"正在检查压缩包路径: {zip_path}")
    result = checker.check_zip_path(zip_path, operator)
    
    click.echo(f"\n批次ID: {result['batch_id']}")
    click.echo(f"检查时间: {result['timestamp']}")
    click.echo(f"操作者: {result['operator']}")
    click.echo(f"检查结果: {'成功' if result['success'] else '失败'}")
    
    if result['errors']:
        click.echo("\n发现的错误:")
        for error in result['errors']:
            click.echo(f"  [{error['code']}] {error['message']} - 风险等级: {error['risk_level']}")
        sys.exit(1)
    else:
        click.echo("\n检查通过，无异常")
        sys.exit(0)

@cli.command()
@click.option('--days', '-d', default=7, help='查询最近N天的记录')
@click.option('--risk-level', '-r', type=click.Choice(['high', 'medium', 'low']), help='按风险等级过滤')
def candidates(days, risk_level):
    """生成候选清理清单"""
    click.echo(f"正在生成最近{days}天的候选清理清单...")
    candidate_list = checker.generate_candidate_list(days, risk_level)
    
    if not candidate_list:
        click.echo("未找到符合条件的候选记录")
        return
    
    table_data = []
    for c in candidate_list:
        table_data.append([
            c["batch_id"],
            c["timestamp"][:19],
            c["operator"],
            c["error_count"],
            ",".join(c["risk_types"]),
            c["zip_path"][:50] + "..." if len(c["zip_path"]) > 50 else c["zip_path"]
        ])
    
    headers = ["批次ID", "时间", "操作者", "错误数", "风险类型", "压缩包路径"]
    click.echo("\n" + tabulate(table_data, headers=headers, tablefmt="simple"))
    click.echo(f"\n共找到 {len(candidate_list)} 条候选记录")

@cli.command()
@click.option('--batch-id', '-b', help='按批次ID查询')
@click.option('--operator', '-o', help='按操作者查询')
@click.option('--risk-type', '-t', help='按风险类型查询')
@click.option('--risk-level', '-r', type=click.Choice(['high', 'medium', 'low', 'normal']), help='按风险等级回查（high/medium/low/normal）')
def query(batch_id, operator, risk_type, risk_level):
    """历史查询，支持多维度过滤"""
    results = checker.query_history(batch_id, operator, risk_type, risk_level)
    
    if not results:
        click.echo("未找到匹配的记录")
        return
    
    for record in results:
        click.echo(f"\n{'='*60}")
        click.echo(f"批次ID: {record['batch_id']}")
        click.echo(f"时间: {record['timestamp']}")
        click.echo(f"操作者: {record['operator']}")
        click.echo(f"结果: {'成功' if record['success'] else '失败'}")
        click.echo(f"风险类型: {', '.join(record['risk_type']) if record['risk_type'] else '无'}")
        
        if record['errors']:
            click.echo("\n错误详情:")
            for error in record['errors']:
                click.echo(f"  [{error['code']}] {error['message']} (风险: {error['risk_level']})")
        else:
            click.echo("\n成功路径: 无异常")
    
    click.echo(f"\n共查询到 {len(results)} 条记录")

@cli.command()
def uncovered():
    """查看未覆盖的错误码，按模块分组"""
    uncovered = checker.get_uncovered_error_codes()
    
    if not uncovered:
        click.echo("所有错误码均已覆盖")
        return
    
    for module, codes in uncovered.items():
        click.echo(f"\n【{module}】")
        for code_info in codes:
            click.echo(f"  {code_info['code']}: {code_info['message']} (风险等级: {code_info['risk_level']})")
    
    total = sum(len(codes) for codes in uncovered.values())
    click.echo(f"\n总计未覆盖错误码: {total} 个")

@cli.command()
@click.argument('batch_id', required=False)
@click.option('--format', '-f', 'output_format', type=click.Choice(['excel', 'csv']), default='excel', help='导出格式')
@click.option('--risk-level', '-r', type=click.Choice(['high', 'medium', 'low', 'normal']), help='按风险等级筛选导出')
@click.option('--all', '-a', 'export_all', is_flag=True, help='导出所有记录')
def export(batch_id, output_format, risk_level, export_all):
    """导出检查结果（支持按批次、风险等级或导出全部）"""
    if not batch_id and not risk_level and not export_all:
        click.echo("错误: 请指定 --batch-id、--risk-level 或 --all 中的一个")
        click.echo("示例:")
        click.echo("  export BATCH20260515120000          # 按批次导出")
        click.echo("  export --risk-level high            # 按风险等级导出")
        click.echo("  export --all                        # 导出所有记录")
        sys.exit(1)
    
    if sum([1 for x in [batch_id, risk_level, export_all] if x]) > 1:
        click.echo("错误: --batch-id、--risk-level、--all 不能同时使用")
        sys.exit(1)
    
    filepath = checker.export_results(batch_id, output_format, risk_level, export_all)
    
    if filepath:
        click.echo(f"导出成功: {filepath}")
    else:
        if batch_id:
            click.echo(f"未找到批次 {batch_id} 的记录")
        elif risk_level:
            click.echo(f"未找到风险等级为 {risk_level} 的记录")
        else:
            click.echo("未找到任何记录")
        sys.exit(1)

if __name__ == "__main__":
    cli()
