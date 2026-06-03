from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Form
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import os
import tempfile

from .database import get_db, init_db
from .workflow import (
    import_settlement_batch,
    add_holiday_note,
    update_supplementary_record,
    review_by_finance,
)
from .report import generate_html_report, generate_supplementary_csv, get_records_for_report
from .models import (
    SettlementRecord, SupplementaryRecord, SettlementBatch,
    RecordStatus, NextOwner
)

app = FastAPI(title="信用卡分期提前结清核对 API")


class HolidayNoteRequest(BaseModel):
    record_id: int
    note: str
    reviewed_by: str = "fund_accounting_lin"


class SupplementaryUpdateRequest(BaseModel):
    record_id: int
    reason_kept: Optional[str] = None
    missing_materials: Optional[str] = None
    next_owner: Optional[str] = None
    updated_by: str = "system"


class ReviewRequest(BaseModel):
    record_id: int
    approved: bool
    comment: str
    reviewed_by: str = "financial_reviewer"


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
async def root():
    return {
        "name": "信用卡分期提前结清核对系统",
        "version": "1.0.0",
        "endpoints": {
            "GET /api/records": "获取记录列表",
            "GET /api/records/{id}": "获取单条记录详情",
            "POST /api/import": "导入清算批次CSV",
            "POST /api/holiday-note": "补录节假日顺延说明",
            "PUT /api/supplementary": "更新补录记录",
            "POST /api/review": "财务复核",
            "GET /api/report": "生成HTML报告",
            "GET /api/supplementary.csv": "导出补录记录CSV",
            "GET /dashboard": "小看板界面",
        }
    }


@app.get("/api/records")
async def get_records(
    batch_no: Optional[str] = None,
    status: Optional[str] = None,
    inconsistent_only: bool = False,
    db: Session = Depends(get_db),
):
    records = get_records_for_report(db, batch_no)

    if status:
        records = [r for r in records if r["status"] == status]
    if inconsistent_only:
        records = [r for r in records if not r["org_name_consistent"]]

    return {
        "total": len(records),
        "data": records,
    }


