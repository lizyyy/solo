#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from jinja2 import Template


REQUIRED_COLUMNS = {
    "巡检日期": "date",
    "设备编号": "device_id",
    "检查项": "check_item",
    "班组": "team",
    "缺项类型": "missing_type",
    "是否完成": "is_completed",
}


MISSING_TYPE_CATEGORIES = {
    "安全": "安全项",
    "安全项": "安全项",
    "安全检查": "安全项",
    "保养": "保养项",
    "保养项": "保养项",
    "日常保养": "保养项",
    "维护": "保养项",
    "其他": "其他",
}


RECTIFICATION_LEVELS = {
    "critical": {"name": "紧急", "threshold": 5, "color": "#dc2626"},
    "high": {"name": "高", "threshold": 3, "color": "#ea580c"},
    "medium": {"name": "中", "threshold": 1, "color": "#ca8a04"},
    "low": {"name": "低", "threshold": 0, "color": "#16a34a"},
}


HTML_REPORT_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>设备巡检缺项报告 - {{ report_date }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 32px; }
        .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 16px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 24px 32px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .stat-value { font-size: 32px; font-weight: 700; color: #1e40af; }
        .stat-label { font-size: 14px; color: #64748b; margin-top: 4px; }
        .section { padding: 24px 32px; border-bottom: 1px solid #e2e8f0; }
        .section-title { font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .section-title::before { content: ''; width: 4px; height: 20px; background: #3b82f6; border-radius: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #f1f5f9; text-align: left; padding: 12px 16px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
        td { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
        tr:hover { background: #f8fafc; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 500; }
        .badge-safety { background: #fef2f2; color: #dc2626; }
        .badge-maintenance { background: #eff6ff; color: #1d4ed8; }
        .badge-other { background: #f3f4f6; color: #4b5563; }
        .level-critical { background: #fef2f2; color: #dc2626; }
        .level-high { background: #fff7ed; color: #ea580c; }
        .level-medium { background: #fefce8; color: #ca8a04; }
        .level-low { background: #f0fdf4; color: #16a34a; }
        .error-section { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 32px; border-radius: 0 8px 8px 0; }
        .error-title { font-weight: 600; color: #dc2626; margin-bottom: 8px; }
        .error-row { font-family: monospace; font-size: 13px; background: white; padding: 8px 12px; margin: 4px 0; border-radius: 4px; border: 1px solid #fecaca; }
        .chart-container { display: flex; gap: 32px; flex-wrap: wrap; justify-content: center; }
        .chart { flex: 1; min-width: 300px; }
        .bar-chart { display: flex; align-items: flex-end; gap: 16px; height: 200px; padding: 20px 0; }
        .bar { flex: 1; display: flex; flex-direction: column; align-items: center; }
        .bar-fill { width: 60px; border-radius: 8px 8px 0 0; margin-bottom: 8px; transition: height 0.3s; }
        .bar-label { font-size: 12px; color: #64748b; text-align: center; }
        .bar-value { font-weight: 600; color: #1e293b; }
        .footer { padding: 24px 32px; text-align: center; color: #64748b; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 设备巡检缺项报告</h1>
            <p>生成时间: {{ report_date }} | 输入文件: {{ input_file }}</p>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-value">{{ summary.total_records }}</div>
                <div class="stat-label">总记录数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{{ summary.valid_records }}</div>
                <div class="stat-label">有效记录</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{{ summary.missing_count }}</div>
                <div class="stat-label">缺项总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{{ summary.completion_rate }}%</div>
                <div class="stat-label">完成率</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{{ summary.error_count }}</div>
                <div class="stat-label">异常行数</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">缺项分类统计</h2>
            <div class="chart-container">
                <div class="chart">
                    <div class="bar-chart">
                        {% for category, count in by_category.items() %}
                        <div class="bar">
                            <div class="bar-fill" style="height: {{ (count / max_category_count * 150) if max_category_count > 0 else 0 }}px; background: {% if category == '安全项' %}#dc2626{% elif category == '保养项' %}#1d4ed8{% else %}#4b5563{% endif %};"></div>
                            <div class="bar-value">{{ count }}</div>
                            <div class="bar-label">{{ category }}</div>
                        </div>
                        {% endfor %}
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">班组缺项汇总</h2>
            <table>
                <thead>
                    <tr>
                        <th>班组</th>
                        <th>总检查项</th>
                        <th>缺项数</th>
                        <th>完成率</th>
                        <th>安全缺项</th>
                        <th>保养缺项</th>
                        <th>整改级别</th>
                    </tr>
                </thead>
                <tbody>
                    {% for team, data in by_team.items() %}
                    <tr>
                        <td><strong>{{ team }}</strong></td>
                        <td>{{ data.total }}</td>
                        <td>{{ data.missing }}</td>
                        <td>{{ "%.1f%%"|format(data.rate) }}</td>
                        <td><span class="badge badge-safety">{{ data.safety_missing }}</span></td>
                        <td><span class="badge badge-maintenance">{{ data.maintenance_missing }}</span></td>
                        <td><span class="badge level-{{ data.level }}">{{ data.level_name }}</span></td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">缺项明细</h2>
            <table>
                <thead>
                    <tr>
                        <th>行号</th>
                        <th>巡检日期</th>
                        <th>设备编号</th>
                        <th>检查项</th>
                        <th>班组</th>
                        <th>缺项类型</th>
                        <th>分类</th>
                    </tr>
                </thead>
                <tbody>
                    {% for item in missing_details %}
                    <tr>
                        <td>#{{ item.row_number }}</td>
                        <td>{{ item.date }}</td>
                        <td>{{ item.device_id }}</td>
                        <td>{{ item.check_item }}</td>
                        <td>{{ item.team }}</td>
                        <td>{{ item.missing_type }}</td>
                        <td>
                            <span class="badge {% if item.category == '安全项' %}badge-safety{% elif item.category == '保养项' %}badge-maintenance{% else %}badge-other{% endif %}">
                                {{ item.category }}
                            </span>
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        {% if errors %}
        <div class="error-section">
            <div class="error-title">⚠️ 异常行记录 (保留原始位置)</div>
            {% for error in errors %}
            <div class="error-row">
                行{{ error.row_number }}: {{ error.reason }} | 原始数据: {{ error.raw_data }}
            </div>
            {% endfor %}
        </div>
        {% endif %}

        <div class="footer">
            <p>本报告由设备巡检缺项CLI自动生成</p>
        </div>
    </div>
</body>
</html>
"""


class InspectionAnalyzer:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.data: List[Dict[str, Any]] = []
        self.errors: List[Dict[str, Any]] = []
        self.valid_data: List[Dict[str, Any]] = []
        self.missing_items: List[Dict[str, Any]] = []
        
    def read_file(self, file_path: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        path = Path(file_path)
        if not path.exists():
            print(f"错误: 文件不存在 - {file_path}", file=sys.stderr)
            sys.exit(1)
            
        suffix = path.suffix.lower()
        
        try:
            if suffix == '.csv':
                return self._read_csv(file_path)
            elif suffix in ['.xlsx', '.xls']:
                return self._read_excel(file_path)
            else:
                print(f"错误: 不支持的文件格式 - {suffix}", file=sys.stderr)
                print("支持的格式: .csv, .xlsx, .xls", file=sys.stderr)
                sys.exit(1)
        except Exception as e:
            print(f"错误: 读取文件失败 - {str(e)}", file=sys.stderr)
            sys.exit(1)
    
    def _read_csv(self, file_path: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        rows = []
        errors = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
            except StopIteration:
                print("错误: CSV文件为空", file=sys.stderr)
                sys.exit(1)
                
            header_map = self._map_header(header)
            
            for row_num, row in enumerate(reader, start=2):
                if not any(cell.strip() for cell in row):
                    continue
                    
                row_data = {}
                for chi_name, eng_name in REQUIRED_COLUMNS.items():
                    if chi_name in header_map:
                        idx = header_map[chi_name]
                        if idx < len(row):
                            row_data[eng_name] = row[idx].strip()
                        else:
                            row_data[eng_name] = ""
                    else:
                        row_data[eng_name] = ""
                
                rows.append({
                    "row_number": row_num,
                    "data": row_data,
                    "raw": row
                })
        
        return rows, errors
    
    def _read_excel(self, file_path: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        rows = []
        errors = []
        
        df = pd.read_excel(file_path, dtype=str)
        header = list(df.columns)
        header_map = self._map_header(header)
        
        for row_num, (_, row) in enumerate(df.iterrows(), start=2):
            row_data = {}
            for chi_name, eng_name in REQUIRED_COLUMNS.items():
                if chi_name in header_map:
                    val = row.iloc[header_map[chi_name]]
                    row_data[eng_name] = str(val).strip() if pd.notna(val) else ""
                else:
                    row_data[eng_name] = ""
            
            raw_data = [str(v) if pd.notna(v) else "" for v in row.tolist()]
            rows.append({
                "row_number": row_num,
                "data": row_data,
                "raw": raw_data
            })
        
        return rows, errors
    
    def _map_header(self, header: List[str]) -> Dict[str, int]:
        header_map = {}
        for idx, col in enumerate(header):
            col_clean = col.strip()
            for required in REQUIRED_COLUMNS.keys():
                if required in col_clean or col_clean in required:
                    if required not in header_map:
                        header_map[required] = idx
        return header_map
    
    def validate_and_process(self, rows: List[Dict[str, Any]]) -> None:
        self.valid_data = []
        self.errors = []
        self.missing_items = []
        
        for row in rows:
            row_num = row["row_number"]
            data = row["data"]
            raw = row["raw"]
            
            validation_errors = self._validate_row(data, row_num)
            
            if validation_errors:
                self.errors.append({
                    "row_number": row_num,
                    "reason": "; ".join(validation_errors),
                    "raw_data": " | ".join(raw)
                })
                continue
            
            processed = self._process_row(data)
            processed["row_number"] = row_num
            self.valid_data.append(processed)
            
            if not processed["is_completed_flag"]:
                self.missing_items.append(processed)
    
    def _validate_row(self, data: Dict[str, str], row_num: int) -> List[str]:
        errors = []
        
        if not data["device_id"]:
            errors.append("设备编号为空")
        
        if not data["check_item"]:
            errors.append("检查项为空")
        
        if not data["team"]:
            errors.append("班组为空")
        
        if not data["is_completed"]:
            errors.append("是否完成为空")
        else:
            completed_val = data["is_completed"].lower()
            if completed_val not in ["是", "否", "yes", "no", "true", "false", "1", "0"]:
                errors.append(f"是否完成值无效: {data['is_completed']}")
        
        return errors
    
    def _process_row(self, data: Dict[str, str]) -> Dict[str, Any]:
        completed_val = data["is_completed"].lower()
        is_completed = completed_val in ["是", "yes", "true", "1"]
        
        missing_type_raw = data["missing_type"] or "其他"
        category = "其他"
        for key, val in MISSING_TYPE_CATEGORIES.items():
            if key in missing_type_raw or missing_type_raw in key:
                category = val
                break
        
        return {
            "date": data["date"] or "",
            "device_id": data["device_id"],
            "check_item": data["check_item"],
            "team": data["team"],
            "missing_type": missing_type_raw,
            "category": category,
            "is_completed_flag": is_completed,
            "is_completed_raw": data["is_completed"]
        }
    
    def analyze(self) -> Dict[str, Any]:
        total_records = len(self.valid_data) + len(self.errors)
        valid_records = len(self.valid_data)
        missing_count = len(self.missing_items)
        
        completion_rate = 0.0
        if valid_records > 0:
            completion_count = sum(1 for d in self.valid_data if d["is_completed_flag"])
            completion_rate = (completion_count / valid_records * 100)
        
        by_category = {"安全项": 0, "保养项": 0, "其他": 0}
        for item in self.missing_items:
            by_category[item["category"]] = by_category.get(item["category"], 0) + 1
        
        by_team = {}
        for item in self.valid_data:
            team = item["team"]
            if team not in by_team:
                by_team[team] = {
                    "total": 0,
                    "completed": 0,
                    "missing": 0,
                    "safety_missing": 0,
                    "maintenance_missing": 0
                }
            
            by_team[team]["total"] += 1
            if item["is_completed_flag"]:
                by_team[team]["completed"] += 1
            else:
                by_team[team]["missing"] += 1
                if item["category"] == "安全项":
                    by_team[team]["safety_missing"] += 1
                elif item["category"] == "保养项":
                    by_team[team]["maintenance_missing"] += 1
        
        for team in by_team:
            data = by_team[team]
            data["rate"] = (data["completed"] / data["total"] * 100) if data["total"] > 0 else 0
            
            safety_missing = data["safety_missing"]
            if safety_missing >= RECTIFICATION_LEVELS["critical"]["threshold"]:
                data["level"] = "critical"
                data["level_name"] = "紧急"
            elif safety_missing >= RECTIFICATION_LEVELS["high"]["threshold"]:
                data["level"] = "high"
                data["level_name"] = "高"
            elif safety_missing >= RECTIFICATION_LEVELS["medium"]["threshold"]:
                data["level"] = "medium"
                data["level_name"] = "中"
            else:
                data["level"] = "low"
                data["level_name"] = "低"
        
        return {
            "summary": {
                "total_records": total_records,
                "valid_records": valid_records,
                "missing_count": missing_count,
                "completion_rate": round(completion_rate, 1),
                "error_count": len(self.errors)
            },
            "by_category": by_category,
            "by_team": by_team,
            "missing_details": self.missing_items,
            "errors": self.errors
        }
    
    def print_summary(self, result: Dict[str, Any]) -> None:
        print("\n" + "=" * 60)
        print("📋 设备巡检缺项分析 - 终端摘要")
        print("=" * 60 + "\n")
        
        summary = result["summary"]
        print(f"  总记录数:     {summary['total_records']}")
        print(f"  有效记录:     {summary['valid_records']}")
        print(f"  缺项总数:     {summary['missing_count']}")
        print(f"  完成率:       {summary['completion_rate']}%")
        print(f"  异常行数:     {summary['error_count']}")
        print()
        
        print("  缺项分类:")
        for category, count in result["by_category"].items():
            print(f"    - {category}: {count} 项")
        print()
        
        print("  班组汇总:")
        for team, data in sorted(result["by_team"].items()):
            print(f"    [{team}] 完成率: {data['rate']:.1f}% | 缺项: {data['missing']} (安全: {data['safety_missing']}, 保养: {data['maintenance_missing']}) | 整改级别: {data['level_name']}")
        print()
        
        if result["errors"]:
            print("  ⚠️  异常行记录 (保留原始位置):")
            for error in result["errors"]:
                print(f"    - 行{error['row_number']}: {error['reason']}")
        print()
        
        print("=" * 60 + "\n")
    
    def export_json(self, result: Dict[str, Any], input_file: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"inspection_result_{timestamp}.json"
        filepath = self.output_dir / filename
        
        output_data = {
            "report_info": {
                "generated_at": datetime.now().isoformat(),
                "input_file": input_file,
                "version": "1.0.0"
            },
            **result
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        return str(filepath)
    
    def export_html(self, result: Dict[str, Any], input_file: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"inspection_report_{timestamp}.html"
        filepath = self.output_dir / filename
        
        template = Template(HTML_REPORT_TEMPLATE)
        
        max_category_count = max(result["by_category"].values()) if result["by_category"] else 0
        
        html_content = template.render(
            report_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            input_file=input_file,
            summary=result["summary"],
            by_category=result["by_category"],
            by_team=result["by_team"],
            missing_details=result["missing_details"],
            errors=result["errors"],
            max_category_count=max_category_count
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return str(filepath)


def main():
    parser = argparse.ArgumentParser(
        description="设备巡检缺项分析CLI - 分析巡检表缺项情况，生成终端摘要、JSON结果和HTML报告",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python main.py 巡检表.csv
  python main.py 巡检表.xlsx -o ./reports
  python main.py data/inspection.csv --output ./output
        """
    )
    
    parser.add_argument(
        "input_file",
        help="输入的巡检表文件 (支持 .csv, .xlsx, .xls)"
    )
    
    parser.add_argument(
        "-o", "--output",
        default="output",
        help="输出目录 (默认: ./output)"
    )
    
    parser.add_argument(
        "--no-json",
        action="store_true",
        help="不生成JSON结果文件"
    )
    
    parser.add_argument(
        "--no-html",
        action="store_true",
        help="不生成HTML报告文件"
    )
    
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="静默模式，不打印终端摘要"
    )
    
    args = parser.parse_args()
    
    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"错误: 输入文件不存在 - {args.input_file}", file=sys.stderr)
        sys.exit(1)
    
    analyzer = InspectionAnalyzer(output_dir=args.output)
    
    rows, _ = analyzer.read_file(args.input_file)
    analyzer.validate_and_process(rows)
    result = analyzer.analyze()
    
    if not args.quiet:
        analyzer.print_summary(result)
    
    json_path = None
    if not args.no_json:
        json_path = analyzer.export_json(result, args.input_file)
        if not args.quiet:
            print(f"✅ JSON结果已保存: {json_path}")
    
    html_path = None
    if not args.no_html:
        html_path = analyzer.export_html(result, args.input_file)
        if not args.quiet:
            print(f"✅ HTML报告已保存: {html_path}")
    
    if not args.quiet:
        print(f"\n✅ 分析完成！输出目录: {analyzer.output_dir.resolve()}")
    
    exit_code = 0
    if result["errors"]:
        exit_code = 1
        if not args.quiet:
            print(f"\n⚠️  注意: 发现 {len(result['errors'])} 行异常数据")
    
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
