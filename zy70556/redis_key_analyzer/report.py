import json
import csv
from typing import List
from dataclasses import asdict
from datetime import datetime
import logging

from .analyzer import AnalysisResult, PrefixAnalysis

logger = logging.getLogger(__name__)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redis键空间分析报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #f5f7fa;
            color: #333;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
        }
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .card h3 {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
        }
        .card .value {
            font-size: 28px;
            font-weight: bold;
            color: #333;
        }
        .card .unit {
            font-size: 14px;
            color: #999;
            margin-left: 5px;
        }
        .section {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .section h2 {
            font-size: 20px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #555;
        }
        tr:hover {
            background-color: #f8f9fa;
        }
        .highlight {
            color: #e74c3c;
            font-weight: bold;
        }
        .owner-tag {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        .owner-unassigned {
            background: #eee;
            color: #666;
        }
        .owner-assigned {
            background: #d4edda;
            color: #155724;
        }
        .progress-bar {
            height: 8px;
            background: #eee;
            border-radius: 4px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 4px;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #999;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Redis键空间分析报告</h1>
            <p>生成时间: {{timestamp}}</p>
        </div>
        
        <div class="summary-cards">
            <div class="card">
                <h3>总键数量</h3>
                <div class="value">{{total_keys}}<span class="unit">个</span></div>
            </div>
            <div class="card">
                <h3>总内存使用</h3>
                <div class="value">{{total_memory_mb}}<span class="unit">MB</span></div>
            </div>
            <div class="card">
                <h3>永久键数量</h3>
                <div class="value">{{permanent_keys}}<span class="unit">个</span></div>
            </div>
            <div class="card">
                <h3>前缀分组数</h3>
                <div class="value">{{prefix_count}}<span class="unit">组</span></div>
            </div>
        </div>
        
        <div class="section">
            <h2>📊 前缀分析详情 (Top {{top_count}})</h2>
            <table>
                <thead>
                    <tr>
                        <th>排名</th>
                        <th>前缀</th>
                        <th>Owner</th>
                        <th>键数量</th>
                        <th>永久键</th>
                        <th>内存使用</th>
                        <th>内存占比</th>
                    </tr>
                </thead>
                <tbody>
                    {{rows}}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>📈 TTL分布统计</h2>
            <table>
                <thead>
                    <tr>
                        <th>TTL分类</th>
                        <th>键数量</th>
                        <th>占比</th>
                    </tr>
                </thead>
                <tbody>
                    {{ttl_rows}}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>🔑 键类型分布</h2>
            <table>
                <thead>
                    <tr>
                        <th>类型</th>
                        <th>键数量</th>
                        <th>占比</th>
                    </tr>
                </thead>
                <tbody>
                    {{type_rows}}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>Redis键空间分析工具 - 由 Engineering Team 提供</p>
        </div>
    </div>
</body>
</html>
"""


class ReportGenerator:
    def __init__(self, output_dir: str = "."):
        self.output_dir = output_dir

    def _format_bytes(self, bytes_val: int) -> str:
        if bytes_val < 1024:
            return f"{bytes_val} B"
        elif bytes_val < 1024 * 1024:
            return f"{bytes_val / 1024:.2f} KB"
        elif bytes_val < 1024 * 1024 * 1024:
            return f"{bytes_val / (1024 * 1024):.2f} MB"
        else:
            return f"{bytes_val / (1024 * 1024 * 1024):.2f} GB"

    def generate_all(self, result: AnalysisResult, base_filename: str = "redis_analysis"):
        logger.info("Generating all reports...")
        
        self._generate_terminal_summary(result)
        self._export_json(result, f"{base_filename}.json")
        self._export_csv(result, f"{base_filename}.csv")
        self._export_html(result, f"{base_filename}.html")
        
        logger.info(f"All reports generated with base filename: {base_filename}")

    def _generate_terminal_summary(self, result: AnalysisResult):
        print("\n" + "="*60)
        print("📊 Redis键空间分析报告摘要")
        print("="*60)
        print(f"扫描时间: {result.scan_timestamp}")
        print(f"总键数量: {result.total_keys:,}")
        print(f"总内存使用: {self._format_bytes(result.total_memory_bytes)}")
        
        if result.total_keys > 0:
            permanent_pct = result.permanent_keys / result.total_keys * 100
            print(f"永久键数量: {result.permanent_keys:,} ({permanent_pct:.1f}%)")
        else:
            print(f"永久键数量: {result.permanent_keys:,}")
        
        print(f"永久键内存: {self._format_bytes(result.permanent_memory_bytes)}")
        print(f"前缀分组数: {len(result.prefix_analysis)}")
        
        if result.total_keys == 0:
            print("\n" + "⚠️ 未扫描到任何键，无法生成前缀分析")
            print("="*60 + "\n")
            return
        
        print("\n" + "-"*60)
        print("Top 10 内存占用前缀:")
        print("-"*60)
        
        for i, pa in enumerate(result.prefix_analysis[:10], 1):
            memory_pct = pa.total_memory_bytes / result.total_memory_bytes * 100 if result.total_memory_bytes > 0 else 0
            print(f"{i:2d}. {pa.prefix[:40]:<40} | {pa.total_keys:>6,} keys | {self._format_bytes(pa.total_memory_bytes):>10} | {memory_pct:>5.1f}% | Owner: {pa.owner}")
        
        print("="*60 + "\n")

    def _export_json(self, result: AnalysisResult, filename: str):
        output = {
            "summary": {
                "total_keys": result.total_keys,
                "total_memory_bytes": result.total_memory_bytes,
                "permanent_keys": result.permanent_keys,
                "permanent_memory_bytes": result.permanent_memory_bytes,
                "scan_timestamp": result.scan_timestamp,
                "overall_ttl_distribution": result.overall_ttl_distribution,
                "overall_key_type_distribution": result.overall_key_type_distribution
            },
            "prefix_analysis": [asdict(pa) for pa in result.prefix_analysis],
            "bad_records": [asdict(br) for br in result.bad_records]
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        logger.info(f"JSON report exported to {filename}")

    def _export_csv(self, result: AnalysisResult, filename: str):
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            
            writer.writerow(["Summary"])
            writer.writerow(["total_keys", result.total_keys])
            writer.writerow(["total_memory_bytes", result.total_memory_bytes])
            writer.writerow(["permanent_keys", result.permanent_keys])
            writer.writerow(["permanent_memory_bytes", result.permanent_memory_bytes])
            writer.writerow(["scan_timestamp", result.scan_timestamp])
            writer.writerow([])
            
            writer.writerow(["Prefix Analysis"])
            writer.writerow([
                "prefix", "owner", "total_keys", "permanent_keys",
                "total_memory_bytes", "permanent_memory_bytes",
                "avg_ttl_seconds", "ttl_distribution", "key_type_distribution"
            ])
            
            for pa in result.prefix_analysis:
                writer.writerow([
                    pa.prefix,
                    pa.owner,
                    pa.total_keys,
                    pa.permanent_keys,
                    pa.total_memory_bytes,
                    pa.permanent_memory_bytes,
                    f"{pa.avg_ttl_seconds:.2f}",
                    json.dumps(pa.ttl_distribution, ensure_ascii=False),
                    json.dumps(pa.key_type_distribution, ensure_ascii=False)
                ])
        
        logger.info(f"CSV report exported to {filename}")

    def _export_html(self, result: AnalysisResult, filename: str):
        timestamp = result.scan_timestamp
        total_keys = result.total_keys
        total_memory_mb = f"{result.total_memory_bytes / (1024 * 1024):.2f}"
        permanent_keys = result.permanent_keys
        prefix_count = len(result.prefix_analysis)
        
        top_count = min(20, len(result.prefix_analysis))
        rows = ""
        for i, pa in enumerate(result.prefix_analysis[:top_count], 1):
            memory_pct = pa.total_memory_bytes / result.total_memory_bytes * 100 if result.total_memory_bytes > 0 else 0
            owner_class = "owner-assigned" if pa.owner != "unassigned" else "owner-unassigned"
            permanent_pct = pa.permanent_keys / pa.total_keys * 100 if pa.total_keys > 0 else 0
            
            rows += f"""
            <tr>
                <td>{i}</td>
                <td><code>{pa.prefix}</code></td>
                <td><span class="owner-tag {owner_class}">{pa.owner}</span></td>
                <td>{pa.total_keys:,}</td>
                <td class="{'highlight' if permanent_pct > 50 else ''}">{pa.permanent_keys:,} ({permanent_pct:.1f}%)</td>
                <td>{self._format_bytes(pa.total_memory_bytes)}</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {min(memory_pct, 100)}%"></div>
                    </div>
                    {memory_pct:.1f}%
                </td>
            </tr>
            """
        
        ttl_rows = ""
        for ttl_category, count in sorted(result.overall_ttl_distribution.items(), key=lambda x: -x[1]):
            pct = count / result.total_keys * 100 if result.total_keys > 0 else 0
            ttl_rows += f"<tr><td>{ttl_category}</td><td>{count:,}</td><td>{pct:.1f}%</td></tr>"
        
        type_rows = ""
        for key_type, count in sorted(result.overall_key_type_distribution.items(), key=lambda x: -x[1]):
            pct = count / result.total_keys * 100 if result.total_keys > 0 else 0
            type_rows += f"<tr><td>{key_type}</td><td>{count:,}</td><td>{pct:.1f}%</td></tr>"
        
        html_content = HTML_TEMPLATE
        html_content = html_content.replace("{{timestamp}}", timestamp)
        html_content = html_content.replace("{{total_keys}}", f"{total_keys:,}")
        html_content = html_content.replace("{{total_memory_mb}}", total_memory_mb)
        html_content = html_content.replace("{{permanent_keys}}", f"{permanent_keys:,}")
        html_content = html_content.replace("{{prefix_count}}", str(prefix_count))
        html_content = html_content.replace("{{top_count}}", str(top_count))
        html_content = html_content.replace("{{rows}}", rows)
        html_content = html_content.replace("{{ttl_rows}}", ttl_rows)
        html_content = html_content.replace("{{type_rows}}", type_rows)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        logger.info(f"HTML report exported to {filename}")
