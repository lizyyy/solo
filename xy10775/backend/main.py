from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from enum import Enum

app = FastAPI(title="无障碍检查修复台 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StatusEnum(str, Enum):
    PENDING = "待处理"
    PROCESSING = "处理中"
    FIXED = "已修复"
    RECHECKED = "已复核"
    REJECTED = "修复失败"


class RuleCategory(str, Enum):
    COLOR = "颜色对比度"
    KEYBOARD = "键盘导航"
    SCREEN_READER = "屏幕阅读器"
    SEMANTIC = "语义化"
    FORM = "表单"
    IMAGE = "图片"


class ReviewLog(BaseModel):
    id: str
    reviewer: str
    review_time: datetime
    reason: str
    from_status: str
    to_status: str


class AccessibilityIssue(BaseModel):
    id: str
    page_path: str
    page_path_original: str
    rule_id: str
    rule_name: str
    rule_category: RuleCategory
    description: str
    screenshot: Optional[str] = None
    element_selector: Optional[str] = None
    repair_suggestion: str
    status: StatusEnum = StatusEnum.PENDING
    assignee: Optional[str] = None
    handler: Optional[str] = None
    handle_time: Optional[datetime] = None
    handle_reason: Optional[str] = None
    review_logs: List[ReviewLog] = []
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class IssueCreate(BaseModel):
    page_path: str
    rule_id: str
    rule_name: str
    rule_category: RuleCategory
    description: str
    screenshot: Optional[str] = None
    element_selector: Optional[str] = None
    repair_suggestion: str


class IssueUpdate(BaseModel):
    status: Optional[StatusEnum] = None
    assignee: Optional[str] = None
    handler: Optional[str] = None
    handle_reason: Optional[str] = None
    reviewer: Optional[str] = None
    review_reason: Optional[str] = None


db: Dict[str, AccessibilityIssue] = {}


def init_sample_data():
    sample_issues = [
        {
            "page_path": "/home",
            "page_path_original": "/home",
            "rule_id": "WCAG-1.4.3",
            "rule_name": "颜色对比度不足",
            "rule_category": RuleCategory.COLOR,
            "description": "导航栏文字与背景对比度仅为 2:1，低于 WCAG AA 标准的 4.5:1",
            "screenshot": "nav-contrast.png",
            "element_selector": ".navbar .menu-item",
            "repair_suggestion": "将文字颜色改为 #333333，背景色改为 #FFFFFF，对比度将达到 14:1",
            "status": StatusEnum.PENDING,
        },
        {
            "page_path": "/login",
            "page_path_original": "/login",
            "rule_id": "WCAG-2.1.1",
            "rule_name": "键盘无法聚焦",
            "rule_category": RuleCategory.KEYBOARD,
            "description": "提交按钮无法通过 Tab 键聚焦",
            "screenshot": "login-button.png",
            "element_selector": "#submit-btn",
            "repair_suggestion": "为按钮添加 tabindex='0' 属性，确保可被键盘聚焦",
            "status": StatusEnum.PROCESSING,
            "assignee": "张三",
        },
        {
            "page_path": "/products/list",
            "page_path_original": "/products/list?page=1&sort=price",
            "rule_id": "WCAG-1.1.1",
            "rule_name": "图片缺少 alt 文本",
            "rule_category": RuleCategory.IMAGE,
            "description": "产品列表中有 5 张图片未设置 alt 属性",
            "screenshot": "product-images.png",
            "element_selector": ".product-card img",
            "repair_suggestion": "为每张产品图片添加描述性 alt 文本，如 alt='红色运动鞋正面图'",
            "status": StatusEnum.FIXED,
            "handler": "李四",
            "handle_time": datetime.now(),
            "handle_reason": "已为所有产品图片添加 alt 文本",
        },
        {
            "page_path": "/checkout",
            "page_path_original": "/checkout",
            "rule_id": "WCAG-3.3.2",
            "rule_name": "表单标签缺失",
            "rule_category": RuleCategory.FORM,
            "description": "信用卡输入框没有关联的 label 标签",
            "screenshot": "cc-input.png",
            "element_selector": "#card-number",
            "repair_suggestion": "使用 label 标签关联输入框，或添加 aria-label 属性",
            "status": StatusEnum.REJECTED,
            "handler": "王五",
            "handle_time": datetime.now(),
            "handle_reason": "初步修复但测试不通过",
            "review_logs": [
                ReviewLog(
                    id=str(uuid.uuid4()),
                    reviewer="赵六",
                    review_time=datetime.now(),
                    reason="修复不完整，仅添加了 placeholder 但未加 label",
                    from_status=StatusEnum.FIXED,
                    to_status=StatusEnum.REJECTED,
                )
            ],
        },
        {
            "page_path": "/checkout",
            "page_path_original": "/checkout",
            "rule_id": "WCAG-4.1.2",
            "rule_name": "状态变更无通知",
            "rule_category": RuleCategory.SCREEN_READER,
            "description": "表单验证错误消息出现时，屏幕阅读器无法自动播报",
            "screenshot": "form-error.png",
            "element_selector": ".error-message",
            "repair_suggestion": "为错误消息容器添加 aria-live='assertive' 属性",
            "status": StatusEnum.RECHECKED,
            "handler": "王五",
            "handle_time": datetime.now(),
            "handle_reason": "已添加 aria-live 属性",
            "review_logs": [
                ReviewLog(
                    id=str(uuid.uuid4()),
                    reviewer="赵六",
                    review_time=datetime.now(),
                    reason="验证通过，屏幕阅读器可以正确播报错误消息",
                    from_status=StatusEnum.FIXED,
                    to_status=StatusEnum.RECHECKED,
                )
            ],
        },
    ]

    for issue_data in sample_issues:
        issue_id = str(uuid.uuid4())
        issue = AccessibilityIssue(
            id=issue_id,
            **issue_data,
        )
        db[issue_id] = issue


init_sample_data()


@app.get("/api/issues")
def get_issues(
    status: Optional[str] = None,
    rule_category: Optional[str] = None,
    page_path: Optional[str] = None,
):
    issues = list(db.values())

    if status:
        issues = [i for i in issues if i.status == status]
    if rule_category:
        issues = [i for i in issues if i.rule_category == rule_category]
    if page_path:
        issues = [i for i in issues if page_path.lower() in i.page_path.lower()]

    return {"total": len(issues), "items": issues}


@app.get("/api/issues/{issue_id}")
def get_issue(issue_id: str):
    if issue_id not in db:
        raise HTTPException(status_code=404, detail="问题不存在")
    return db[issue_id]


@app.post("/api/issues")
def create_issue(issue: IssueCreate):
    issue_id = str(uuid.uuid4())
    new_issue = AccessibilityIssue(
        id=issue_id,
        page_path=issue.page_path,
        page_path_original=issue.page_path,
        rule_id=issue.rule_id,
        rule_name=issue.rule_name,
        rule_category=issue.rule_category,
        description=issue.description,
        screenshot=issue.screenshot,
        element_selector=issue.element_selector,
        repair_suggestion=issue.repair_suggestion,
    )
    db[issue_id] = new_issue
    return new_issue


@app.put("/api/issues/{issue_id}")
def update_issue(issue_id: str, update: IssueUpdate):
    if issue_id not in db:
        raise HTTPException(status_code=404, detail="问题不存在")

    issue = db[issue_id]
    old_status = issue.status

    if update.status:
        issue.status = update.status

    if update.assignee:
        issue.assignee = update.assignee

    if update.handler:
        issue.handler = update.handler
        issue.handle_time = datetime.now()

    if update.handle_reason:
        issue.handle_reason = update.handle_reason

    if update.reviewer and update.review_reason:
        review_log = ReviewLog(
            id=str(uuid.uuid4()),
            reviewer=update.reviewer,
            review_time=datetime.now(),
            reason=update.review_reason,
            from_status=old_status,
            to_status=issue.status,
        )
        issue.review_logs.append(review_log)

    issue.updated_at = datetime.now()
    return issue


@app.get("/api/stats")
def get_stats():
    total = len(db)
    by_status = {}
    for status in StatusEnum:
        by_status[status.value] = len([i for i in db.values() if i.status == status])
    by_category = {}
    for cat in RuleCategory:
        by_category[cat.value] = len([i for i in db.values() if i.rule_category == cat])
    return {"total": total, "by_status": by_status, "by_category": by_category}


@app.get("/api/report/{page_path}")
def get_report(page_path: str):
    issues = [i for i in db.values() if i.page_path == page_path]
    return {
        "page_path": page_path,
        "generated_at": datetime.now(),
        "total_issues": len(issues),
        "issues": issues,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
