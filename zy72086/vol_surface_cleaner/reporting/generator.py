import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
import numpy as np

from core.models import CleanResult, VolatilityPoint, RecordStatus
from storage.versions import VersionManager


class ReportGenerator:
    def __init__(self, version_manager: VersionManager, output_dir: str = "reports"):
        self.version_manager = version_manager
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_html_report(self, result: CleanResult,
                             include_charts: bool = True) -> str:
        version_data = result.to_dict() if hasattr(result, 'to_dict') else {'result': str(result)}
        version_id = self.version_manager.save_version(
            result.surface.surface_id,
            version_data,
            comment="生成报告时自动保存版本"
        )

        report_data = self._prepare_report_data(result, version_id)
        os.makedirs(self.output_dir, exist_ok=True)
        report_path = os.path.join(self.output_dir, f"{result.surface.surface_id}_report.html")

        html_content = self._build_html_template(report_data, include_charts)

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        json_path = os.path.join(self.output_dir, f"{result.surface.surface_id}_data.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)

        return report_path

    def _prepare_report_data(self, result: CleanResult,
                             version_id: str) -> Dict[str, Any]:
        surface = result.surface
        points = surface.points

        by_tenor = {}
        for p in points:
            if p.tenor not in by_tenor:
                by_tenor[p.tenor] = []
            by_tenor[p.tenor].append(p)

        chart_data = self._prepare_chart_data(points)
        decision_paths = self._prepare_decision_paths(points, result)

        return {
            "version_id": version_id,
            "surface_id": surface.surface_id,
            "underlying": surface.underlying,
            "trade_date": surface.trade_date.isoformat(),
            "generated_at": datetime.now().isoformat(),
            "status": surface.status.value,
            "status_display": self._get_status_display(surface.status),
            "comments": surface.comments,
            "summary": {
                "original_points": result.original_points,
                "cleaned_points": result.cleaned_points,
                "outliers_removed": result.outliers_removed,
                "interpolated_points": result.interpolated_points,
                "conflicts": len(result.conflicts_found),
                "processing_time": round(result.processing_time, 3),
                "high_confidence": result.status_summary.get("high_confidence", 0),
                "medium_confidence": result.status_summary.get("medium_confidence", 0),
                "low_confidence": result.status_summary.get("low_confidence", 0),
                "needs_review": result.status_summary.get("needs_review", 0),
                "legacy_points": result.status_summary.get("legacy_points", 0)
            },
            "data_sources": [ds.to_dict() for ds in surface.data_sources],
            "parameters_used": [pv.to_dict() for pv in result.parameter_versions_used],
            "chart_data": chart_data,
            "points_detail": self._prepare_points_detail(points),
            "conflicts": [c.to_dict() for c in result.conflicts_found],
            "decision_paths": decision_paths,
            "audit_trail": [a.to_dict() for a in result.audit_trail[:50]],
            "by_tenor_summary": {
                tenor: (lambda valid_vols: {
                    "count": len(tenor_points),
                    "valid_count": len(valid_vols),
                    "avg_vol": round(np.mean(valid_vols), 4) if valid_vols else 0.0,
                    "min_vol": round(min(valid_vols), 4) if valid_vols else 0.0,
                    "max_vol": round(max(valid_vols), 4) if valid_vols else 0.0,
                })([p.implied_vol for p in tenor_points if not p.is_outlier])
                for tenor, tenor_points in by_tenor.items()
            }
        }

    def _prepare_chart_data(self, points: List[VolatilityPoint]) -> Dict[str, Any]:
        valid_points = [p for p in points if not p.is_outlier]

        tenors = sorted(list(set(p.tenor for p in valid_points)))
        strikes = sorted(list(set(p.strike for p in valid_points)))

        surface_data = []
        for p in valid_points:
            surface_data.append({
                "x": p.strike,
                "y": p.maturity,
                "z": p.implied_vol,
                "tenor": p.tenor,
                "point_id": p.point_id,
                "confidence": p.confidence,
                "is_interpolated": p.is_interpolated,
                "data_source": p.data_source_id,
                "review_comment": p.review_comment
            })

        smile_curves = {}
        for tenor in tenors:
            tenor_points = [p for p in valid_points if p.tenor == tenor]
            tenor_points.sort(key=lambda x: x.strike)
            smile_curves[tenor] = {
                "strikes": [p.strike for p in tenor_points],
                "vols": [p.implied_vol for p in tenor_points],
                "confidence": [p.confidence for p in tenor_points],
                "point_ids": [p.point_id for p in tenor_points]
            }

        term_structure = {}
        atm_strike = strikes[len(strikes) // 2] if strikes else 3.0
        for tenor in tenors:
            tenor_points = [p for p in valid_points if p.tenor == tenor]
            atm_point = min(tenor_points, key=lambda x: abs(x.strike - atm_strike)) if tenor_points else None
            if atm_point:
                term_structure[tenor] = {
                    "maturity": atm_point.maturity,
                    "atm_vol": atm_point.implied_vol,
                    "confidence": atm_point.confidence,
                    "point_id": atm_point.point_id
                }

        return {
            "surface": surface_data,
            "smile_curves": smile_curves,
            "term_structure": term_structure,
            "tenors": tenors,
            "strikes": strikes,
            "atm_strike": atm_strike
        }

    def _prepare_points_detail(self, points: List[VolatilityPoint]) -> List[Dict[str, Any]]:
        details = []
        for p in points:
            status = "正常"
            status_class = "success"
            if p.is_outlier:
                status = "异常值"
                status_class = "danger"
            elif p.is_interpolated:
                status = "插值补全"
                status_class = "warning"
            elif p.review_comment:
                status = "待复核"
                status_class = "warning"
            elif "legacy" in p.tags:
                status = "旧口径"
                status_class = "info"

            details.append({
                "point_id": p.point_id,
                "tenor": p.tenor,
                "strike": p.strike,
                "maturity": p.maturity,
                "option_type": p.option_type,
                "raw_value": p.raw_value,
                "implied_vol": p.implied_vol,
                "data_source": p.data_source_id,
                "confidence": p.confidence,
                "status": status,
                "status_class": status_class,
                "is_outlier": p.is_outlier,
                "is_interpolated": p.is_interpolated,
                "outlier_reason": p.outlier_reason,
                "review_comment": p.review_comment,
                "tags": p.tags
            })
        return sorted(details, key=lambda x: (x["tenor"], x["strike"]))

    def _prepare_decision_paths(self, points: List[VolatilityPoint],
                                 result: CleanResult) -> Dict[str, List[str]]:
        paths = {}
        point_logs = {}
        for log in result.audit_trail:
            if log.point_id and log.point_id not in point_logs:
                point_logs[log.point_id] = []
            if log.point_id:
                point_logs[log.point_id].append(log)

        for p in points:
            if p.point_id in point_logs or p.raw_value is not None:
                if p.raw_value is not None:
                    path = [f"1. 原始值导入: {p.raw_value:.4f} (来源: {p.data_source_id})"]
                else:
                    path = [f"1. 数据来源: {p.data_source_id} (无原始值记录)"]
                step = 2
                logs = sorted(point_logs.get(p.point_id, []), key=lambda x: x.timestamp)
                for log in logs:
                    if log.old_value is not None and log.new_value is not None:
                        path.append(f"{step}. {log.action}: {log.old_value:.4f} → {log.new_value:.4f} ({log.reason})")
                    elif log.old_value is not None:
                        path.append(f"{step}. {log.action}: 检查值 {log.old_value:.4f} - {log.reason}")
                    elif log.reason:
                        path.append(f"{step}. {log.action}: {log.reason}")
                    step += 1
                path.append(f"{step}. 最终值: {p.implied_vol:.4f} (置信度: {p.confidence:.3f})")
                paths[p.point_id] = path

        return paths

    def _get_status_display(self, status: RecordStatus) -> Dict[str, str]:
        display_map = {
            RecordStatus.SUCCESS: {"text": "清洗完成", "class": "success", "icon": "✓"},
            RecordStatus.PENDING_REVIEW: {"text": "待人工确认", "class": "warning", "icon": "⚠"},
            RecordStatus.LEGACY_CALIBRATION: {"text": "旧口径数据", "class": "info", "icon": "📜"},
            RecordStatus.CONFLICT: {"text": "存在冲突", "class": "danger", "icon": "✗"},
            RecordStatus.PROCESSED: {"text": "已处理", "class": "primary", "icon": "✓"}
        }
        return display_map.get(status, {"text": str(status), "class": "secondary", "icon": "?"})

    def _build_html_template(self, data: Dict[str, Any],
                             include_charts: bool) -> str:
        json_str = json.dumps(data, ensure_ascii=False)

        template = self._get_static_html_template()
        template = template.replace('__REPORT_DATA__', json_str)
        template = template.replace('__UNDERLYING__', str(data['underlying']))
        template = template.replace('__TRADE_DATE__', str(data['trade_date'][:10]))
        template = template.replace('__SURFACE_ID__', str(data['surface_id']))
        template = template.replace('__VERSION_ID__', str(data['version_id']))
        template = template.replace('__STATUS_CLASS__', str(data['status_display']['class']))
        template = template.replace('__STATUS_ICON__', str(data['status_display']['icon']))
        template = template.replace('__STATUS_TEXT__', str(data['status_display']['text']))
        template = template.replace('__COMMENTS__', str(data['comments']))
        template = template.replace('__GENERATED_AT__', str(data['generated_at']))
        template = template.replace('__ORIGINAL_POINTS__', str(data['summary']['original_points']))
        template = template.replace('__CLEANED_POINTS__', str(data['summary']['cleaned_points']))
        template = template.replace('__OUTLIERS_REMOVED__', str(data['summary']['outliers_removed']))
        template = template.replace('__INTERPOLATED_POINTS__', str(data['summary']['interpolated_points']))
        template = template.replace('__CONFLICTS__', str(data['summary']['conflicts']))
        template = template.replace('__PROCESSING_TIME__', str(data['summary']['processing_time']))
        template = template.replace('__HIGH_CONF__', str(data['summary']['high_confidence']))
        template = template.replace('__MEDIUM_CONF__', str(data['summary']['medium_confidence']))
        template = template.replace('__LOW_CONF__', str(data['summary']['low_confidence']))
        template = template.replace('__NEEDS_REVIEW__', str(data['summary']['needs_review']))
        template = template.replace('__LEGACY_POINTS__', str(data['summary']['legacy_points']))
        template = template.replace('__ATM_STRIKE__', str(data['chart_data']['atm_strike']))
        template = template.replace('__CONFLICTS_HTML__', self._render_conflicts(data['conflicts']))
        template = template.replace('__TENOR_SUMMARY_HTML__', self._render_tenor_summary(data['by_tenor_summary']))
        template = template.replace('__PARAMS_HTML__', self._render_parameters(data['parameters_used']))
        template = template.replace('__DATA_SOURCES_HTML__', self._render_data_sources(data['data_sources']))
        template = template.replace('__AUDIT_TRAIL_HTML__', self._render_audit_trail(data['audit_trail']))

        return template

    def _get_static_html_template(self) -> str:
        return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>期权波动率曲面清洗报告 - __UNDERLYING__ @ __TRADE_DATE__</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/echarts-gl@2.0.9/dist/echarts-gl.min.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header .meta { display: flex; gap: 20px; flex-wrap: wrap; opacity: 0.9; }
        .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; }
        .status-success { background: #52c41a; }
        .status-warning { background: #faad14; }
        .status-danger { background: #ff4d4f; }
        .status-info { background: #1890ff; }
        .status-primary { background: #722ed1; }
        .status-secondary { background: #8c8c8c; }

        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .stat-card .label { font-size: 13px; color: #8c8c8c; margin-bottom: 8px; }
        .stat-card .value { font-size: 28px; font-weight: 700; color: #262626; }
        .stat-card .trend { font-size: 12px; margin-top: 4px; }
        .trend-up { color: #52c41a; }
        .trend-down { color: #ff4d4f; }

        .section { background: white; padding: 24px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .section h2 { font-size: 20px; margin-bottom: 16px; color: #262626; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; }
        .section h3 { font-size: 16px; margin: 20px 0 12px; color: #595959; }

        .chart-container { height: 400px; width: 100%; margin: 20px 0; }
        .chart-container-3d { height: 500px; }

        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #f0f0f0; }
        th { background: #fafafa; font-weight: 600; color: #595959; font-size: 13px; }
        tr:hover { background: #fafafa; }
        .clickable { cursor: pointer; }
        .clickable:hover { background: #e6f7ff; }

        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
        .badge-success { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
        .badge-warning { background: #fffbe6; color: #faad14; border: 1px solid #ffe58f; }
        .badge-danger { background: #fff1f0; color: #ff4d4f; border: 1px solid #ffa39e; }
        .badge-info { background: #e6f7ff; color: #1890ff; border: 1px solid #91d5ff; }

        .conflict-card { background: #fff1f0; border-left: 4px solid #ff4d4f; padding: 16px; margin: 12px 0; border-radius: 4px; }
        .conflict-card h4 { color: #ff4d4f; margin-bottom: 8px; }
        .evidence-list { margin: 8px 0; padding-left: 20px; }
        .evidence-list li { margin: 4px 0; font-size: 13px; }

        .decision-path { background: #f6ffed; border-left: 4px solid #52c41a; padding: 12px; margin: 8px 0; border-radius: 4px; font-family: 'Monaco', 'Consolas', monospace; font-size: 13px; }
        .decision-path ol { padding-left: 20px; }
        .decision-path li { margin: 4px 0; }

        .params-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .param-item { background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
        .param-item .name { font-weight: 600; color: #262626; }
        .param-item .value { color: #1890ff; font-family: monospace; margin: 4px 0; }
        .param-item .meta { font-size: 12px; color: #8c8c8c; }
        .param-modified { border-left: 3px solid #faad14; }

        .tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 2px solid #f0f0f0; }
        .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-weight: 500; }
        .tab.active { border-bottom-color: #1890ff; color: #1890ff; }
        .tab:hover { color: #1890ff; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }

        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
        .modal.active { display: flex; }
        .modal-content { background: white; padding: 30px; border-radius: 12px; max-width: 800px; max-height: 80vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #8c8c8c; }

        .confidence-bar { height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
        .confidence-fill { height: 100%; }
        .confidence-high { background: #52c41a; }
        .confidence-medium { background: #faad14; }
        .confidence-low { background: #ff4d4f; }

        .source-badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 11px; margin-right: 4px; }
        .source-lecture_note { background: #f0f5ff; color: #2f54eb; }
        .source-business_table { background: #f6ffed; color: #389e0d; }
        .source-screenshot { background: #fffbe6; color: #d48806; }
        .source-summary_page { background: #fff0f6; color: #c41d7f; }
        .source-interpolation_engine { background: #f9f0ff; color: #531dab; }

        .legacy-note { background: #fff0f6; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #c41d7f; }
        .legacy-note h4 { color: #c41d7f; margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 期权波动率曲面清洗报告</h1>
            <div class="meta">
                <span><strong>标的:</strong> __UNDERLYING__</span>
                <span><strong>交易日:</strong> __TRADE_DATE__</span>
                <span><strong>曲面ID:</strong> __SURFACE_ID__</span>
                <span><strong>版本:</strong> __VERSION_ID__</span>
                <span class="status-badge status-__STATUS_CLASS__">
                    __STATUS_ICON__ __STATUS_TEXT__
                </span>
            </div>
            <p style="margin-top: 15px; opacity: 0.9;">__COMMENTS__</p>
        </div>

        <div class="grid">
            <div class="stat-card">
                <div class="label">原始数据点</div>
                <div class="value">__ORIGINAL_POINTS__</div>
            </div>
            <div class="stat-card">
                <div class="label">有效数据点</div>
                <div class="value" style="color: #52c41a;">__CLEANED_POINTS__</div>
            </div>
            <div class="stat-card">
                <div class="label">异常值移除</div>
                <div class="value" style="color: #ff4d4f;">__OUTLIERS_REMOVED__</div>
            </div>
            <div class="stat-card">
                <div class="label">插值补全</div>
                <div class="value" style="color: #faad14;">__INTERPOLATED_POINTS__</div>
            </div>
            <div class="stat-card">
                <div class="label">待处理冲突</div>
                <div class="value" style="color: #ff4d4f;">__CONFLICTS__</div>
            </div>
            <div class="stat-card">
                <div class="label">处理耗时</div>
                <div class="value">__PROCESSING_TIME__s</div>
            </div>
        </div>

        <div class="grid">
            <div class="stat-card">
                <div class="label">高置信度 (≥0.8)</div>
                <div class="value" style="color: #52c41a;">__HIGH_CONF__</div>
            </div>
            <div class="stat-card">
                <div class="label">中置信度 (0.5-0.8)</div>
                <div class="value" style="color: #faad14;">__MEDIUM_CONF__</div>
            </div>
            <div class="stat-card">
                <div class="label">低置信度 (<0.5)</div>
                <div class="value" style="color: #ff4d4f;">__LOW_CONF__</div>
            </div>
            <div class="stat-card">
                <div class="label">待人工复核</div>
                <div class="value" style="color: #faad14;">__NEEDS_REVIEW__</div>
            </div>
            <div class="stat-card">
                <div class="label">旧口径数据</div>
                <div class="value" style="color: #722ed1;">__LEGACY_POINTS__</div>
            </div>
        </div>

        <div class="section">
            <h2>📈 波动率曲面可视化</h2>

            <div class="tabs">
                <div class="tab active" onclick="switchTab('tab-3d')">3D曲面图</div>
                <div class="tab" onclick="switchTab('tab-smile')">波动率微笑</div>
                <div class="tab" onclick="switchTab('tab-term')">期限结构</div>
            </div>

            <div id="tab-3d" class="tab-content active">
                <p style="color: #8c8c8c; margin-bottom: 10px;">💡 点击曲面上的点可查看详细决策路径</p>
                <div id="chart-3d" class="chart-container chart-container-3d"></div>
            </div>

            <div id="tab-smile" class="tab-content">
                <p style="color: #8c8c8c; margin-bottom: 10px;">💡 点击曲线上的点可查看详细决策路径</p>
                <div id="chart-smile" class="chart-container"></div>
            </div>

            <div id="tab-term" class="tab-content">
                <p style="color: #8c8c8c; margin-bottom: 10px;">💡 ATM执行价: __ATM_STRIKE__</p>
                <div id="chart-term" class="chart-container"></div>
            </div>
        </div>

        <div class="section">
            <h2>🔍 数据详情</h2>
            <p style="color: #8c8c8c; margin-bottom: 10px;">💡 点击任意行查看该点的完整决策路径</p>
            <table id="points-table">
                <thead>
                    <tr>
                        <th>点ID</th>
                        <th>期限</th>
                        <th>行权价</th>
                        <th>类型</th>
                        <th>原始值</th>
                        <th>清洗后值</th>
                        <th>来源</th>
                        <th>置信度</th>
                        <th>状态</th>
                        <th>备注</th>
                    </tr>
                </thead>
                <tbody id="points-tbody">
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>⚠️ 冲突记录 (与汇总页对比)</h2>
            __CONFLICTS_HTML__
        </div>

        <div class="section">
            <h2>📜 各期限汇总</h2>
            <table>
                <thead>
                    <tr>
                        <th>期限</th>
                        <th>数据点数</th>
                        <th>有效点数</th>
                        <th>平均波动率</th>
                        <th>最小波动率</th>
                        <th>最大波动率</th>
                    </tr>
                </thead>
                <tbody>
                    __TENOR_SUMMARY_HTML__
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>⚙️ 参数版本记录</h2>
            <p style="color: #8c8c8c; margin-bottom: 10px;">💡 黄色边框表示该参数被人工修改过，非系统默认值</p>
            <div class="params-grid">
                __PARAMS_HTML__
            </div>
        </div>

        <div class="section">
            <h2>📁 数据来源</h2>
            <table>
                <thead>
                    <tr>
                        <th>来源类型</th>
                        <th>名称</th>
                        <th>路径</th>
                        <th>导入时间</th>
                        <th>字段映射</th>
                    </tr>
                </thead>
                <tbody>
                    __DATA_SOURCES_HTML__
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>📝 最近审计日志</h2>
            <table>
                <thead>
                    <tr>
                        <th>时间</th>
                        <th>操作</th>
                        <th>曲面ID</th>
                        <th>点ID</th>
                        <th>原因</th>
                        <th>操作人</th>
                    </tr>
                </thead>
                <tbody>
                    __AUDIT_TRAIL_HTML__
                </tbody>
            </table>
        </div>

        <div class="section">
            <h3 style="color: #8c8c8c; font-size: 13px; text-align: center; margin-top: 30px;">
                报告生成时间: __GENERATED_AT__ | 曲面ID: __SURFACE_ID__ | 版本: __VERSION_ID__
            </h3>
        </div>
    </div>

    <div id="point-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modal-title">点位详情</h2>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <div id="modal-body"></div>
        </div>
    </div>

    <script>
        const reportData = __REPORT_DATA__;

        function switchTab(tabId) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            if (tabId === 'tab-3d') init3DChart();
            else if (tabId === 'tab-smile') initSmileChart();
            else if (tabId === 'tab-term') initTermChart();
        }

        function getConfidenceClass(conf) {
            if (conf >= 0.8) return 'confidence-high';
            if (conf >= 0.5) return 'confidence-medium';
            return 'confidence-low';
        }

        function getSourceClass(source) {
            return 'source-' + source;
        }

        function renderPointsTable() {
            const tbody = document.getElementById('points-tbody');
            tbody.innerHTML = '';
            reportData.points_detail.forEach(p => {
                const tr = document.createElement('tr');
                tr.className = 'clickable';
                tr.onclick = () => showPointDetail(p.point_id);
                tr.innerHTML = `
                    <td><code>${p.point_id}</code></td>
                    <td><strong>${p.tenor}</strong></td>
                    <td>${p.strike.toFixed(2)}</td>
                    <td>${p.option_type === 'call' ? '看涨' : '看跌'}</td>
                    <td>${p.raw_value ? p.raw_value.toFixed(4) : '-'}</td>
                    <td><strong>${p.implied_vol.toFixed(4)}</strong></td>
                    <td><span class="source-badge ${getSourceClass(p.data_source)}">${p.data_source}</span></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="confidence-bar" style="width: 60px;">
                                <div class="confidence-fill ${getConfidenceClass(p.confidence)}" style="width: ${p.confidence * 100}%;"></div>
                            </div>
                            <span>${p.confidence.toFixed(2)}</span>
                        </div>
                    </td>
                    <td><span class="badge badge-${p.status_class}">${p.status}</span></td>
                    <td style="max-width: 200px; font-size: 12px; color: #8c8c8c;">${p.review_comment || p.outlier_reason || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        function showPointDetail(pointId) {
            const point = reportData.points_detail.find(p => p.point_id === pointId);
            const decisionPath = reportData.decision_paths[pointId];
            const modal = document.getElementById('point-modal');
            const title = document.getElementById('modal-title');
            const body = document.getElementById('modal-body');

            title.textContent = `点位详情 - ${point.tenor} @ K=${point.strike.toFixed(2)}`;

            let html = `
                <div class="stat-card" style="margin-bottom: 20px;">
                    <div class="grid" style="grid-template-columns: repeat(4, 1fr);">
                        <div>
                            <div class="label">点ID</div>
                            <div class="value" style="font-size: 16px;"><code>${point.point_id}</code></div>
                        </div>
                        <div>
                            <div class="label">原始值</div>
                            <div class="value" style="font-size: 18px;">${point.raw_value ? point.raw_value.toFixed(4) : '-'}</div>
                        </div>
                        <div>
                            <div class="label">清洗后值</div>
                            <div class="value" style="font-size: 18px; color: #1890ff;">${point.implied_vol.toFixed(4)}</div>
                        </div>
                        <div>
                            <div class="label">置信度</div>
                            <div class="value" style="font-size: 18px;">${point.confidence.toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                <h3>基本信息</h3>
                <table style="margin-bottom: 20px;">
                    <tr><th>期限</th><td>${point.tenor}</td></tr>
                    <tr><th>行权价</th><td>${point.strike.toFixed(4)}</td></tr>
                    <tr><th>期权类型</th><td>${point.option_type === 'call' ? '看涨' : '看跌'}</td></tr>
                    <tr><th>数据来源</th><td><span class="source-badge ${getSourceClass(point.data_source)}">${point.data_source}</span></td></tr>
                    <tr><th>状态</th><td><span class="badge badge-${point.status_class}">${point.status}</span></td></tr>
                    <tr><th>是否异常值</th><td>${point.is_outlier ? '是' : '否'}</td></tr>
                    <tr><th>是否插值</th><td>${point.is_interpolated ? '是' : '否'}</td></tr>
                    <tr><th>标签</th><td>${point.tags.join(', ') || '-'}</td></tr>
                    ${point.review_comment ? `<tr><th>复核备注</th><td style="color: #faad14;">${point.review_comment}</td></tr>` : ''}
                    ${point.outlier_reason ? `<tr><th>异常原因</th><td style="color: #ff4d4f;">${point.outlier_reason}</td></tr>` : ''}
                </table>
            `;

            if (decisionPath) {
                html += `
                    <h3>决策路径</h3>
                    <div class="decision-path">
                        <ol>
                            ${decisionPath.map(step => `<li>${step}</li>`).join('')}
                        </ol>
                    </div>
                `;
            }

            const logs = reportData.audit_trail.filter(l => l.point_id === pointId);
            if (logs.length > 0) {
                html += `
                    <h3>处理日志</h3>
                    <table>
                        <thead>
                            <tr><th>时间</th><th>操作</th><th>旧值</th><th>新值</th><th>原因</th></tr>
                        </thead>
                        <tbody>
                            ${logs.map(log => `
                                <tr>
                                    <td style="font-size: 12px;">${log.timestamp.slice(11, 19)}</td>
                                    <td>${log.action}</td>
                                    <td>${log.old_value !== null ? log.old_value.toFixed(4) : '-'}</td>
                                    <td>${log.new_value !== null ? log.new_value.toFixed(4) : '-'}</td>
                                    <td style="font-size: 12px;">${log.reason}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }

            body.innerHTML = html;
            modal.classList.add('active');
        }

        function closeModal() {
            document.getElementById('point-modal').classList.remove('active');
        }

        document.getElementById('point-modal').onclick = function(e) {
            if (e.target.id === 'point-modal') closeModal();
        }

        function init3DChart() {
            const chart = echarts.init(document.getElementById('chart-3d'));
            const data = reportData.chart_data.surface;

            const option = {
                tooltip: {
                    formatter: function(params) {
                        const d = params.data;
                        return `
                            <div style="padding: 8px;">
                                <strong>${d.tenor} @ K=${d.x.toFixed(2)}</strong><br/>
                                波动率: <strong>${d.z.toFixed(4)}</strong><br/>
                                置信度: ${d.confidence.toFixed(2)}<br/>
                                来源: ${d.data_source}<br/>
                                <span style="color: #1890ff;">点击查看详情 →</span>
                            </div>
                        `;
                    }
                },
                grid3D: {
                    viewControl: {
                        projection: 'perspective',
                        autoRotate: false,
                        distance: 200
                    },
                    boxWidth: 120,
                    boxDepth: 60,
                    boxHeight: 80,
                    light: {
                        main: { intensity: 1.2, shadow: true },
                        ambient: { intensity: 0.3 }
                    }
                },
                xAxis3D: {
                    type: 'value',
                    name: '行权价 (K)',
                    nameTextStyle: { fontSize: 12 }
                },
                yAxis3D: {
                    type: 'value',
                    name: '期限 (年)',
                    nameTextStyle: { fontSize: 12 }
                },
                zAxis3D: {
                    type: 'value',
                    name: '隐含波动率',
                    nameTextStyle: { fontSize: 12 },
                    min: 0,
                    max: 0.5
                },
                series: [{
                    type: 'surface',
                    data: data.map(d => [d.x, d.y, d.z, d]),
                    shading: 'color',
                    wireframe: { show: false },
                    itemStyle: {
                        opacity: 0.9
                    },
                    emphasis: {
                        itemStyle: {
                            color: '#ffeb3b'
                        }
                    }
                }]
            };

            chart.setOption(option);
            chart.off('click');
            chart.on('click', function(params) {
                if (params.data && params.data[3]) {
                    showPointDetail(params.data[3].point_id);
                }
            });
        }

        function initSmileChart() {
            const chart = echarts.init(document.getElementById('chart-smile'));
            const smileCurves = reportData.chart_data.smile_curves;
            const tenors = reportData.chart_data.tenors;

            const series = tenors.map((tenor, idx) => {
                const curve = smileCurves[tenor];
                const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272'];
                return {
                    name: tenor,
                    type: 'line',
                    data: curve.strikes.map((s, i) => ({
                        value: [s, curve.vols[i]],
                        pointId: curve.point_ids[i],
                        confidence: curve.confidence[i]
                    })),
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: {
                        width: 2,
                        color: colors[idx % colors.length]
                    },
                    itemStyle: {
                        color: colors[idx % colors.length]
                    },
                    emphasis: {
                        itemStyle: {
                            borderWidth: 3,
                            borderColor: '#ffeb3b'
                        }
                    }
                };
            });

            const option = {
                tooltip: {
                    trigger: 'item',
                    formatter: function(params) {
                        const d = params.data;
                        return `
                            <div style="padding: 8px;">
                                <strong>${params.seriesName} @ K=${d.value[0].toFixed(2)}</strong><br/>
                                波动率: <strong>${d.value[1].toFixed(4)}</strong><br/>
                                置信度: ${d.confidence.toFixed(2)}<br/>
                                <span style="color: #1890ff;">点击查看详情 →</span>
                            </div>
                        `;
                    }
                },
                legend: {
                    data: tenors,
                    top: 0
                },
                grid: {
                    top: 40,
                    left: 60,
                    right: 20,
                    bottom: 50
                },
                xAxis: {
                    type: 'value',
                    name: '行权价 (K)',
                    nameLocation: 'middle',
                    nameGap: 30,
                    nameTextStyle: { fontSize: 13 }
                },
                yAxis: {
                    type: 'value',
                    name: '隐含波动率',
                    nameLocation: 'middle',
                    nameGap: 40,
                    nameTextStyle: { fontSize: 13 },
                    min: 0,
                    max: 0.4
                },
                series: series
            };

            chart.setOption(option);
            chart.off('click');
            chart.on('click', function(params) {
                if (params.data && params.data.pointId) {
                    showPointDetail(params.data.pointId);
                }
            });
        }

        function initTermChart() {
            const chart = echarts.init(document.getElementById('chart-term'));
            const termStruct = reportData.chart_data.term_structure;
            const tenors = reportData.chart_data.tenors;

            const maturities = [];
            const vols = [];
            const pointIds = [];
            const confidences = [];

            tenors.forEach(tenor => {
                if (termStruct[tenor]) {
                    maturities.push(termStruct[tenor].maturity);
                    vols.push(termStruct[tenor].atm_vol);
                    pointIds.push(termStruct[tenor].point_id);
                    confidences.push(termStruct[tenor].confidence);
                }
            });

            const option = {
                tooltip: {
                    trigger: 'axis',
                    formatter: function(params) {
                        const idx = params[0].dataIndex;
                        return `
                            <div style="padding: 8px;">
                                <strong>${tenors[idx]}</strong><br/>
                                到期时间: ${maturities[idx].toFixed(2)}年<br/>
                                ATM波动率: <strong>${vols[idx].toFixed(4)}</strong><br/>
                                置信度: ${confidences[idx].toFixed(2)}<br/>
                                <span style="color: #1890ff;">点击查看详情 →</span>
                            </div>
                        `;
                    }
                },
                grid: {
                    top: 20,
                    left: 60,
                    right: 20,
                    bottom: 50
                },
                xAxis: {
                    type: 'category',
                    data: tenors,
                    name: '期限',
                    nameLocation: 'middle',
                    nameGap: 30,
                    nameTextStyle: { fontSize: 13 }
                },
                yAxis: {
                    type: 'value',
                    name: 'ATM隐含波动率',
                    nameLocation: 'middle',
                    nameGap: 40,
                    nameTextStyle: { fontSize: 13 },
                    min: 0,
                    max: 0.3
                },
                series: [{
                    type: 'line',
                    data: vols.map((v, i) => ({
                        value: v,
                        pointId: pointIds[i],
                        confidence: confidences[i]
                    })),
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 12,
                    lineStyle: {
                        width: 3,
                        color: '#667eea'
                    },
                    itemStyle: {
                        color: '#667eea',
                        borderWidth: 2,
                        borderColor: '#fff'
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(102, 126, 234, 0.4)' },
                            { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
                        ])
                    },
                    emphasis: {
                        itemStyle: {
                            borderWidth: 4,
                            borderColor: '#ffeb3b'
                        }
                    }
                }]
            };

            chart.setOption(option);
            chart.off('click');
            chart.on('click', function(params) {
                if (params.data && params.data.pointId) {
                    showPointDetail(params.data.pointId);
                }
            });
        }

        renderPointsTable();
        init3DChart();

        window.addEventListener('resize', function() {
            const chart3d = echarts.getInstanceByDom(document.getElementById('chart-3d'));
            const chartSmile = echarts.getInstanceByDom(document.getElementById('chart-smile'));
            const chartTerm = echarts.getInstanceByDom(document.getElementById('chart-term'));
            if (chart3d) chart3d.resize();
            if (chartSmile) chartSmile.resize();
            if (chartTerm) chartTerm.resize();
        });
    </script>
</body>
</html>
"""

    def _render_conflicts(self, conflicts: List[Dict[str, Any]]) -> str:
        if not conflicts:
            return '<div class="badge badge-success">✓ 未检测到与汇总页的数据冲突</div>'

        html = ''
        for c in conflicts:
            html += f"""
            <div class="conflict-card">
                <h4>⚠️ 冲突 #{c['conflict_id'][:8]} - {c['point_id']}</h4>
                <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom: 12px;">
                    <div class="stat-card">
                        <div class="label">导入数据值</div>
                        <div class="value" style="color: #1890ff; font-size: 22px;">{c['imported_value']:.4f}</div>
                        <div class="trend">来源: {c['imported_source']}</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">汇总页值</div>
                        <div class="value" style="color: #722ed1; font-size: 22px;">{c['summary_page_value']:.4f}</div>
                        <div class="trend">来源: {c['summary_page_source']}</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">差异百分比</div>
                        <div class="value" style="color: #ff4d4f; font-size: 22px;">{c['difference']:.1f}%</div>
                        <div class="trend">{'已解决' if c['resolved'] else '待处理'}</div>
                    </div>
                </div>
                <p><strong>💡 建议动作:</strong> {c['suggested_action']}</p>
                <p style="margin-top: 8px; color: #8c8c8c;">
                    <strong>📝 证据链接:</strong>
                </p>
                <ul class="evidence-list">
                    <li>导入数据原始文件: <code>storage/surfaces/raw/{c['surface_id']}.json</code></li>
                    <li>汇总页数据: <code>storage/summary_page.json</code></li>
                    <li>对应处理日志: <code>log_id in audit_logs</code> (点ID: {c['point_id']})</li>
                </ul>
            </div>
            """
        return html

    def _render_tenor_summary(self, summary: Dict[str, Any]) -> str:
        html = ''
        for tenor, data in sorted(summary.items()):
            html += f"""
            <tr>
                <td><strong>{tenor}</strong></td>
                <td>{data['count']}</td>
                <td>{data['valid_count']}</td>
                <td>{data['avg_vol']:.4f}</td>
                <td>{data['min_vol']:.4f}</td>
                <td>{data['max_vol']:.4f}</td>
            </tr>
            """
        return html

    def _render_parameters(self, params: List[Dict[str, Any]]) -> str:
        html = ''
        for p in params:
            modified_class = 'param-modified' if p['is_user_modified'] else ''
            value_str = str(p['value'])
            if len(value_str) > 50:
                value_str = value_str[:50] + '...'
            html += f"""
            <div class="param-item {modified_class}">
                <div class="name">{p['parameter_name']}</div>
                <div class="value">{value_str}</div>
                <div class="meta">
                    {'⚠️ 人工修改' if p['is_user_modified'] else '系统默认'} |
                    版本: <code>{p['version_id']}</code>
                    {f' | 修改于: {p["modified_at"][:19] if p["modified_at"] else ""}' if p['is_user_modified'] else ''}
                </div>
                {f'<div class="meta" style="margin-top: 4px; color: #faad14;">备注: {p["comment"]}</div>' if p['comment'] else ''}
                {f'<div class="meta" style="margin-top: 4px;">默认值: <code>{p["default_value"]}</code></div>' if p['is_user_modified'] else ''}
            </div>
            """
        return html

    def _render_data_sources(self, sources: List[Dict[str, Any]]) -> str:
        html = ''
        for ds in sources:
            mapping_str = ', '.join([f'{k}→{v}' for k, v in ds['field_mapping'].items()]) or '-'
            html += f"""
            <tr>
                <td><span class="source-badge source-{ds['source_type']}">{ds['source_type']}</span></td>
                <td><strong>{ds['source_name']}</strong></td>
                <td><code style="font-size: 11px;">{ds['source_path'] or '-'}</code></td>
                <td>{ds['import_time'][:19]}</td>
                <td style="font-size: 11px;">{mapping_str}</td>
            </tr>
            """
        return html

    def _render_audit_trail(self, logs: List[Dict[str, Any]]) -> str:
        html = ''
        for log in logs:
            html += f"""
            <tr>
                <td style="font-size: 11px;">{log['timestamp'][:19]}</td>
                <td><strong>{log['action']}</strong></td>
                <td><code style="font-size: 11px;">{log['surface_id'] or '-'}</code></td>
                <td><code style="font-size: 11px;">{log['point_id'] or '-'}</code></td>
                <td style="font-size: 11px; max-width: 300px;">{log['reason'] or '-'}</td>
                <td>{log['operator']}</td>
            </tr>
            """
        return html

    def generate_text_summary(self, result: CleanResult) -> str:
        surface = result.surface
        summary = []
        summary.append("=" * 60)
        summary.append("期权波动率曲面清洗报告")
        summary.append("=" * 60)
        summary.append(f"标的: {surface.underlying}")
        summary.append(f"交易日: {surface.trade_date.strftime('%Y-%m-%d')}")
        summary.append(f"曲面ID: {surface.surface_id}")
        summary.append(f"状态: {surface.status.value}")
        summary.append("")
        summary.append("--- 处理摘要 ---")
        summary.append(f"原始数据点: {result.original_points}")
        summary.append(f"有效数据点: {result.cleaned_points}")
        summary.append(f"异常值移除: {result.outliers_removed}")
        summary.append(f"插值补全: {result.interpolated_points}")
        summary.append(f"冲突检测: {len(result.conflicts_found)} 个")
        summary.append(f"处理耗时: {result.processing_time:.3f}秒")
        summary.append("")

        if result.conflicts_found:
            summary.append("--- 冲突记录 ---")
            for c in result.conflicts_found:
                summary.append(f"  点 {c.point_id}:")
                summary.append(f"    导入值: {c.imported_value:.4f} (来源: {c.imported_source})")
                summary.append(f"    汇总值: {c.summary_page_value:.4f} (来源: {c.summary_page_source})")
                summary.append(f"    差异: {c.difference:.1f}%")
                summary.append(f"    建议: {c.suggested_action}")
                summary.append("")

        summary.append("--- 参数版本 ---")
        for pv in result.parameter_versions_used:
            modified = " (人工修改)" if pv.is_user_modified else ""
            summary.append(f"  {pv.parameter_name}: {pv.value}{modified}")

        summary.append("")
        summary.append("--- 数据来源 ---")
        for ds in surface.data_sources:
            summary.append(f"  - {ds.source_type.value}: {ds.source_name}")
            if ds.source_path:
                summary.append(f"    路径: {ds.source_path}")

        summary.append("")
        summary.append("=" * 60)
        return "\n".join(summary)
