from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import os

from database import (
    init_db, insert_markdown_file, insert_heading_anchor, insert_link,
    update_link, get_link_by_id, get_links_by_status, get_all_links,
    get_anchors_by_file_id, get_file_by_path, get_all_files,
    create_report, get_report, get_all_reports
)
from anchor_utils import (
    parse_markdown_headings, parse_markdown_links, generate_anchor_slug,
    scan_file_for_broken_anchors, generate_file_hash, preview_fix,
    find_best_anchor_match
)


app = FastAPI(title="Markdown锚点迁移修复预览API", version="1.0.0")

init_db()


class ErrorCodes:
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEEDS_REVIEW = "needs_review"
    ALREADY_PROCESSED = "already_processed"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"


class APIError(HTTPException):
    def __init__(self, error_code: str, message: str, status_code: int = 400, details: Dict = None):
        super().__init__(status_code=status_code, detail={
            "error_code": error_code,
            "message": message,
            "details": details or {}
        })


@app.exception_handler(APIError)
async def api_error_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail
    )


class MarkdownFileImport(BaseModel):
    file_path: str = Field(..., description="Markdown文件路径")
    content: str = Field(..., description="文件内容")


class LinkFilterParams(BaseModel):
    status: Optional[str] = None
    needs_review: Optional[bool] = None
    file_id: Optional[int] = None


class LinkUpdateParams(BaseModel):
    new_link_url: Optional[str] = None
    new_anchor: Optional[str] = None
    status: Optional[str] = None
    resolution_note: Optional[str] = None
    needs_review: Optional[bool] = None
    reviewed_by: Optional[str] = None


class PreviewFixParams(BaseModel):
    content: str = Field(..., description="原始Markdown内容")
    link_id: int = Field(..., description="链接ID")
    new_anchor: str = Field(..., description="新的锚点")


class GenerateReportParams(BaseModel):
    report_name: str = Field(..., description="报告名称")


@app.get("/")
async def root():
    return {"message": "Markdown锚点迁移修复预览API", "version": "1.0.0"}


@app.post("/api/files/import")
async def import_markdown_file(file_data: MarkdownFileImport):
    """
    导入Markdown文件，解析标题锚点并存储
    """
    if not file_data.file_path or not file_data.content:
        raise APIError(
            error_code=ErrorCodes.MISSING_FIELD,
            message="缺少必填字段: file_path 或 content",
            details={"required_fields": ["file_path", "content"]}
        )
    
    file_hash = generate_file_hash(file_data.content)
    
    file_id = insert_markdown_file(file_data.file_path, file_hash)
    
    headings = parse_markdown_headings(file_data.content)
    for heading in headings:
        insert_heading_anchor(
            file_id=file_id,
            heading_text=heading['text'],
            heading_level=heading['level'],
            anchor_slug=heading['anchor'],
            line_number=heading['line']
        )
    
    links = parse_markdown_links(file_data.content)
    for link in links:
        insert_link(
            source_file_id=file_id,
            link_text=link['text'],
            old_link_url=link['url'],
            old_anchor=link['anchor'],
            line_number=link['line'],
            column_number=link['column']
        )
    
    return {
        "success": True,
        "file_id": file_id,
        "file_path": file_data.file_path,
        "headings_found": len(headings),
        "links_found": len(links)
    }


@app.get("/api/files")
async def list_files():
    """
    获取所有已导入的文件列表
    """
    files = get_all_files()
    return {
        "files": files,
        "total": len(files)
    }


@app.get("/api/files/{file_id}/anchors")
async def get_file_anchors(file_id: int):
    """
    获取指定文件的所有锚点
    """
    anchors = get_anchors_by_file_id(file_id)
    if not anchors:
        file = get_file_by_path(str(file_id))
        if not file:
            raise APIError(
                error_code=ErrorCodes.NOT_FOUND,
                message=f"文件ID {file_id} 不存在",
                status_code=404
            )
    return {
        "file_id": file_id,
        "anchors": anchors,
        "total": len(anchors)
    }


