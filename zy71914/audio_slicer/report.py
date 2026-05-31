"""可视化报告生成器 - 生成可本地运行的HTML报告"""

import os
import json
from typing import Dict, Any
from datetime import datetime

from .models import Project
from .engine import SliceCalculator


class ReportGenerator:
    """HTML报告生成器"""

    def __init__(self, project: Project):
        self.project = project

    def generate_report(self, output_path: str) -> str:
        """生成完整的HTML报告"""
        data = self._prepare_data()
        html = self._build_html(data)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)

        return output_path

    def _prepare_data(self) -> Dict[str, Any]:
        """准备报告数据"""
        review_summary = {
            "total": len(self.project.slices),
            "reviewed": sum(1 for s in self.project.slices if s.reviewed),
            "approved": sum(1 for s in self.project.slices if s.status == "approved"),
            "rejected": sum(1 for s in self.project.slices if s.status == "rejected"),
            "pending": sum(1 for s in self.project.slices if not s.reviewed),
            "has_warnings": sum(1 for s in self.project.slices if s.warnings),
            "has_issues": sum(1 for s in self.project.slices if s.issues),
            "silence_open": sum(1 for si in self.project.silence_issues if si.status == "open"),
            "silence_resolved": sum(1 for si in self.project.silence_issues if si.status == "resolved"),
        }
        if review_summary["total"] > 0:
            review_summary["progress"] = round(review_summary["reviewed"] / review_summary["total"] * 100, 1)
        else:
            review_summary["progress"] = 0

        total_duration = sum(s.duration for s in self.project.slices)
        approved_duration = sum(s.duration for s in self.project.slices if s.status == "approved")

        ad_spots = [a.to_dict() for a in self.project.ad_spots]
        for ad in ad_spots:
            ad["start_time_formatted"] = SliceCalculator.format_time(ad["start_time"])
            ad["end_time_formatted"] = SliceCalculator.format_time(ad["end_time"])

        raw_tracks = [t.to_dict() for t in self.project.raw_tracks]
        for track in raw_tracks:
            track["start_time_formatted"] = SliceCalculator.format_time(track["start_time"])
            track["end_time_formatted"] = SliceCalculator.format_time(track["end_time"])

        slices = []
        for s in sorted(self.project.slices, key=lambda x: x.start_time):
            s_dict = s.to_dict()
            s_dict["start_time_formatted"] = SliceCalculator.format_time(s.start_time)
            s_dict["end_time_formatted"] = SliceCalculator.format_time(s.end_time)
            s_dict["duration_formatted"] = SliceCalculator.format_time(s.duration)
            s_dict["history_count"] = sum(
                1 for h in self.project.history
                if h.target_type == "slice" and h.target_id == s.id
            )
            slices.append(s_dict)

        silence_issues = []
        for si in self.project.silence_issues:
            si_dict = si.to_dict()
            si_dict["start_time_formatted"] = SliceCalculator.format_time(si.start_time)
            si_dict["end_time_formatted"] = SliceCalculator.format_time(si.end_time)
            si_dict["duration_formatted"] = SliceCalculator.format_time(si.duration)
            si_dict["source_badge"] = self._get_source_badge(si.source_type)
            silence_issues.append(si_dict)

        history = []
        for h in sorted(self.project.history, key=lambda x: x.timestamp, reverse=True):
            h_dict = h.to_dict()
            h_dict["target_link"] = self._get_history_target_link(h)
            history.append(h_dict)

        timeline = self._build_timeline()

        return {
            "project": {
                "id": self.project.id,
                "name": self.project.name,
                "created_at": self.project.created_at.isoformat(),
                "updated_at": self.project.updated_at.isoformat(),
            },
            "summary": {
                **review_summary,
                "total_duration": round(total_duration, 3),
                "total_duration_formatted": SliceCalculator.format_time(total_duration),
                "approved_duration": round(approved_duration, 3),
                "approved_duration_formatted": SliceCalculator.format_time(approved_duration),
                "ad_count": len(self.project.ad_spots),
                "track_count": len(self.project.raw_tracks),
                "slice_count": len(self.project.slices),
                "silence_issue_count": len(self.project.silence_issues),
                "history_count": len(self.project.history),
            },
            "ad_spots": ad_spots,
            "raw_tracks": raw_tracks,
            "slices": slices,
            "silence_issues": silence_issues,
            "history": history,
            "timeline": timeline,
            "generated_at": datetime.now().isoformat(),
        }

    def _get_source_badge(self, source_type: str) -> Dict[str, str]:
        badges = {
            "ad_spot": {"label": "广告口播表", "class": "badge-ad"},
            "raw_track": {"label": "原始音轨", "class": "badge-track"},
            "unknown": {"label": "来源不明", "class": "badge-unknown"},
        }
        return badges.get(source_type, badges["unknown"])

    def _get_history_target_link(self, h) -> str:
        if h.target_type == "slice":
            return f"#slice-{h.target_id}"
        elif h.target_type == "project":
            return "#overview"
        else:
            return ""

    def _build_timeline(self) -> Dict[str, Any]:
        """构建时间轴可视化数据"""
        all_segments = []
        max_end = 0

        for ad in self.project.ad_spots:
            all_segments.append({
                "type": "ad",
                "id": ad.id,
                "name": ad.name,
                "start": ad.start_time,
                "end": ad.end_time,
                "label": f"[广告] {ad.name}"
            })
            max_end = max(max_end, ad.end_time)

        for track in self.project.raw_tracks:
            all_segments.append({
                "type": "silence" if track.is_silence else "track",
                "id": track.id,
                "name": track.name,
                "start": track.start_time,
                "end": track.end_time,
                "label": f"[音轨] {track.name}"
            })
            max_end = max(max_end, track.end_time)

        for s in self.project.slices:
            all_segments.append({
                "type": "slice",
                "id": s.id,
                "name": s.name,
                "start": s.start_time,
                "end": s.end_time,
                "label": s.name,
                "status": s.status,
                "slice_type": s.slice_type
            })
            max_end = max(max_end, s.end_time)

        return {
            "max_time": max_end,
            "max_time_formatted": SliceCalculator.format_time(max_end),
            "segments": all_segments
        }

    def _build_html(self, data: Dict[str, Any]) -> str:
        """构建完整HTML"""
        json_data = json.dumps(data, ensure_ascii=False)

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>课程音频切片报告 - {data['project']['name']}</title>
    <style>
        {self._get_css()}
    </style>
