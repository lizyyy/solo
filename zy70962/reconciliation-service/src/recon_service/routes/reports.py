"""报告路由：汇总、明细、导出 CSV / XLSX。"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ..services.deps import repo
from ..services.reporting import export_csv, export_xlsx, summarize


router = APIRouter()


@router.get("/summary/{batch_id}")
def get_summary(batch_id: UUID) -> dict:
    batch = repo.get(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return summarize(batch)


@router.get("/download/{batch_id}/{kind}")
def download_report(batch_id: UUID, kind: str) -> Response:
    """下载 CSV / XLSX。kind ∈ {detail.csv, summary.csv, detail.xlsx, summary.xlsx}。"""
    batch = repo.get(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")

    if kind.endswith(".csv"):
        sub = kind[:-4]
        if sub not in {"detail", "summary"}:
            raise HTTPException(status_code=400, detail="kind 仅支持 detail/summary")
        filename, text = export_csv(batch, sub)
        return Response(
            content=text,
            media_type="text/csv; charset=utf-8-sig",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    if kind.endswith(".xlsx"):
        sub = kind[:-5]
        if sub not in {"detail", "summary"}:
            raise HTTPException(status_code=400, detail="kind 仅支持 detail/summary")
        filename, data = export_xlsx(batch, sub)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    raise HTTPException(status_code=400, detail="仅支持 .csv / .xlsx 格式")