@app.get("/api/links")
async def list_links(status: Optional[str] = None, needs_review: Optional[bool] = None, file_id: Optional[int] = None):
    """
    获取链接列表，支持筛选
    """
    if status:
        links = get_links_by_status(status)
    else:
        links = get_all_links()
    
    if needs_review is not None:
        links = [l for l in links if l['needs_review'] == needs_review]
    
    if file_id is not None:
        links = [l for l in links if l['source_file_id'] == file_id]
    
    return {
        "links": links,
        "total": len(links),
        "filters": {
            "status": status,
            "needs_review": needs_review,
            "file_id": file_id
        }
    }


@app.get("/api/links/{link_id}")
async def get_link(link_id: int):
    """
    获取单个链接详情
    """
    link = get_link_by_id(link_id)
    if not link:
        raise APIError(
            error_code=ErrorCodes.NOT_FOUND,
            message=f"链接ID {link_id} 不存在",
            status_code=404
        )
    return link


@app.put("/api/links/{link_id}")
async def update_link_status(link_id: int, update_data: LinkUpdateParams):
    """
    更新链接状态和修复信息
    """
    link = get_link_by_id(link_id)
    if not link:
        raise APIError(
            error_code=ErrorCodes.NOT_FOUND,
            message=f"链接ID {link_id} 不存在",
            status_code=404
        )
    
    if link['status'] == 'fixed' and update_data.status == 'fixed':
        raise APIError(
            error_code=ErrorCodes.ALREADY_PROCESSED,
            message="该链接已经处理过",
            details={"current_status": link['status']}
        )
    
    if update_data.needs_review and not update_data.reviewed_by:
        raise APIError(
            error_code=ErrorCodes.MISSING_FIELD,
            message="标记为需要人工复核时必须提供审核人",
            details={"required_fields": ["reviewed_by"]}
        )
    
    update_fields = update_data.dict(exclude_unset=True)
    if update_data.reviewed_by:
        update_fields['reviewed_at'] = datetime.now().isoformat()
    
    update_link(link_id, **update_fields)
    
    return {
        "success": True,
        "link_id": link_id,
        "updated_fields": list(update_fields.keys())
    }


@app.post("/api/scan/broken-anchors")
async def scan_broken_anchors():
    """
    扫描所有已导入文件中的断链
    """
    files = get_all_files()
    all_files_anchors = {}
    
    for file in files:
        anchors = get_anchors_by_file_id(file['id'])
        all_files_anchors[file['file_path']] = anchors
    
    all_broken_links = []
    auto_fix_count = 0
    needs_review_count = 0
    
    for file in files:
        file_id = file['id']
        file_path = file['file_path']
        
        file_links = [l for l in get_all_links() if l['source_file_id'] == file_id]
        
        for link in file_links:
            if link['status'] != 'pending':
                continue
            
            old_anchor = link['old_anchor']
            if not old_anchor:
                continue
            
            target_file = link['old_link_url']
            if not target_file or target_file.startswith('#'):
                target_file_path = file_path
            else:
                target_file_path = os.path.normpath(os.path.join(os.path.dirname(file_path), target_file))
                if not target_file_path.endswith('.md'):
                    target_file_path += '.md'
            
            if target_file_path not in all_files_anchors:
                update_link(link['id'], status='broken', resolution_note='目标文件不存在')
                all_broken_links.append({
                    "link_id": link['id'],
                    "file_path": file_path,
                    "reason": "target_file_not_found",
                    "old_anchor": old_anchor
                })
                continue
            
            available_anchors = all_files_anchors[target_file_path]
            anchor_exists = any(a['anchor_slug'] == old_anchor for a in available_anchors)
            
            if not anchor_exists:
                anchor_dicts = [{'anchor': a['anchor_slug'], 'text': a['heading_text']} for a in available_anchors]
                best_match, score = find_best_anchor_match(old_anchor, anchor_dicts)
                
                if best_match and score >= 0.8:
                    new_anchor = best_match['anchor']
                    update_link(
                        link['id'],
                        status='auto_fixed',
                        new_anchor=new_anchor,
                        resolution_note=f"自动匹配到锚点，相似度: {score:.2f}"
                    )
                    auto_fix_count += 1
                elif best_match and score >= 0.6:
                    update_link(
                        link['id'],
                        status='candidate',
                        new_anchor=best_match['anchor'],
                        needs_review=True,
                        resolution_note=f"找到候选锚点，相似度: {score:.2f}，需要人工确认"
                    )
                    needs_review_count += 1
                else:
                    update_link(
                        link['id'],
                        status='broken',
                        resolution_note="未找到匹配的锚点"
                    )
                
                all_broken_links.append({
                    "link_id": link['id'],
                    "file_path": file_path,
                    "old_anchor": old_anchor,
                    "best_match": best_match,
                    "similarity_score": score,
                    "status": get_link_by_id(link['id'])['status']
                })
    
    return {
        "success": True,
        "total_files_scanned": len(files),
        "broken_links_found": len(all_broken_links),
        "auto_fixed": auto_fix_count,
        "needs_review": needs_review_count,
        "broken_links": all_broken_links
    }


