from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from datetime import datetime
from bike_dispatch import (
    create_case, import_grid_inspection, supplement_ramp,
    import_construction_notice, review_ramp, generate_report,
    get_ramp_by_id, set_display_mode,
    GridInspection, ConstructionNotice, ReviewStatus,
    RectificationSuggestion, Evidence, EvidenceSource, ResponsibleRole, DispatchCase
)
import os
import json

app = FastAPI(title="共享单车潮汐调度 API")

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)


def _get_case_path(case_id: str) -> str:
    return os.path.join(DATA_DIR, f"case_{case_id}.json")


def _save_case(case: DispatchCase):
    data = {
        "id": case.id,
        "title": case.title,
        "created_at": case.created_at.isoformat(),
        "display_mode": case.display_mode,
        "status": case.status,
        "grid_inspections": [
            {
                "id": i.id,
                "inspector_name": i.inspector_name,
                "inspection_date": i.inspection_date.isoformat(),
                "location": i.location,
                "bike_overflow": i.bike_overflow,
                "blocked_access": i.blocked_access,
                "damaged_facilities": i.damaged_facilities,
                "notes": i.notes,
                "score": i.score
            } for i in case.grid_inspections
        ],
        "construction_notices": [
            {
                "id": n.id,
                "title": n.title,
                "location": n.location,
                "start_date": n.start_date.isoformat(),
                "end_date": n.end_date.isoformat(),
                "impact_description": n.impact_description,
                "site_statement": n.site_statement,
                "reviewed_by_secretary": n.reviewed_by_secretary
            } for n in case.construction_notices
        ],
        "ramps": [
            {
                "id": r.id,
                "location": r.location,
                "is_accessible": r.is_accessible,
                "has_bike_parking": r.has_bike_parking,
                "issues": r.issues,
                "score_before": r.score_before,
                "score_after": r.score_after,
                "score_changed": r.score_changed,
                "supplementary_note": r.supplementary_note,
                "review_status": r.review_status.value
            } for r in case.ramps
        ],
        "suggestions": [
            {
                "id": s.id,
                "ramp_id": s.ramp_id,
                "issue_description": s.issue_description,
                "why_kept": s.why_kept,
                "missing_materials": s.missing_materials,
                "next_step": s.next_step,
                "responsible_role": s.responsible_role.value,
                "priority": s.priority,
                "updated_at": s.updated_at.isoformat()
            } for s in case.suggestions
        ],
        "evidences": [
            {
                "source": e.source.value,
                "description": e.description,
                "recorded_at": e.recorded_at.isoformat(),
                "recorded_by": e.recorded_by
            } for e in case.evidences
        ]
    }
    with open(_get_case_path(case.id), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _load_case(case_id: str) -> DispatchCase:
    path = _get_case_path(case_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"案件不存在: {case_id}")
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    case = DispatchCase(
        id=data["id"],
        title=data["title"],
        created_at=datetime.fromisoformat(data["created_at"]),
        display_mode=data.get("display_mode", "list"),
        status=data.get("status", "active")
    )
    
    for i in data.get("grid_inspections", []):
        case.grid_inspections.append(GridInspection(
            id=i["id"],
            inspector_name=i["inspector_name"],
            inspection_date=datetime.fromisoformat(i["inspection_date"]),
            location=i["location"],
            bike_overflow=i["bike_overflow"],
            blocked_access=i["blocked_access"],
            damaged_facilities=i["damaged_facilities"],
            notes=i["notes"],
            score=i["score"]
        ))
    
    for n in data.get("construction_notices", []):
        case.construction_notices.append(ConstructionNotice(
            id=n["id"],
            title=n["title"],
            location=n["location"],
            start_date=datetime.fromisoformat(n["start_date"]),
            end_date=datetime.fromisoformat(n["end_date"]),
            impact_description=n["impact_description"],
            site_statement=n["site_statement"],
            reviewed_by_secretary=n["reviewed_by_secretary"]
        ))
    
    for r in data.get("ramps", []):
        case.ramps.append(Ramp(
            id=r["id"],
            location=r["location"],
            is_accessible=r["is_accessible"],
            has_bike_parking=r["has_bike_parking"],
            issues=r["issues"],
            score_before=r["score_before"],
            score_after=r["score_after"],
            score_changed=r["score_changed"],
            supplementary_note=r["supplementary_note"],
            review_status=ReviewStatus(r["review_status"])
        ))
    
    for s in data.get("suggestions", []):
        case.suggestions.append(RectificationSuggestion(
            id=s["id"],
            ramp_id=s["ramp_id"],
            issue_description=s["issue_description"],
            why_kept=s["why_kept"],
            missing_materials=s["missing_materials"],
            next_step=s["next_step"],
            responsible_role=ResponsibleRole(s["responsible_role"]),
            priority=s["priority"],
            updated_at=datetime.fromisoformat(s["updated_at"])
        ))
    
    for e in data.get("evidences", []):
        case.evidences.append(Evidence(
            source=EvidenceSource(e["source"]),
            description=e["description"],
            recorded_at=datetime.fromisoformat(e["recorded_at"]),
            recorded_by=e["recorded_by"]
        ))
    
    return case


@app.get("/")
async def root():
    return {"message": "共享单车潮汐调度 API", "version": "1.0.0"}


@app.post("/cases")
async def create_new_case(title: str):
    case = create_case(title)
    _save_case(case)
    return {"case_id": case.id, "title": case.title, "created_at": case.created_at}


@app.get("/cases/{case_id}")
async def get_case(case_id: str):
    case = _load_case(case_id)
    return {
        "id": case.id,
        "title": case.title,
        "created_at": case.created_at,
        "display_mode": case.display_mode,
        "ramps_count": len(case.ramps),
        "inspections_count": len(case.grid_inspections),
        "notices_count": len(case.construction_notices),
        "suggestions_count": len(case.suggestions)
    }


@app.post("/cases/{case_id}/inspections")
async def add_inspection(case_id: str, inspection: dict):
    case = _load_case(case_id)
    insp = GridInspection(
        id="",
        inspector_name=inspection.get("inspector_name", "未知"),
        inspection_date=datetime.now(),
        location=inspection.get("location", "未知"),
        bike_overflow=inspection.get("bike_overflow", False),
        blocked_access=inspection.get("blocked_access", False),
        damaged_facilities=inspection.get("damaged_facilities", False),
        notes=inspection.get("notes", "")
    )
    case = import_grid_inspection(case, insp)
    _save_case(case)
    return {"message": "巡查表已导入", "score": insp.score, "ramps_count": len(case.ramps)}


@app.post("/cases/{case_id}/ramps/{ramp_id}/supplement")
async def supplement_ramp_endpoint(case_id: str, ramp_id: str, data: dict):
    case = _load_case(case_id)
    ramp = supplement_ramp(
        case, ramp_id,
        note=data.get("note", ""),
        is_accessible=data.get("is_accessible"),
        has_bike_parking=data.get("has_bike_parking")
    )
    if not ramp:
        raise HTTPException(status_code=404, detail="坡道不存在")
    _save_case(case)
    return {
        "ramp_id": ramp.id,
        "score_before": ramp.score_before,
        "score_after": ramp.score_after,
        "score_changed": ramp.score_changed,
        "review_status": ramp.review_status.value
    }


@app.post("/cases/{case_id}/notices")
async def add_construction_notice(case_id: str, notice: dict):
    case = _load_case(case_id)
    n = ConstructionNotice(
        id="",
        title=notice.get("title", "施工告示"),
        location=notice.get("location", "未知"),
        start_date=datetime.now(),
        end_date=datetime.now(),
        impact_description=notice.get("impact_description", ""),
        site_statement=notice.get("site_statement", "")
    )
    case = import_construction_notice(case, n, reviewed_by_secretary=notice.get("reviewed_by_secretary", False))
    _save_case(case)
    return {"message": "施工告示已导入", "notice_id": n.id}


@app.post("/cases/{case_id}/ramps/{ramp_id}/review")
async def review_ramp_endpoint(case_id: str, ramp_id: str, data: dict):
    case = _load_case(case_id)
    status = ReviewStatus(data.get("status", "pending"))
    ramp = review_ramp(case, ramp_id, status)
    if not ramp:
        raise HTTPException(status_code=404, detail="坡道不存在")
    _save_case(case)
    return {"ramp_id": ramp.id, "review_status": ramp.review_status.value}


@app.get("/cases/{case_id}/report")
async def get_report(case_id: str, format: str = "json"):
    case = _load_case(case_id)
    if format == "text":
        report = generate_report(case, output_format="text")
        return HTMLResponse(content=f"<pre>{report}</pre>")
    elif format == "html":
        report = generate_report(case, output_format="html")
        return HTMLResponse(content=report)
    else:
        return {
            "case_id": case.id,
            "title": case.title,
            "ramps": [
                {
                    "id": r.id,
                    "location": r.location,
                    "score_before": r.score_before,
                    "score_after": r.score_after,
                    "score_changed": r.score_changed,
                    "review_status": r.review_status.value,
                    "issues": r.issues
                } for r in case.ramps
            ],
            "suggestions": [
                {
                    "id": s.id,
                    "ramp_id": s.ramp_id,
                    "issue_description": s.issue_description,
                    "why_kept": s.why_kept,
                    "missing_materials": s.missing_materials,
                    "next_step": s.next_step,
                    "responsible_role": s.responsible_role.value
                } for s in case.suggestions
            ],
            "evidences": [
                {
                    "source": e.source.value,
                    "description": e.description,
                    "recorded_by": e.recorded_by
                } for e in case.evidences
            ]
        }


@app.get("/cases/{case_id}/ramps")
async def list_ramps(case_id: str):
    case = _load_case(case_id)
    return {
        "ramps": [
            {
                "id": r.id,
                "location": r.location,
                "score_before": r.score_before,
                "score_after": r.score_after,
                "score_changed": r.score_changed,
                "review_status": r.review_status.value,
                "issues": r.issues,
                "supplementary_note": r.supplementary_note
            } for r in case.ramps
        ]
    }


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>共享单车潮汐调度 - 小看板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { color: white; text-align: center; padding: 30px 0; }
        .header h1 { font-size: 32px; margin-bottom: 8px; }
        .header p { opacity: 0.9; }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .card h3 { color: #2c3e50; margin-bottom: 16px; font-size: 18px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; color: #555; margin-bottom: 6px; font-size: 14px; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
        .form-group textarea { resize: vertical; min-height: 60px; }
        .checkbox-group { display: flex; gap: 16px; margin-top: 8px; }
        .checkbox-item { display: flex; align-items: center; gap: 6px; }
        .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; width: 100%; }
        .btn:hover { opacity: 0.9; }
        .btn-secondary { background: #f0f0f0; color: #333; }
        .result { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-top: 16px; font-size: 14px; }
        .result-success { border-left: 4px solid #27ae60; }
        .result-error { border-left: 4px solid #e74c3c; }
        .ramp-item { background: #f8f9fa; border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; }
        .ramp-item:hover { background: #eef2ff; }
        .ramp-item.escalated { border-left: 4px solid #e74c3c; }
        .ramp-item.confirmed { border-left: 4px solid #27ae60; }
        .ramp-location { font-weight: 600; color: #2c3e50; }
        .ramp-meta { font-size: 12px; color: #888; margin-top: 4px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
        .badge-red { background: #ffe0e0; color: #c0392b; }
        .badge-green { background: #e0f5e0; color: #27ae60; }
        .badge-yellow { background: #fff3cd; color: #856404; }
        .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
        .tab { padding: 10px 20px; background: rgba(255,255,255,0.2); color: white; border-radius: 8px; cursor: pointer; font-size: 14px; }
        .tab.active { background: white; color: #667eea; font-weight: 500; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .suggestion-item { background: #f0f4ff; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
        .suggestion-issue { font-weight: 600; color: #2c3e50; margin-bottom: 8px; }
        .suggestion-why { color: #667eea; font-size: 13px; margin-bottom: 8px; }
        .suggestion-next { color: #555; font-size: 13px; }
        .display-mode-selector { display: flex; gap: 8px; margin-bottom: 16px; }
        .display-btn { padding: 8px 16px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; font-size: 13px; }
        .display-btn.active { background: #667eea; color: white; border-color: #667eea; }
        .chart-placeholder { background: #f8f9fa; border-radius: 8px; padding: 40px; text-align: center; color: #888; }
        .back-link { color: #667eea; text-decoration: underline; cursor: pointer; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚲 共享单车潮汐调度</h1>
            <p>整合网格员巡查 + 施工告示，让每一条整改建议都有温度</p>
        </div>

        <div class="tabs">
            <div class="tab active" onclick="switchTab('create')">新建案件</div>
            <div class="tab" onclick="switchTab('inspection')">导入巡查表</div>
            <div class="tab" onclick="switchTab('supplement')">坡道补录</div>
            <div class="tab" onclick="switchTab('notice')">施工告示</div>
            <div class="tab" onclick="switchTab('view')">查看报告</div>
        </div>

        <div id="tab-create" class="tab-content active">
            <div class="card">
                <h3>📋 创建新案件</h3>
                <div class="form-group">
                    <label>案件标题</label>
                    <input type="text" id="caseTitle" placeholder="例如：XX社区早高峰共享单车调度">
                </div>
                <button class="btn" onclick="createCase()">创建案件</button>
                <div id="createResult"></div>
            </div>
        </div>

        <div id="tab-inspection" class="tab-content">
            <div class="card">
                <h3>🔍 导入网格员巡查表</h3>
                <div class="form-group">
                    <label>案件ID</label>
                    <input type="text" id="inspectCaseId" placeholder="输入案件ID">
                </div>
                <div class="form-group">
                    <label>网格员姓名</label>
                    <input type="text" id="inspectorName" placeholder="例如：小李">
                </div>
                <div class="form-group">
                    <label>巡查地点</label>
                    <input type="text" id="inspectLocation" placeholder="例如：东门社区入口坡道">
                </div>
                <div class="form-group">
                    <label>发现问题</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="bikeOverflow">
                            <label for="bikeOverflow">共享单车堆积</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="blockedAccess">
                            <label for="blockedAccess">通道被阻挡</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="damagedFacilities">
                            <label for="damagedFacilities">设施损坏</label>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>巡查备注</label>
                    <textarea id="inspectNotes" placeholder="详细描述现场情况..."></textarea>
                </div>
                <button class="btn" onclick="importInspection()">导入巡查表</button>
                <div id="inspectResult"></div>
            </div>
        </div>

        <div id="tab-supplement" class="tab-content">
            <div class="card">
                <h3>🛤️ 坡道补录</h3>
                <div class="display-mode-selector">
                    <button class="display-btn active" onclick="setDisplayMode('list')">列表模式</button>
                    <button class="display-btn" onclick="setDisplayMode('chart')">图表模式</button>
                    <button class="display-btn" onclick="setDisplayMode('3d')">3D模式</button>
                </div>
                <div class="form-group">
                    <label>案件ID</label>
                    <input type="text" id="supplementCaseId" placeholder="输入案件ID" oninput="loadRamps()">
                </div>
                <div id="rampList"></div>
                <div id="supplementForm" style="display: none; margin-top: 20px;">
                    <div class="form-group">
                        <label>选中坡道</label>
                        <div id="selectedRampInfo" style="padding: 10px; background: #f8f9fa; border-radius: 6px;"></div>
                        <div class="back-link" onclick="backToRampList()">← 返回坡道列表（不只是漂亮画面）</div>
                    </div>
                    <div class="form-group">
                        <label>补录备注</label>
                        <textarea id="supplementNote" placeholder="现场复核情况说明..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>坡道状态</label>
                        <div class="checkbox-group">
                            <div class="checkbox-item">
                                <input type="checkbox" id="isAccessible">
                                <label for="isAccessible">无障碍通行</label>
                            </div>
                            <div class="checkbox-item">
                                <input type="checkbox" id="hasBikeParking">
                                <label for="hasBikeParking">有专门停放区</label>
                            </div>
                        </div>
                    </div>
                    <button class="btn" onclick="submitSupplement()">提交补录</button>
                    <div id="supplementResult"></div>
                </div>
            </div>
        </div>

        <div id="tab-notice" class="tab-content">
            <div class="card">
                <h3>🏗️ 导入施工告示</h3>
                <div class="form-group">
                    <label>案件ID</label>
                    <input type="text" id="noticeCaseId" placeholder="输入案件ID">
                </div>
                <div class="form-group">
                    <label>告示标题</label>
                    <input type="text" id="noticeTitle" placeholder="例如：东门管道施工">
                </div>
                <div class="form-group">
                    <label>施工地点</label>
                    <input type="text" id="noticeLocation" placeholder="例如：东门社区入口">
                </div>
                <div class="form-group">
                    <label>现场说法</label>
                    <textarea id="siteStatement" placeholder="施工方的现场说明..."></textarea>
                </div>
                <div class="form-group">
                    <label>影响描述</label>
                    <textarea id="impactDesc" placeholder="对共享单车停放的影响..."></textarea>
                </div>
                <div class="checkbox-group">
                    <div class="checkbox-item">
                        <input type="checkbox" id="reviewedBySecretary">
                        <label for="reviewedBySecretary">社区书记周姐已审阅</label>
                    </div>
                </div>
                <button class="btn" onclick="importNotice()" style="margin-top: 16px;">导入施工告示</button>
                <div id="noticeResult"></div>
            </div>
        </div>

        <div id="tab-view" class="tab-content">
            <div class="card">
                <h3>📊 查看调度报告</h3>
                <div class="form-group">
                    <label>案件ID</label>
                    <input type="text" id="viewCaseId" placeholder="输入案件ID">
                </div>
                <button class="btn" onclick="loadReport()">加载报告</button>
                <div id="reportContent"></div>
            </div>
        </div>
    </div>

    <script>
        let currentCaseId = '';
        let selectedRampId = '';
        let currentDisplayMode = 'list';

        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('tab-' + tabName).classList.add('active');
        }

        async function createCase() {
            const title = document.getElementById('caseTitle').value;
            if (!title) { alert('请输入案件标题'); return; }
            const res = await fetch(`/cases?title=${encodeURIComponent(title)}`, { method: 'POST' });
            const data = await res.json();
            currentCaseId = data.case_id;
            document.getElementById('createResult').innerHTML = 
                `<div class="result result-success">✅ 案件创建成功！案件ID：<strong>${data.case_id}</strong></div>`;
        }

        async function importInspection() {
            const caseId = document.getElementById('inspectCaseId').value || currentCaseId;
            if (!caseId) { alert('请输入案件ID'); return; }
            const data = {
                inspector_name: document.getElementById('inspectorName').value,
                location: document.getElementById('inspectLocation').value,
                bike_overflow: document.getElementById('bikeOverflow').checked,
                blocked_access: document.getElementById('blockedAccess').checked,
                damaged_facilities: document.getElementById('damagedFacilities').checked,
                notes: document.getElementById('inspectNotes').value
            };
            const res = await fetch(`/cases/${caseId}/inspections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            document.getElementById('inspectResult').innerHTML = 
                `<div class="result result-success">✅ 巡查表已导入！评分：${result.score}，生成坡道：${result.ramps_count}处</div>`;
        }

        async function loadRamps() {
            const caseId = document.getElementById('supplementCaseId').value;
            if (!caseId) return;
            currentCaseId = caseId;
            const res = await fetch(`/cases/${caseId}/ramps`);
            const data = await res.json();
            let html = '<div style="margin-bottom: 12px; font-size: 14px; color: #555;">点击坡道进行补录：</div>';
            if (currentDisplayMode === 'chart' || currentDisplayMode === '3d') {
                html += '<div class="chart-placeholder">';
                if (currentDisplayMode === 'chart') {
                    html += '📊 图表展示模式<br><span style="font-size: 12px;">（点击下方坡道可返回详情）</span>';
                } else {
                    html += '🧊 3D展示模式<br><span style="font-size: 12px;">（点击下方坡道可返回详情）</span>';
                }
                html += '</div>';
            }
            for (const ramp of data.ramps) {
                const statusClass = ramp.review_status === '转交通协管' ? 'escalated' : 
                                   ramp.review_status === '已确认' ? 'confirmed' : '';
                const badgeClass = ramp.review_status === '转交通协管' ? 'badge-red' :
                                  ramp.review_status === '已确认' ? 'badge-green' : 'badge-yellow';
                const changedBadge = ramp.score_changed ? 
                    '<span class="badge badge-green">评分有变</span>' : 
                    '<span class="badge badge-red">评分未变</span>';
                html += `
                    <div class="ramp-item ${statusClass}" onclick="selectRamp('${ramp.id}', '${ramp.location}', '${ramp.review_status}')">
                        <div class="ramp-location">📍 ${ramp.location}</div>
                        <div class="ramp-meta">
                            <span class="badge ${badgeClass}">${ramp.review_status}</span>
                            ${changedBadge}
                            评分：${ramp.score_before.toFixed(1)} → ${ramp.score_after.toFixed(1)}
                        </div>
                    </div>
                `;
            }
            document.getElementById('rampList').innerHTML = html;
        }

        function setDisplayMode(mode) {
            currentDisplayMode = mode;
            document.querySelectorAll('.display-btn').forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');
            loadRamps();
        }

        function selectRamp(rampId, location, status) {
            selectedRampId = rampId;
            document.getElementById('selectedRampInfo').innerHTML = 
                `<strong>${location}</strong> - 当前状态：${status}`;
            document.getElementById('rampList').style.display = 'none';
            document.getElementById('supplementForm').style.display = 'block';
        }

        function backToRampList() {
            document.getElementById('rampList').style.display = 'block';
            document.getElementById('supplementForm').style.display = 'none';
            selectedRampId = '';
        }

        async function submitSupplement() {
            if (!currentCaseId || !selectedRampId) { alert('请先选择坡道'); return; }
            const data = {
                note: document.getElementById('supplementNote').value,
                is_accessible: document.getElementById('isAccessible').checked,
                has_bike_parking: document.getElementById('hasBikeParking').checked
            };
            const res = await fetch(`/cases/${currentCaseId}/ramps/${selectedRampId}/supplement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            let msg = `✅ 补录完成！评分：${result.score_before.toFixed(1)} → ${result.score_after.toFixed(1)}`;
            if (!result.score_changed) {
                msg += '<br>⚠️ <strong>评分无变化，已转交通协管复核</strong>';
            }
            document.getElementById('supplementResult').innerHTML = `<div class="result result-success">${msg}</div>`;
            setTimeout(() => { backToRampList(); loadRamps(); }, 2000);
        }

        async function importNotice() {
            const caseId = document.getElementById('noticeCaseId').value || currentCaseId;
            if (!caseId) { alert('请输入案件ID'); return; }
            const data = {
                title: document.getElementById('noticeTitle').value,
                location: document.getElementById('noticeLocation').value,
                site_statement: document.getElementById('siteStatement').value,
                impact_description: document.getElementById('impactDesc').value,
                reviewed_by_secretary: document.getElementById('reviewedBySecretary').checked
            };
            const res = await fetch(`/cases/${caseId}/notices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            document.getElementById('noticeResult').innerHTML = 
                `<div class="result result-success">✅ 施工告示已导入！整改建议已同步更新</div>`;
        }

        async function loadReport() {
            const caseId = document.getElementById('viewCaseId').value || currentCaseId;
            if (!caseId) { alert('请输入案件ID'); return; }
            const res = await fetch(`/cases/${caseId}/report?format=json`);
            const data = await res.json();
            let html = '<div style="margin-top: 20px;">';
            html += `<h4 style="margin-bottom: 16px;">案件：${data.title}</h4>`;
            html += '<h5 style="margin: 16px 0 8px 0;">🛤️ 坡道情况</h5>';
            for (const ramp of data.ramps) {
                const statusBadge = ramp.review_status === '转交通协管' ? 
                    '<span class="badge badge-red">需交通协管复核</span>' :
                    ramp.review_status === '已确认' ? 
                    '<span class="badge badge-green">已确认</span>' :
                    '<span class="badge badge-yellow">待处理</span>';
                html += `
                    <div class="ramp-item ${ramp.review_status === '转交通协管' ? 'escalated' : ''}">
                        <div class="ramp-location">${ramp.location}</div>
                        <div class="ramp-meta">
                            ${statusBadge}
                            评分：${ramp.score_before.toFixed(1)} → ${ramp.score_after.toFixed(1)}
                            ${ramp.score_changed ? '' : '❌ 评分未变'}
                        </div>
                    </div>
                `;
            }
            html += '<h5 style="margin: 20px 0 8px 0;">💡 整改建议</h5>';
            for (const s of data.suggestions) {
                html += `
                    <div class="suggestion-item">
                        <div class="suggestion-issue">${s.issue_description}</div>
                        <div class="suggestion-why">💭 为什么留下：${s.why_kept}</div>
                        <div class="suggestion-next">👥 责任人：${s.responsible_role} | ${s.next_step}</div>
                    </div>
                `;
            }
            html += '<div style="margin-top: 20px;"><a href="/cases/' + caseId + '/report?format=html" target="_blank" class="btn" style="text-decoration: none; display: inline-block; width: auto;">查看完整HTML报告</a></div>';
            html += '</div>';
            document.getElementById('reportContent').innerHTML = html;
        }
    </script>
</body>
</html>
"""
    return HTMLResponse(content=html)