</head>
<body>
    <div class="app">
        <header class="header">
            <div class="header-content">
                <h1>🎙️ 课程音频切片系统</h1>
                <div class="project-info">
                    <span class="project-name">{data['project']['name']}</span>
                    <span class="project-id">ID: {data['project']['id']}</span>
                </div>
            </div>
            <nav class="nav-tabs">
                <button class="nav-tab active" data-tab="overview">总览</button>
                <button class="nav-tab" data-tab="slices">切片清单</button>
                <button class="nav-tab" data-tab="silence">静音段问题</button>
                <button class="nav-tab" data-tab="sources">源数据</button>
                <button class="nav-tab" data-tab="timeline">时间轴</button>
                <button class="nav-tab" data-tab="history">历史记录</button>
            </nav>
        </header>

        <main class="main">
            <div id="tab-overview" class="tab-content active">
                {self._build_overview_tab(data)}
            </div>
            <div id="tab-slices" class="tab-content">
                {self._build_slices_tab(data)}
            </div>
            <div id="tab-silence" class="tab-content">
                {self._build_silence_tab(data)}
            </div>
            <div id="tab-sources" class="tab-content">
                {self._build_sources_tab(data)}
            </div>
            <div id="tab-timeline" class="tab-content">
                {self._build_timeline_tab(data)}
            </div>
            <div id="tab-history" class="tab-content">
                {self._build_history_tab(data)}
            </div>
        </main>

        <div id="slice-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="modal-title">切片详情</h2>
                    <button class="close-btn" onclick="closeModal()">&times;</button>
                </div>
                <div id="modal-body" class="modal-body"></div>
            </div>
        </div>
    </div>

    <script>
        const APP_DATA = {json_data};
        {self._get_javascript()}
    </script>