@app.post("/api/preview/fix")
async def preview_link_fix(params: PreviewFixParams):
    """
    预览链接修复效果
    """
    link = get_link_by_id(params.link_id)
    if not link:
        raise APIError(
            error_code=ErrorCodes.NOT_FOUND,
            message=f"链接ID {params.link_id} 不存在",
            status_code=404
        )
    
    if link['status'] == 'fixed':
        raise APIError(
            error_code=ErrorCodes.ALREADY_PROCESSED,
            message="该链接已经处理过，预览不可用",
            details={"current_status": link['status']}
        )
    
    link_info = {
        'line': link['line_number'],
        'text': link['link_text'],
        'url': link['old_link_url'],
        'anchor': link['old_anchor']
    }
    
    new_content, fix_details = preview_fix(params.content, link_info, params.new_anchor)
    
    if not fix_details['success']:
        raise APIError(
            error_code=ErrorCodes.INVALID_STATUS,
            message=f"预览失败: {fix_details.get('error', '未知错误')}",
            details=fix_details
        )
    
    return {
        "success": True,
        "link_id": params.link_id,
        "fix_details": fix_details,
        "new_content": new_content
    }


@app.post("/api/reports/generate")
async def generate_migration_report(params: GenerateReportParams):
    """
    生成迁移报告
    """
    files = get_all_files()
    all_links = get_all_links()
    
    status_counts = {}
    for link in all_links:
        status = link['status']
        status_counts[status] = status_counts.get(status, 0) + 1
    
    needs_review_links = [l for l in all_links if l['needs_review']]
    broken_links = [l for l in all_links if l['status'] == 'broken']
    fixed_links = [l for l in all_links if l['status'] in ['fixed', 'auto_fixed']]
    
    report_data = {
        "summary": {
            "total_files": len(files),
            "total_links": len(all_links),
            "status_distribution": status_counts,
            "needs_review_count": len(needs_review_links),
            "broken_count": len(broken_links),
            "fixed_count": len(fixed_links)
        },
        "files": [
            {
                "file_path": f['file_path'],
                "file_id": f['id'],
                "anchors_count": len(get_anchors_by_file_id(f['id'])),
                "links_count": len([l for l in all_links if l['source_file_id'] == f['id']])
            }
            for f in files
        ],
        "broken_links": broken_links,
        "needs_review_links": needs_review_links,
        "fixed_links": fixed_links
    }
    
    report_id = create_report(
        report_name=params.report_name,
        report_data=report_data,
        total_files_scanned=len(files),
        total_links_found=len(all_links),
        broken_links_found=len(broken_links),
        auto_fixed_links=len([l for l in fixed_links if l['status'] == 'auto_fixed']),
        needs_review_links=len(needs_review_links)
    )
    
    return {
        "success": True,
        "report_id": report_id,
        "report_name": params.report_name,
        "summary": report_data['summary']
    }


@app.get("/api/reports")
async def list_reports():
    """
    获取所有报告列表
    """
    reports = get_all_reports()
    return {
        "reports": reports,
        "total": len(reports)
    }


@app.get("/api/reports/{report_id}")
async def get_report_details(report_id: int):
    """
    获取单个报告详情
    """
    report = get_report(report_id)
    if not report:
        raise APIError(
            error_code=ErrorCodes.NOT_FOUND,
            message=f"报告ID {report_id} 不存在",
            status_code=404
        )
    return report


@app.get("/api/reports/{report_id}/export")
async def export_report(report_id: int):
    """
    导出报告为JSON格式
    """
    report = get_report(report_id)
    if not report:
        raise APIError(
            error_code=ErrorCodes.NOT_FOUND,
            message=f"报告ID {report_id} 不存在",
            status_code=404
        )
    
    return JSONResponse(
        content=report,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=report_{report_id}.json"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