@app.get("/api/records/{record_id}")
async def get_record_detail(record_id: int, db: Session = Depends(get_db)):
    record = db.query(SettlementRecord).filter(SettlementRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    supplementary = record.supplementary
    holiday_note = record.holiday_note
    batch = record.batch

    return {
        "record_id": record.id,
        "serial_no": record.serial_no,
        "batch_no": batch.batch_no if batch else "",
        "batch_import_date": batch.import_date.strftime("%Y-%m-%d %H:%M:%S") if batch and batch.import_date else "",
        "org_name": record.org_name,
        "org_name_expected": record.org_name_expected,
        "org_name_std": record.org_name_std,
        "org_name_consistent": record.org_name_consistent,
        "card_no": record.card_no,
        "amount": record.amount,
        "settlement_date": record.settlement_date,
        "original_org_name": record.original_org_name,
        "status": record.status,
        "holiday_note": holiday_note.note if holiday_note else "",
        "holiday_note_reviewed_by": holiday_note.reviewed_by if holiday_note else "",
        "holiday_note_reviewed_at": holiday_note.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if holiday_note and holiday_note.reviewed_at else "",
        "supplementary": {
            "reason_kept": supplementary.reason_kept if supplementary else "",
            "missing_materials": supplementary.missing_materials if supplementary else "",
            "next_owner": supplementary.next_owner if supplementary else "",
            "source_batch_no": supplementary.source_batch_no if supplementary else "",
            "trace_info": supplementary.trace_info if supplementary else "",
            "updated_by": supplementary.updated_by if supplementary else "",
            "updated_at": supplementary.updated_at.strftime("%Y-%m-%d %H:%M:%S") if supplementary and supplementary.updated_at else "",
        }
    }


@app.post("/api/import")
async def import_batch_api(
    file: UploadFile = File(...),
    batch_no: str = Form(...),
    imported_by: str = Form("system"),
    remark: str = Form(""),
    db: Session = Depends(get_db),
):
    try:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".csv", delete=False) as f:
            f.write(contents)
            temp_path = f.name

        result = import_settlement_batch(db, temp_path, batch_no, imported_by, remark)
        os.unlink(temp_path)

        return {
            "success": True,
            "batch_no": result["batch_no"],
            "total_records": result["total_records"],
            "inconsistent_count": result["inconsistent_count"],
            "issues": result["issues"],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/holiday-note")
async def add_holiday_note_api(
    request: HolidayNoteRequest,
    db: Session = Depends(get_db),
):
    try:
        result = add_holiday_note(db, request.record_id, request.note, request.reviewed_by)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/supplementary")
async def update_supplementary_api(
    request: SupplementaryUpdateRequest,
    db: Session = Depends(get_db),
):
    try:
        result = update_supplementary_record(
            db, request.record_id,
            reason_kept=request.reason_kept,
            missing_materials=request.missing_materials,
            next_owner=request.next_owner,
            updated_by=request.updated_by,
        )
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/review")
async def review_api(
    request: ReviewRequest,
    db: Session = Depends(get_db),
):
    try:
        result = review_by_finance(
            db, request.record_id,
            approved=request.approved,
            comment=request.comment,
            reviewed_by=request.reviewed_by,
        )
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/report")
async def get_report(
    batch_no: Optional[str] = None,
    view_type: str = "table",
    db: Session = Depends(get_db),
):
    import tempfile
    tmp_dir = tempfile.mkdtemp()
    output_path = os.path.join(tmp_dir, "report.html")
    path = generate_html_report(db, output_path, batch_no, view_type)
    return FileResponse(path, media_type="text/html")


@app.get("/api/supplementary.csv")
async def get_supplementary_csv(
    batch_no: Optional[str] = None,
    db: Session = Depends(get_db),
):
    import tempfile
    tmp_dir = tempfile.mkdtemp()
    output_path = os.path.join(tmp_dir, "supplementary.csv")
    path = generate_supplementary_csv(db, output_path, batch_no)
    return FileResponse(
        path,
        media_type="text/csv",
        filename=f"supplementary_{batch_no or 'all'}.csv"
    )


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>信用卡分期提前结清 - 小看板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f5f7fa; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 30px; }
        .header h1 { font-size: 22px; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .actions { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .btn { padding: 10px 18px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
        .btn-primary { background: #667eea; color: white; }
        .btn-primary:hover { background: #5568d3; }
        .btn-success { background: #27ae60; color: white; }
        .btn-success:hover { background: #219a52; }
        .btn-warning { background: #f39c12; color: white; }
        .btn-warning:hover { background: #d68910; }
        .btn-danger { background: #e74c3c; color: white; }
        .btn-danger:hover { background: #c0392b; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .stat-card .num { font-size: 36px; font-weight: bold; color: #333; }
        .stat-card .label { font-size: 13px; color: #888; margin-top: 4px; }
        .stat-card.danger .num { color: #e74c3c; }
        .stat-card.warning .num { color: #f39c12; }
        .stat-card.success .num { color: #27ae60; }
        .section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .section h2 { font-size: 16px; margin-bottom: 16px; color: #333; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 12px 8px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #fafafa; font-weight: 600; color: #555; }
        tr:hover { background: #f8f9ff; }
        .tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
        .tag-red { background: #fde2e2; color: #c0392b; }
        .tag-orange { background: #fef3e2; color: #d68910; }
        .tag-green { background: #e8f8f5; color: #1e8449; }
        .tag-blue { background: #eaf2f8; color: #2471a3; }
        .tag-gray { background: #f2f3f5; color: #666; }
        .action-btn { padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
        .modal.show { display: flex; }
        .modal-content { background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; }
        .modal-content h3 { margin-bottom: 20px; color: #333; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #555; font-weight: 500; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; font-family: inherit; }
        .form-group textarea { min-height: 80px; resize: vertical; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }
        .btn-secondary { background: #95a5a6; color: white; }
        .btn-secondary:hover { background: #7f8c8d; }
        .detail-box { background: #f8f9ff; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 12px; }
        .detail-box .field { margin-bottom: 6px; }
        .detail-box .field strong { color: #555; display: inline-block; width: 90px; }
        .trace-info { background: #e8f6f3; padding: 10px; border-radius: 6px; font-size: 11px; color: #0e6251; margin-top: 8px; }
        .loading { text-align: center; padding: 40px; color: #999; }
        .filter-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-bar input, .filter-bar select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
        .link-btn { background: none; border: none; color: #667eea; cursor: pointer; text-decoration: underline; font-size: 12px; padding: 0; }
        .highlight-row { background: #fff3cd !important; }
    </style>
</head>
<body>
    <div class="header">
        <h1>💳 信用卡分期提前结清 - 小看板</h1>
    </div>
    <div class="container">
        <div class="actions">
            <button class="btn btn-primary" onclick="showImportModal()">📥 导入清算批次</button>
            <button class="btn btn-success" onclick="loadRecords()">🔄 刷新数据</button>
            <button class="btn btn-warning" onclick="window.open('/api/report', '_blank')">📊 查看完整报告</button>
            <button class="btn btn-warning" onclick="window.open('/api/supplementary.csv', '_blank')">📋 导出补录CSV</button>
            <button class="btn btn-danger" onclick="filterInconsistent()">⚠️ 仅看机构简称不一致</button>
        </div>

        <div class="stats" id="stats-container">
            <div class="loading">加载中...</div>
        </div>

        <div class="section">
            <h2>记录列表</h2>
            <div class="filter-bar">
                <input type="text" id="search-input" placeholder="搜索流水号/机构简称..." onkeyup="filterTable()">
                <select id="status-filter" onchange="filterTable()">
                    <option value="">全部状态</option>
                    <option value="abnormal_need_review">异常待复核</option>
                    <option value="pending_fund_accounting">待基金会计处理</option>
                    <option value="pending_review">待财务复核</option>
                    <option value="reviewed">已复核</option>
                </select>
                <select id="owner-filter" onchange="filterTable()">
                    <option value="">全部负责人</option>
                    <option value="fund_accounting_lin">基金会计林姐</option>
                    <option value="financial_reviewer">财务复核人</option>
                </select>
            </div>
            <div id="records-container">
                <div class="loading">加载中...</div>
            </div>
        </div>
    </div>

    <div class="modal" id="importModal">
        <div class="modal-content">
            <h3>导入清算批次</h3>
            <div class="form-group">
                <label>清算批次号 *</label>
                <input type="text" id="import-batch-no" placeholder="如 BATCH_20260601">
            </div>
            <div class="form-group">
                <label>CSV文件 *</label>
                <input type="file" id="import-file" accept=".csv">
            </div>
            <div class="form-group">
                <label>导入人</label>
                <input type="text" id="import-user" value="system">
            </div>
            <div class="form-group">
                <label>备注</label>
                <input type="text" id="import-remark" placeholder="可选">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal('importModal')">取消</button>
                <button class="btn btn-primary" onclick="submitImport()">确认导入</button>
            </div>
        </div>
    </div>

    <div class="modal" id="holidayModal">
        <div class="modal-content">
            <h3>补录节假日顺延说明</h3>
            <div id="holiday-record-info" class="detail-box"></div>
            <div class="form-group">
                <label>节假日顺延说明 *</label>
                <textarea id="holiday-note" placeholder="请说明节假日顺延情况，如：该笔清算日期遇端午节假期，顺延至2026-06-03处理"></textarea>
            </div>
            <div class="form-group">
                <label>补录人</label>
                <input type="text" id="holiday-user" value="fund_accounting_lin">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal('holidayModal')">取消</button>
                <button class="btn btn-primary" onclick="submitHoliday()">确认补录</button>
            </div>
        </div>
    </div>

    <div class="modal" id="reviewModal">
        <div class="modal-content">
            <h3>财务复核</h3>
            <div id="review-record-info" class="detail-box"></div>
            <div class="form-group">
                <label>复核结果 *</label>
                <select id="review-result">
                    <option value="true">通过</option>
                    <option value="false">退回</option>
                </select>
            </div>
            <div class="form-group">
                <label>复核意见 *</label>
                <textarea id="review-comment" placeholder="请填写复核意见"></textarea>
            </div>
            <div class="form-group">
                <label>复核人</label>
                <input type="text" id="review-user" value="financial_reviewer">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal('reviewModal')">取消</button>
                <button class="btn btn-primary" onclick="submitReview()">确认复核</button>
            </div>
        </div>
    </div>

    <div class="modal" id="detailModal">
        <div class="modal-content">
            <h3>记录详情</h3>
            <div id="detail-content"></div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal('detailModal')">关闭</button>
            </div>
        </div>
    </div>

    <script>
        let allRecords = [];
        let currentHolidayRecordId = null;
        let currentReviewRecordId = null;

        async function loadStats() {
            const resp = await fetch('/api/records');
            const data = await resp.json();
            const records = data.data;

            const stats = {
                total: records.length,
                inconsistent: records.filter(r => !r.org_name_consistent).length,
                abnormal: records.filter(r => r.status === 'abnormal_need_review').length,
                pending: records.filter(r => ['pending_review', 'pending_fund_accounting'].includes(r.status)).length,
                reviewed: records.filter(r => ['reviewed', 'resolved'].includes(r.status)).length,
            };

            document.getElementById('stats-container').innerHTML = `
                <div class="stat-card"><div class="num">${stats.total}</div><div class="label">总记录数</div></div>
                <div class="stat-card danger"><div class="num">${stats.inconsistent}</div><div class="label">机构简称不一致</div></div>
                <div class="stat-card warning"><div class="num">${stats.abnormal}</div><div class="label">异常待处理</div></div>
                <div class="stat-card warning"><div class="num">${stats.pending}</div><div class="label">待处理/待复核</div></div>
                <div class="stat-card success"><div class="num">${stats.reviewed}</div><div class="label">已完成</div></div>
            `;
        }

        async function loadRecords() {
            const resp = await fetch('/api/records');
            const data = await resp.json();
            allRecords = data.data;
            renderRecords(allRecords);
            await loadStats();
        }

        function renderRecords(records) {
            const statusLabels = {
                'pending_import': '待导入',
                'abnormal_need_review': '异常待复核',
                'pending_fund_accounting': '待基金会计处理',
                'pending_review': '待财务复核',
                'reviewed': '已复核',
                'resolved': '已完成',
            };
            const statusTags = {
                'pending_import': 'tag-gray',
                'abnormal_need_review': 'tag-red',
                'pending_fund_accounting': 'tag-orange',
                'pending_review': 'tag-orange',
                'reviewed': 'tag-green',
                'resolved': 'tag-green',
            };
            const ownerLabels = {
                'fund_accounting_lin': '基金会计林姐',
                'financial_reviewer': '财务复核人',
                '已完成': '已完成',
            };

            if (records.length === 0) {
                document.getElementById('records-container').innerHTML = '<div class="loading">暂无数据</div>';
                return;
            }

            let html = '<table><thead><tr><th>流水号</th><th>来源批次</th><th>机构简称</th><th>一致性</th><th>状态</th><th>当前负责人</th><th>操作</th></tr></thead><tbody>';

            records.forEach(r => {
                html += `
                    <tr data-id="${r.record_id}">
                        <td><strong>${r.serial_no}</strong></td>
                        <td><span class="tag tag-blue">${r.batch_no}</span></td>
                        <td>${r.org_name}</td>
                        <td>${r.org_name_consistent ? '<span class="tag tag-green">一致</span>' : '<span class="tag tag-red">不一致</span>'}</td>
                        <td><span class="tag ${statusTags[r.status]}">${statusLabels[r.status]}</span></td>
                        <td><span class="tag tag-gray">${ownerLabels[r.next_owner] || r.next_owner}</span></td>
                        <td>
                            <button class="action-btn" style="background:#eaf2f8;color:#2471a3;" onclick="showDetail(${r.record_id})">详情</button>
                            ${r.status === 'pending_fund_accounting' || r.status === 'abnormal_need_review' ?
                                '<button class="action-btn" style="background:#e8f8f5;color:#1e8449;" onclick="showHolidayModal(' + r.record_id + ')">补录节假日</button>' : ''}
                            ${r.status === 'pending_review' || r.status === 'abnormal_need_review' ?
                                '<button class="action-btn" style="background:#fef3e2;color:#d68910;" onclick="showReviewModal(' + r.record_id + ')">复核</button>' : ''}
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
            document.getElementById('records-container').innerHTML = html;
        }

        function filterTable() {
            const search = document.getElementById('search-input').value.toLowerCase();
            const statusFilter = document.getElementById('status-filter').value;
            const ownerFilter = document.getElementById('owner-filter').value;

            let filtered = allRecords.filter(r => {
                const matchSearch = r.serial_no.toLowerCase().includes(search) || r.org_name.toLowerCase().includes(search);
                const matchStatus = !statusFilter || r.status === statusFilter;
                const matchOwner = !ownerFilter || r.next_owner === ownerFilter;
                return matchSearch && matchStatus && matchOwner;
            });

            renderRecords(filtered);
        }

        async function filterInconsistent() {
            const resp = await fetch('/api/records?inconsistent_only=true');
            const data = await resp.json();
            renderRecords(data.data);
        }

        async function showDetail(recordId) {
            const resp = await fetch(`/api/records/${recordId}`);
            const data = await resp.json();

            const statusLabels = {
                'pending_import': '待导入',
                'abnormal_need_review': '异常待复核',
                'pending_fund_accounting': '待基金会计处理',
                'pending_review': '待财务复核',
                'reviewed': '已复核',
                'resolved': '已完成',
            };

            let html = `
                <div class="detail-box">
                    <div class="field"><strong>流水号：</strong>${data.serial_no}</div>
                    <div class="field"><strong>来源批次：</strong>${data.batch_no}</div>
                    <div class="field"><strong>导入时间：</strong>${data.batch_import_date}</div>
                    <div class="field"><strong>机构简称：</strong>${data.org_name}</div>
                    <div class="field"><strong>期望简称：</strong>${data.org_name_expected || '-'}</div>
                    <div class="field"><strong>标准名称：</strong>${data.org_name_std}</div>
                    <div class="field"><strong>一致性：</strong>${data.org_name_consistent ? '✅一致' : '❌不一致'}</div>
                    <div class="field"><strong>卡号：</strong>${data.card_no}</div>
                    <div class="field"><strong>金额：</strong>${data.amount}</div>
                    <div class="field"><strong>清算日期：</strong>${data.settlement_date}</div>
                    <div class="field"><strong>当前状态：</strong>${statusLabels[data.status]}</div>
                </div>
            `;

            if (data.holiday_note) {
                html += `
                    <div class="detail-box" style="background:#eaf2f8;border-left:3px solid #2980b9;">
                        <div class="field"><strong>节假日说明：</strong>${data.holiday_note}</div>
                        <div class="field"><strong>补录人：</strong>${data.holiday_note_reviewed_by}</div>
                        <div class="field"><strong>补录时间：</strong>${data.holiday_note_reviewed_at}</div>
                    </div>
                `;
            }

            if (data.supplementary) {
                html += `
                    <div class="detail-box" style="background:#fff9e6;border-left:3px solid #f39c12;">
                        <div class="field"><strong>留下原因：</strong>${data.supplementary.reason_kept}</div>
                        <div class="field"><strong>缺材料：</strong>${data.supplementary.missing_materials || '无'}</div>
                        <div class="field"><strong>下一步：</strong>${data.supplementary.next_owner}</div>
                        <div class="field"><strong>更新人：</strong>${data.supplementary.updated_by}</div>
                        <div class="field"><strong>更新时间：</strong>${data.supplementary.updated_at}</div>
                    </div>
                `;
            }

            if (data.supplementary && data.supplementary.trace_info) {
                html += `<div class="trace-info"><strong>追溯路径：</strong>${data.supplementary.trace_info}</div>`;
            }

            document.getElementById('detail-content').innerHTML = html;
            document.getElementById('detailModal').classList.add('show');
        }

        function showImportModal() {
            document.getElementById('importModal').classList.add('show');
        }

        async function showHolidayModal(recordId) {
            currentHolidayRecordId = recordId;
            const resp = await fetch(`/api/records/${recordId}`);
            const data = await resp.json();
            document.getElementById('holiday-record-info').innerHTML = `
                <div class="field"><strong>流水号：</strong>${data.serial_no}</div>
                <div class="field"><strong>机构简称：</strong>${data.org_name}</div>
                <div class="field"><strong>清算日期：</strong>${data.settlement_date}</div>
                <div class="field"><strong>当前状态：</strong>${data.status}</div>
            `;
            document.getElementById('holidayModal').classList.add('show');
        }

        async function showReviewModal(recordId) {
            currentReviewRecordId = recordId;
            const resp = await fetch(`/api/records/${recordId}`);
            const data = await resp.json();
            document.getElementById('review-record-info').innerHTML = `
                <div class="field"><strong>流水号：</strong>${data.serial_no}</div>
                <div class="field"><strong>机构简称：</strong>${data.org_name}</div>
                <div class="field"><strong>一致性：</strong>${data.org_name_consistent ? '一致' : '不一致'}</div>
                <div class="field"><strong>当前状态：</strong>${data.status}</div>
                ${data.supplementary ? `<div class="field"><strong>留下原因：</strong>${data.supplementary.reason_kept}</div>` : ''}
            `;
            document.getElementById('reviewModal').classList.add('show');
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('show');
        }

        async function submitImport() {
            const batchNo = document.getElementById('import-batch-no').value;
            const fileInput = document.getElementById('import-file');
            const user = document.getElementById('import-user').value;
            const remark = document.getElementById('import-remark').value;

            if (!batchNo || !fileInput.files[0]) {
                alert('请填写批次号并选择CSV文件');
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('batch_no', batchNo);
            formData.append('imported_by', user);
            formData.append('remark', remark);

            try {
                const resp = await fetch('/api/import', {
                    method: 'POST',
                    body: formData,
                });
                const result = await resp.json();
                if (result.success) {
                    alert(`导入成功！共 ${result.total_records} 条记录，${result.inconsistent_count} 条机构简称不一致`);
                    closeModal('importModal');
                    await loadRecords();
                } else {
                    alert('导入失败：' + result.detail);
                }
            } catch (e) {
                alert('导入失败：' + e.message);
            }
        }

        async function submitHoliday() {
            const note = document.getElementById('holiday-note').value;
            const user = document.getElementById('holiday-user').value;

            if (!note) {
                alert('请填写节假日顺延说明');
                return;
            }

            try {
                const resp = await fetch('/api/holiday-note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        record_id: currentHolidayRecordId,
                        note: note,
                        reviewed_by: user,
                    }),
                });
                const result = await resp.json();
                if (result.success) {
                    alert('补录成功！补录记录已自动更新');
                    closeModal('holidayModal');
                    await loadRecords();
                } else {
                    alert('补录失败：' + result.detail);
                }
            } catch (e) {
                alert('补录失败：' + e.message);
            }
        }

        async function submitReview() {
            const approved = document.getElementById('review-result').value === 'true';
            const comment = document.getElementById('review-comment').value;
            const user = document.getElementById('review-user').value;

            if (!comment) {
                alert('请填写复核意见');
                return;
            }

            try {
                const resp = await fetch('/api/review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        record_id: currentReviewRecordId,
                        approved: approved,
                        comment: comment,
                        reviewed_by: user,
                    }),
                });
                const result = await resp.json();
                if (result.success) {
                    alert('复核完成！状态：' + (approved ? '通过' : '退回'));
                    closeModal('reviewModal');
                    await loadRecords();
                } else {
                    alert('复核失败：' + result.detail);
                }
            } catch (e) {
                alert('复核失败：' + e.message);
            }
        }

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });

        loadRecords();
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