</body>
</html>"""
        return html

    def _get_css(self) -> str:
        return """
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            background: #f5f7fa;
            color: #333;
            line-height: 1.6;
        }
        .app { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
        }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .project-info { display: flex; gap: 16px; opacity: 0.9; font-size: 14px; }
        .nav-tabs {
            display: flex;
            gap: 4px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .nav-tab {
            background: rgba(255,255,255,0.15);
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 8px 8px 0 0;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        .nav-tab:hover { background: rgba(255,255,255,0.25); }
        .nav-tab.active {
            background: #f5f7fa;
            color: #667eea;
            font-weight: 600;
        }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .main { background: white; border-radius: 12px; padding: 24px; }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
        }
        .stat-card:nth-child(2) { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
        .stat-card:nth-child(3) { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
        .stat-card:nth-child(4) { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
        .stat-card:nth-child(5) { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333; }
        .stat-card:nth-child(6) { background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); color: #333; }
        .stat-value { font-size: 28px; font-weight: 700; }
        .stat-label { font-size: 13px; opacity: 0.9; }

        .progress-container {
            background: #e0e0e0;
            border-radius: 10px;
            height: 24px;
            overflow: hidden;
            margin-bottom: 24px;
        }
        .progress-bar {
            background: linear-gradient(90deg, #43e97b, #38f9d7);
            height: 100%;
            transition: width 0.5s;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            font-weight: 600;
        }

        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin: 24px 0 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e0e0e0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 13px;
        }
        th {
            background: #f5f7fa;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #e0e0e0;
            position: sticky;
            top: 0;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #f0f0f0;
        }
        tr:hover { background: #f9fafc; }

        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }
        .badge-ad { background: #fff0f0; color: #e74c3c; }
        .badge-track { background: #e8f5e9; color: #27ae60; }
        .badge-unknown { background: #fff3e0; color: #f39c12; }
        .badge-approved { background: #e8f5e9; color: #27ae60; }
        .badge-rejected { background: #ffebee; color: #e74c3c; }
        .badge-pending { background: #fff3e0; color: #f39c12; }
        .badge-content { background: #e3f2fd; color: #1976d2; }
        .badge-slice { background: #f3e5f5; color: #7b1fa2; }
        .badge-warning { background: #fff8e1; color: #ff8f00; }
        .badge-issue { background: #ffebee; color: #c62828; }

        .source-link {
            color: #667eea;
            cursor: pointer;
            text-decoration: underline;
        }
        .source-link:hover { color: #764ba2; }

        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
        }
        .btn-primary { background: #667eea; color: white; }
        .btn-primary:hover { background: #5a67d8; }
        .btn-secondary { background: #e0e0e0; color: #333; }
        .btn-secondary:hover { background: #d0d0d0; }

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0; top: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.5);
            overflow-y: auto;
        }
        .modal.show { display: flex; align-items: center; justify-content: center; }
        .modal-content {
            background: white;
            border-radius: 12px;
            max-width: 800px;
            width: 90%;
            max-height: 85vh;
            overflow-y: auto;
            margin: 20px;
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #e0e0e0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px 12px 0 0;
        }
        .modal-header h2 { font-size: 18px; }
        .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 28px;
            cursor: pointer;
            padding: 0 8px;
        }
        .modal-body { padding: 24px; }

        .detail-section { margin-bottom: 20px; }
        .detail-section h3 {
            font-size: 15px;
            color: #667eea;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid #e0e0e0;
        }
        .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 12px;
        }
        .detail-item label {
            display: block;
            font-size: 12px;
            color: #888;
            margin-bottom: 4px;
        }
        .detail-item .value { font-size: 14px; color: #333; }
        .full-width { grid-column: 1 / -1; }

        .source-card {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            background: #f9fafc;
        }
        .source-card h4 {
            font-size: 14px;
            color: #667eea;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .history-item {
            border-left: 3px solid #667eea;
            padding: 12px;
            margin-bottom: 12px;
            background: #f9fafc;
            border-radius: 0 8px 8px 0;
        }
        .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 12px;
        }
        .history-operator { font-weight: 600; color: #667eea; }
        .history-time { color: #888; }
        .history-diff { font-size: 13px; color: #333; }
        .history-reason { font-size: 12px; color: #888; margin-top: 4px; }

        .timeline-container {
            margin-top: 20px;
            overflow-x: auto;
        }
        .timeline-row {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            gap: 10px;
        }
        .timeline-label {
            width: 80px;
            font-size: 12px;
            color: #888;
            flex-shrink: 0;
        }
        .timeline-track {
            flex: 1;
            height: 40px;
            background: #f0f0f0;
            border-radius: 6px;
            position: relative;
            min-width: 600px;
        }
        .timeline-segment {
            position: absolute;
            height: 100%;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: white;
            overflow: hidden;
            transition: opacity 0.2s;
        }
        .timeline-segment:hover { opacity: 0.8; }
        .timeline-segment.ad { background: linear-gradient(90deg, #e74c3c, #c0392b); }
        .timeline-segment.track { background: linear-gradient(90deg, #3498db, #2980b9); }
        .timeline-segment.silence { background: repeating-linear-gradient(45deg, #95a5a6, #95a5a6 10px, #7f8c8d 10px, #7f8c8d 20px); }
        .timeline-segment.slice { background: linear-gradient(90deg, #9b59b6, #8e44ad); }
        .timeline-segment.slice.approved { background: linear-gradient(90deg, #27ae60, #2ecc71); }
        .timeline-segment.slice.rejected { background: linear-gradient(90deg, #e74c3c, #c0392b); }

        .silence-card {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            border-left: 4px solid #f39c12;
        }
        .silence-card.resolved { border-left-color: #27ae60; opacity: 0.7; }
        .silence-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .silence-action {
            background: #fff3e0;
            padding: 12px;
            border-radius: 6px;
            margin-top: 12px;
        }
        .silence-contact { font-weight: 600; color: #e67e22; }

        .warnings-box {
            background: #fff8e1;
            border: 1px solid #ffecb3;
            border-radius: 6px;
            padding: 12px;
            margin-top: 12px;
        }
        .warnings-box h4 { color: #ff8f00; margin-bottom: 8px; font-size: 13px; }
        .warnings-box ul { padding-left: 20px; font-size: 13px; }

        .issues-box {
            background: #ffebee;
            border: 1px solid #ffcdd2;
            border-radius: 6px;
            padding: 12px;
            margin-top: 12px;
        }
        .issues-box h4 { color: #c62828; margin-bottom: 8px; font-size: 13px; }
        .issues-box ul { padding-left: 20px; font-size: 13px; }

        .subtitle-box {
            background: #f5f7fa;
            padding: 12px;
            border-radius: 6px;
            margin-top: 8px;
        }
        .subtitle-label {
            font-size: 12px;
            color: #888;
            margin-bottom: 4px;
        }
        .subtitle-content { font-size: 14px; line-height: 1.6; }
        .subtitle-diff {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 8px;
        }

        .search-box {
            margin-bottom: 16px;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }
        .search-box input {
            flex: 1;
            min-width: 200px;
            padding: 10px 16px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
        }
        .search-box select {
            padding: 10px 16px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            background: white;
        }

        @media (max-width: 768px) {
            .detail-grid { grid-template-columns: 1fr; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        """

    def _build_overview_tab(self, data: Dict[str, Any]) -> str:
        s = data["summary"]
        return f"""
        <h2 class="section-title">📊 项目总览</h2>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">{s['slice_count']}</div>
                <div class="stat-label">切片总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{s['approved']}</div>
                <div class="stat-label">已通过</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{s['pending']}</div>
                <div class="stat-label">待复核</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{s['total_duration_formatted']}</div>
                <div class="stat-label">总时长</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{s['silence_open']}</div>
                <div class="stat-label">待处理静音段</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{s['history_count']}</div>
                <div class="stat-label">历史操作</div>
            </div>
        </div>

        <h3 style="font-size: 14px; color: #666; margin-bottom: 8px;">复核进度</h3>
        <div class="progress-container">
            <div class="progress-bar" style="width: {s['progress']}%;">
                {s['progress']}%
            </div>
        </div>

        <div class="detail-grid">
            <div class="detail-item">
                <label>广告口播条目数</label>
                <div class="value">{s['ad_count']} 条</div>
            </div>
            <div class="detail-item">
                <label>原始音轨条目数</label>
                <div class="value">{s['track_count']} 条</div>
            </div>
            <div class="detail-item">
                <label>已通过时长</label>
                <div class="value">{s['approved_duration_formatted']}</div>
            </div>
            <div class="detail-item">
                <label>已拒绝</label>
                <div class="value">{s['rejected']} 个</div>
            </div>
            <div class="detail-item">
                <label>含警告切片</label>
                <div class="value">{s['has_warnings']} 个</div>
            </div>
            <div class="detail-item">
                <label>含问题切片</label>
                <div class="value">{s['has_issues']} 个</div>
            </div>
        </div>

        <h2 class="section-title">⚠️ 待处理静音段问题</h2>
        {self._build_silence_summary(data)}

        <h2 class="section-title">📝 最近操作</h2>
        {self._build_recent_history(data)}
        """

    def _build_silence_summary(self, data: Dict[str, Any]) -> str:
        open_issues = [si for si in data["silence_issues"] if si["status"] == "open"]
        if not open_issues:
            return '<p style="color: #888;">暂无待处理的静音段问题</p>'

        rows = ""
        for si in open_issues[:5]:
            rows += f"""
            <tr>
                <td>{si['start_time_formatted']} - {si['end_time_formatted']}</td>
                <td>{si['duration_formatted']}</td>
                <td><span class="badge {si['source_badge']['class']}">{si['source_badge']['label']}</span></td>
                <td>{si['source_ref']}</td>
                <td><span class="silence-contact">{si['contact_person']}</span></td>
            </tr>
            """

        return f"""
        <table>
            <thead>
                <tr>
                    <th>时间段</th>
                    <th>时长</th>
                    <th>来源</th>
                    <th>来源引用</th>
                    <th>联系处理</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
        <p style="text-align: right; color: #888; font-size: 12px;">
            显示前5条，<a href="#" onclick="switchTab('silence')" class="source-link">查看全部</a>
        </p>
        """

    def _build_recent_history(self, data: Dict[str, Any]) -> str:
        recent = data["history"][:5]
        if not recent:
            return '<p style="color: #888;">暂无操作记录</p>'

        html = ""
        for h in recent:
            html += f"""
            <div class="history-item">
                <div class="history-header">
                    <span class="history-operator">{h['operator']}</span>
                    <span class="history-time">{h['timestamp']}</span>
                </div>
                <div class="history-diff">{h['diff_summary']}</div>
                <div class="history-reason">{h['reason']}</div>
            </div>
            """
        return html

    def _build_slices_tab(self, data: Dict[str, Any]) -> str:
        return f"""
        <h2 class="section-title">🎵 切片清单</h2>

        <div class="search-box">
            <input type="text" id="slice-search" placeholder="搜索切片名称、内容、来源..." oninput="filterSlices()">
            <select id="slice-status-filter" onchange="filterSlices()">
                <option value="">全部状态</option>
                <option value="pending">待复核</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
            </select>
            <select id="slice-type-filter" onchange="filterSlices()">
                <option value="">全部类型</option>
                <option value="content">内容</option>
                <option value="ad">广告</option>
            </select>
        </div>

        <div id="slices-table-container">
            <table>
                <thead>
                    <tr>
                        <th>序号</th>
                        <th>切片名称</th>
                        <th>时间</th>
                        <th>时长</th>
                        <th>类型</th>
                        <th>状态</th>
                        <th>来源</th>
                        <th>字幕</th>
                        <th>历史</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="slices-table-body">
                    {self._build_slices_table_rows(data["slices"])}
                </tbody>
            </table>
        </div>
        """

    def _build_slices_table_rows(self, slices) -> str:
        rows = ""
        for idx, s in enumerate(slices, 1):
            status_badge = f'badge-{s["status"]}'
            type_badge = 'badge-ad' if s['slice_type'] == 'ad' else 'badge-content'
            has_warning = ' ⚠️' if s['warnings'] else ''
            has_issue = ' ❌' if s['issues'] else ''
            has_history = f' <span class="badge badge-warning">{s["history_count"]}</span>' if s["history_count"] > 0 else ''

            rows += f"""
            <tr id="slice-row-{s['id']}" data-id="{s['id']}"
                data-name="{s['name']} {s['content']} {s['source_ref']}"
                data-status="{s['status']}" data-type="{s['slice_type']}">
                <td>{idx}</td>
                <td>{s['name']}{has_warning}{has_issue}{has_history}</td>
                <td>{s['start_time_formatted']}<br><span style="color:#888;font-size:11px;">{s['end_time_formatted']}</span></td>
                <td>{s['duration_formatted']}</td>
                <td><span class="badge {type_badge}">{s['slice_type']}</span></td>
                <td><span class="badge {status_badge}">{s['status']}</span></td>
                <td><span class="source-link" onclick="showSliceSource('{s['id']}')">{s['source_ref']}</span></td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="{s['subtitle_draft']}">{s['subtitle_draft'] or '-'}</td>
                <td>{s['history_count']}</td>
                <td><button class="btn btn-primary" onclick="showSliceDetail('{s['id']}')">详情</button></td>
            </tr>
            """
        return rows

    def _build_silence_tab(self, data: Dict[str, Any]) -> str:
        if not data["silence_issues"]:
            return '<h2 class="section-title">🔇 静音段问题</h2><p style="color: #888;">未检测到静音段问题</p>'

        html = '<h2 class="section-title">🔇 静音段问题</h2>'

        for si in data["silence_issues"]:
            resolved_class = ' resolved' if si['status'] == 'resolved' else ''
            source_badge = si['source_badge']

            html += f"""
            <div class="silence-card{resolved_class}" id="silence-{si['id']}">
                <div class="silence-header">
                    <div>
                        <strong>时间段:</strong> {si['start_time_formatted']} - {si['end_time_formatted']}
                        <strong style="margin-left: 16px;">时长:</strong> {si['duration_formatted']}
                    </div>
                    <span class="badge {source_badge['class']}">{source_badge['label']}</span>
                </div>
                <p><strong>检测方式:</strong> {si['detected_from']}</p>
                <p><strong>来源引用:</strong> {si['source_ref']}</p>
                <p><strong>备注:</strong> {si['notes']}</p>
                <div class="silence-action">
                    <p><strong>建议处理:</strong> {si['action_suggested']}</p>
                    <p><strong>联系人:</strong> <span class="silence-contact">{si['contact_person']}</span></p>
                    <p style="margin-top: 8px;">
                        <strong>状态:</strong>
                        <span class="badge {'badge-approved' if si['status'] == 'resolved' else 'badge-pending'}">{si['status']}</span>
                    </p>
                    {'<p style="margin-top:8px;"><button class="btn btn-secondary" onclick="showSourceForSilence(&#39;' + si['id'] + '&#39;)">追溯来源</button></p>' if si['source_id'] else ''}
                </div>
            </div>
            """

        return html

    def _build_sources_tab(self, data: Dict[str, Any]) -> str:
        ad_rows = ""
        for idx, ad in enumerate(data["ad_spots"], 1):
            ad_rows += f"""
            <tr id="ad-spot-{ad['id']}">
                <td>{idx}</td>
                <td>{ad['name']}</td>
                <td>{ad['start_time_formatted']} - {ad['end_time_formatted']}</td>
                <td>{round(ad['duration'], 3)}</td>
                <td>{ad['speaker']}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="{ad['content']}">{ad['content']}</td>
                <td>{ad['notes']}</td>
            </tr>
            """

        track_rows = ""
        for idx, track in enumerate(data["raw_tracks"], 1):
            silence_badge = '<span class="badge badge-unknown">静音</span>' if track['is_silence'] else ''
            track_rows += f"""
            <tr id="raw-track-{track['id']}">
                <td>{idx}</td>
                <td>{track['name']} {silence_badge}</td>
                <td>{track['start_time_formatted']} - {track['end_time_formatted']}</td>
                <td>{round(track['duration'], 3)}</td>
                <td>{track['speaker']}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="{track['transcript']}">{track['transcript'] or track['content']}</td>
                <td>{track['notes']}</td>
            </tr>
            """

        return f"""
        <h2 class="section-title">📋 广告口播表</h2>
        <table>
            <thead>
                <tr>
                    <th>序号</th>
                    <th>名称</th>
                    <th>时间段</th>
                    <th>时长(秒)</th>
                    <th>主讲人</th>
                    <th>内容</th>
                    <th>备注</th>
                </tr>
            </thead>
            <tbody>{ad_rows}</tbody>
        </table>

        <h2 class="section-title">🎧 原始音轨</h2>
        <table>
            <thead>
                <tr>
                    <th>序号</th>
                    <th>名称</th>
                    <th>时间段</th>
                    <th>时长(秒)</th>
                    <th>主讲人</th>
                    <th>字幕/内容</th>
                    <th>备注</th>
                </tr>
            </thead>
            <tbody>{track_rows}</tbody>
        </table>
        """

    def _build_timeline_tab(self, data: Dict[str, Any]) -> str:
        timeline = data["timeline"]
        max_time = timeline["max_time"]

        ad_segments = ""
        track_segments = ""
        slice_segments = ""

        for seg in timeline["segments"]:
            left_pct = (seg["start"] / max_time) * 100 if max_time > 0 else 0
            width_pct = ((seg["end"] - seg["start"]) / max_time) * 100 if max_time > 0 else 0

            status_class = ""
            if seg["type"] == "slice":
                status_class = f' {seg.get("status", "")}'

            onclick_action = 'showSliceDetail(&quot;' + seg["id"] + '&quot;)' if seg["type"] == "slice" else 'scrollToSource(&quot;' + seg["type"] + '-' + seg["id"] + '&quot;)'
            title_text = seg["label"] + '\\n' + SliceCalculator.format_time(seg["start"]) + ' - ' + SliceCalculator.format_time(seg["end"])
            display_name = seg["name"][:8] if width_pct > 5 else ""
            segment_html = '''
            <div class="timeline-segment {type}{status}"
                 style="left: {left}%; width: {width}%;"
                 title="{title}"
                 onclick="{onclick}">
                {name}
            </div>
            '''.format(
                type=seg["type"],
                status=status_class,
                left=left_pct,
                width=width_pct,
                title=title_text,
                onclick=onclick_action,
                name=display_name
            )

            if seg["type"] == "ad":
                ad_segments += segment_html
            elif seg["type"] == "track" or seg["type"] == "silence":
                track_segments += segment_html
            elif seg["type"] == "slice":
                slice_segments += segment_html

        return f"""
        <h2 class="section-title">⏱️ 时间轴视图</h2>

        <div class="timeline-container">
            <div class="timeline-row">
                <div class="timeline-label">广告口播</div>
                <div class="timeline-track">{ad_segments}</div>
            </div>
            <div class="timeline-row">
                <div class="timeline-label">原始音轨</div>
                <div class="timeline-track">{track_segments}</div>
            </div>
            <div class="timeline-row">
                <div class="timeline-label">切片结果</div>
                <div class="timeline-track">{slice_segments}</div>
            </div>
        </div>

        <div style="margin-top: 24px; display: flex; gap: 16px; flex-wrap: wrap;">
            <div><span class="badge badge-ad">■</span> 广告口播</div>
            <div><span class="badge badge-content">■</span> 音轨内容</div>
            <div><span class="badge badge-unknown">■</span> 静音段</div>
            <div><span class="badge badge-slice">■</span> 待复核切片</div>
            <div><span class="badge badge-approved">■</span> 已通过</div>
            <div><span class="badge badge-rejected">■</span> 已拒绝</div>
        </div>

        <p style="margin-top: 16px; color: #888; font-size: 12px;">
            总时长: {timeline["max_time_formatted"]} | 点击时间块可查看详情
        </p>
        """

    def _build_history_tab(self, data: Dict[str, Any]) -> str:
        if not data["history"]:
            return '<h2 class="section-title">📜 历史记录</h2><p style="color: #888;">暂无历史记录</p>'

        html = """
        <h2 class="section-title">📜 历史记录</h2>
        <div class="search-box">
            <input type="text" id="history-search" placeholder="搜索操作人、变更内容..." oninput="filterHistory()">
            <select id="history-type-filter" onchange="filterHistory()">
                <option value="">全部操作</option>
                <option value="import">导入</option>
                <option value="review">复核</option>
                <option value="correct">修正</option>
                <option value="subtitle_edit">字幕编辑</option>
            </select>
        </div>
        <div id="history-list">
        """

        for h in data["history"]:
            target_link = ""
            if h["target_link"]:
                target_link = ' <a href="' + h["target_link"] + '" class="source-link" onclick="scrollToTarget(&#39;' + h["target_link"] + '&#39;); return false;">跳转到目标</a>'

            html += f"""
            <div class="history-item" data-id="{h['id']}"
                data-search="{h['operator']} {h['diff_summary']} {h['reason']} {h['operation']}"
                data-type="{h['operation']}">
                <div class="history-header">
                    <span class="history-operator">{h['operator']}</span>
                    <span class="history-time">{h['timestamp']}</span>
                </div>
                <div class="history-diff">{h['diff_summary']}{target_link}</div>
                {f'<div class="history-reason">原因: {h["reason"]}</div>' if h['reason'] else ''}
                <div style="margin-top: 8px; font-size: 11px; color: #aaa;">
                    操作: {h['operation']} | 目标: {h['target_type']} | 字段: {h['field_name']}
                </div>
            </div>
            """

        html += "</div>"
        return html

    def _get_javascript(self) -> str:
        return """
        function switchTab(tabName) {
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.id === 'tab-' + tabName);
            });
            window.location.hash = tabName;
        }

        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                switchTab(this.dataset.tab);
            });
        });

        const hash = window.location.hash.replace('#', '');
        if (hash && document.querySelector('.nav-tab[data-tab="' + hash + '"]')) {
            switchTab(hash);
        }

        function showModal(contentHtml, title) {
            document.getElementById('modal-title').textContent = title || '详情';
            document.getElementById('modal-body').innerHTML = contentHtml;
            document.getElementById('slice-modal').classList.add('show');
            document.body.style.overflow = 'hidden';
        }

        function closeModal() {
            document.getElementById('slice-modal').classList.remove('show');
            document.body.style.overflow = '';
        }

        document.getElementById('slice-modal').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });

        function getSliceById(id) {
            return APP_DATA.slices.find(s => s.id === id);
        }

        function showSliceDetail(sliceId) {
            const s = getSliceById(sliceId);
            if (!s) return;

            const statusBadge = 'badge-' + s.status;
            const typeBadge = s.slice_type === 'ad' ? 'badge-ad' : 'badge-content';

            let warningsHtml = '';
            if (s.warnings && s.warnings.length > 0) {
                warningsHtml = '<div class="warnings-box"><h4>⚠️ 警告</h4><ul>' +
                    s.warnings.map(w => '<li>' + w + '</li>').join('') + '</ul></div>';
            }

            let issuesHtml = '';
            if (s.issues && s.issues.length > 0) {
                issuesHtml = '<div class="issues-box"><h4>❌ 问题</h4><ul>' +
                    s.issues.map(i => '<li>' + i + '</li>').join('') + '</ul></div>';
            }

            let subtitleHtml = '';
            if (s.subtitle_draft || s.subtitle_final) {
                subtitleHtml = '<div class="detail-section"><h3>📝 字幕</h3>';
                if (s.subtitle_draft !== s.subtitle_final && s.subtitle_draft && s.subtitle_final) {
                    subtitleHtml += '<div class="subtitle-diff">' +
                        '<div><div class="subtitle-label">草稿</div><div class="subtitle-content">' + (s.subtitle_draft || '-') + '</div></div>' +
                        '<div><div class="subtitle-label">最终版</div><div class="subtitle-content">' + (s.subtitle_final || '-') + '</div></div>' +
                    '</div>';
                } else {
                    if (s.subtitle_draft) {
                        subtitleHtml += '<div class="subtitle-label">字幕草稿</div><div class="subtitle-content">' + s.subtitle_draft + '</div>';
                    }
                    if (s.subtitle_final) {
                        subtitleHtml += '<div class="subtitle-label" style="margin-top:12px;">字幕最终版</div><div class="subtitle-content">' + s.subtitle_final + '</div>';
                    }
                }
                subtitleHtml += '</div>';
            }

            const traceResult = traceSliceSource(sliceId);
            let sourcesHtml = '<div class="detail-section"><h3>🔗 数据来源追溯</h3>';
            if (traceResult.sources && traceResult.sources.length > 0) {
                traceResult.sources.forEach(src => {
                    const srcBadge = src.type === 'ad_spot' ? 'badge-ad' : 'badge-track';
                    const srcName = src.type === 'ad_spot' ? '广告口播表' : '原始音轨';
                    sourcesHtml += '<div class="source-card">' +
                        '<h4><span class="badge ' + srcBadge + '">' + srcName + '</span>' +
                        (src.overlap_seconds ? ' 重叠: ' + src.overlap_seconds + '秒' : '') +
                        '</h4>' +
                        '<div class="detail-grid">' +
                        '<div class="detail-item"><label>名称</label><div class="value">' + src.data.name + '</div></div>' +
                        '<div class="detail-item"><label>时间</label><div class="value">' + src.data.start_time_formatted + ' - ' + src.data.end_time_formatted + '</div></div>' +
                        (src.data.content ? '<div class="detail-item full-width"><label>内容</label><div class="value">' + src.data.content + '</div></div>' : '') +
                        (src.data.transcript ? '<div class="detail-item full-width"><label>字幕</label><div class="value">' + src.data.transcript + '</div></div>' : '') +
                        '</div>' +
                        '<button class="btn btn-secondary" onclick="scrollToSource(\\'' + src.type + '-' + src.data.id + '\\')">在源数据表中查看</button>' +
                        '</div>';
                });
            } else {
                sourcesHtml += '<p style="color: #888;">未找到关联的源数据</p>';
            }
            sourcesHtml += '</div>';

            const historyRecords = getSliceHistory(sliceId);
            let historyHtml = '<div class="detail-section"><h3>📜 变更历史</h3>';
            if (historyRecords.length > 0) {
                historyRecords.forEach(h => {
                    historyHtml += '<div class="history-item">' +
                        '<div class="history-header">' +
                        '<span class="history-operator">' + h.operator + '</span>' +
                        '<span class="history-time">' + h.timestamp + '</span>' +
                        '</div>' +
                        '<div class="history-diff">' + h.diff_summary + '</div>' +
                        (h.reason ? '<div class="history-reason">原因: ' + h.reason + '</div>' : '') +
                        '</div>';
                });
            } else {
                historyHtml += '<p style="color: #888;">暂无变更历史</p>';
            }
            historyHtml += '</div>';

            const html = '<div class="detail-grid">' +
                '<div class="detail-item"><label>切片名称</label><div class="value">' + s.name + '</div></div>' +
                '<div class="detail-item"><label>切片ID</label><div class="value">' + s.id + '</div></div>' +
                '<div class="detail-item"><label>开始时间</label><div class="value">' + s.start_time_formatted + '</div></div>' +
                '<div class="detail-item"><label>结束时间</label><div class="value">' + s.end_time_formatted + '</div></div>' +
                '<div class="detail-item"><label>时长</label><div class="value">' + s.duration_formatted + '</div></div>' +
                '<div class="detail-item"><label>导出文件名</label><div class="value">' + s.export_filename + '</div></div>' +
                '<div class="detail-item"><label>类型</label><div class="value"><span class="badge ' + typeBadge + '">' + s.slice_type + '</span></div></div>' +
                '<div class="detail-item"><label>状态</label><div class="value"><span class="badge ' + statusBadge + '">' + s.status + '</span></div></div>' +
                '<div class="detail-item full-width"><label>内容摘要</label><div class="value">' + (s.content || '-') + '</div></div>' +
                '<div class="detail-item full-width"><label>来源引用</label><div class="value">' + s.source_ref + '</div></div>' +
                (s.notes ? '<div class="detail-item full-width"><label>备注</label><div class="value">' + s.notes + '</div></div>' : '') +
                (s.reviewed_by ? '<div class="detail-item"><label>复核人</label><div class="value">' + s.reviewed_by + '</div></div>' : '') +
                (s.reviewed_at ? '<div class="detail-item"><label>复核时间</label><div class="value">' + s.reviewed_at + '</div></div>' : '') +
                '</div>' +
                warningsHtml + issuesHtml + subtitleHtml + sourcesHtml + historyHtml;

            showModal(html, '🎵 ' + s.name);
        }

        function traceSliceSource(sliceId) {
            const s = getSliceById(sliceId);
            if (!s) return { error: '未找到切片' };

            const result = {
                slice: s,
                source_ref: s.source_ref,
                source_type: s.source_type,
                sources: []
            };

            if (s.source_type === 'ad_spot' || s.source_type === '') {
                const ad = APP_DATA.ad_spots.find(a => a.id === s.source_id);
                if (ad) {
                    result.sources.push({
                        type: 'ad_spot',
                        name: '广告口播表',
                        data: ad,
                        link: '#ad-spot-' + ad.id
                    });
                }
            }

            if (s.source_type === 'raw_track' || s.source_ref.indexOf('原始音轨') >= 0) {
                const track = APP_DATA.raw_tracks.find(t => t.id === s.source_id);
                if (track) {
                    result.sources.push({
                        type: 'raw_track',
                        name: '原始音轨',
                        data: track,
                        link: '#raw-track-' + track.id
                    });
                }
            }

            if (s.source_ref.indexOf('双源匹配') >= 0) {
                APP_DATA.ad_spots.forEach(ad => {
                    const overlap = timeOverlap(
                        ad.start_time, ad.end_time,
                        s.start_time, s.end_time
                    );
                    if (overlap > 0.1) {
                        result.sources.push({
                            type: 'ad_spot',
                            name: '广告口播表',
                            data: ad,
                            overlap_seconds: overlap.toFixed(3),
                            link: '#ad-spot-' + ad.id
                        });
                    }
                });
                APP_DATA.raw_tracks.forEach(track => {
                    const overlap = timeOverlap(
                        track.start_time, track.end_time,
                        s.start_time, s.end_time
                    );
                    if (overlap > 0.1) {
                        result.sources.push({
                            type: 'raw_track',
                            name: '原始音轨',
                            data: track,
                            overlap_seconds: overlap.toFixed(3),
                            link: '#raw-track-' + track.id
                        });
                    }
                });
            }

            return result;
        }

        function timeOverlap(a_start, a_end, b_start, b_end) {
            const os = Math.max(a_start, b_start);
            const oe = Math.min(a_end, b_end);
            return Math.max(0, oe - os);
        }

        function getSliceHistory(sliceId) {
            return APP_DATA.history.filter(h =>
                h.target_type === 'slice' && h.target_id === sliceId
            );
        }

        function showSliceSource(sliceId) {
            showSliceDetail(sliceId);
        }

        function scrollToSource(sourceId) {
            closeModal();
            switchTab('sources');
            setTimeout(() => {
                const el = document.getElementById(sourceId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.style.background = '#fff9c4';
                    setTimeout(() => { el.style.background = ''; }, 2000);
                }
            }, 100);
        }

        function scrollToTarget(hash) {
            const id = hash.replace('#', '');
            if (id.indexOf('slice-') === 0) {
                showSliceDetail(id.replace('slice-', ''));
                return;
            }
            if (id.indexOf('ad-spot-') === 0 || id.indexOf('raw-track-') === 0) {
                scrollToSource(id);
            }
        }

        function showSourceForSilence(issueId) {
            const issue = APP_DATA.silence_issues.find(si => si.id === issueId);
            if (!issue) return;

            let html = '<div class="detail-section"><h3>🔍 静音段来源追溯</h3>';
            html += '<p><strong>时间段:</strong> ' + issue.start_time_formatted + ' - ' + issue.end_time_formatted + '</p>';
            html += '<p><strong>时长:</strong> ' + issue.duration_formatted + '</p>';
            html += '<p><strong>来源:</strong> <span class="badge ' + issue.source_badge.class + '">' + issue.source_badge.label + '</span> ' + issue.source_ref + '</p>';

            if (issue.source_type === 'ad_spot') {
                const ad = APP_DATA.ad_spots.find(a => a.id === issue.source_id);
                if (ad) {
                    html += '<div class="source-card"><h4>📋 广告口播表详情</h4>' +
                        '<div class="detail-grid">' +
                        '<div class="detail-item"><label>名称</label><div class="value">' + ad.name + '</div></div>' +
                        '<div class="detail-item"><label>时间</label><div class="value">' + ad.start_time_formatted + ' - ' + ad.end_time_formatted + '</div></div>' +
                        '<div class="detail-item full-width"><label>内容</label><div class="value">' + ad.content + '</div></div>' +
                        '</div>' +
                        '<button class="btn btn-secondary" onclick="scrollToSource(\\'ad-spot-' + ad.id + '\\')">在源数据表中查看</button>' +
                        '</div>';
                }
            } else if (issue.source_type === 'raw_track') {
                const track = APP_DATA.raw_tracks.find(t => t.id === issue.source_id);
                if (track) {
                    html += '<div class="source-card"><h4>🎧 原始音轨详情</h4>' +
                        '<div class="detail-grid">' +
                        '<div class="detail-item"><label>名称</label><div class="value">' + track.name + '</div></div>' +
                        '<div class="detail-item"><label>时间</label><div class="value">' + track.start_time_formatted + ' - ' + track.end_time_formatted + '</div></div>' +
                        '<div class="detail-item full-width"><label>内容/字幕</label><div class="value">' + (track.transcript || track.content || '-') + '</div></div>' +
                        '</div>' +
                        '<button class="btn btn-secondary" onclick="scrollToSource(\\'raw-track-' + track.id + '\\')">在源数据表中查看</button>' +
                        '</div>';
                }
            }

            html += '<div class="silence-action" style="margin-top: 16px;">' +
                '<p><strong>建议处理:</strong> ' + issue.action_suggested + '</p>' +
                '<p><strong>联系人:</strong> <span class="silence-contact">' + issue.contact_person + '</span></p>' +
                '</div>';

            html += '</div>';
            showModal(html, '🔇 静音段来源追溯');
        }

        function filterSlices() {
            const search = document.getElementById('slice-search').value.toLowerCase();
            const statusFilter = document.getElementById('slice-status-filter').value;
            const typeFilter = document.getElementById('slice-type-filter').value;

            document.querySelectorAll('#slices-table-body tr').forEach(row => {
                const matchesSearch = row.dataset.name.toLowerCase().indexOf(search) >= 0;
                const matchesStatus = !statusFilter || row.dataset.status === statusFilter;
                const matchesType = !typeFilter || row.dataset.type === typeFilter;

                row.style.display = (matchesSearch && matchesStatus && matchesType) ? '' : 'none';
            });
        }

        function filterHistory() {
            const search = document.getElementById('history-search').value.toLowerCase();
            const typeFilter = document.getElementById('history-type-filter').value;

            document.querySelectorAll('#history-list .history-item').forEach(item => {
                const matchesSearch = item.dataset.search.toLowerCase().indexOf(search) >= 0;
                const matchesType = !typeFilter || item.dataset.type === typeFilter;

                item.style.display = (matchesSearch && matchesType) ? '' : 'none';
            });
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeModal();
        });
        """
