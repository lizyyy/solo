from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import PlainTextResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any

from database import SessionLocal, init_db, DeploymentRelease, K8sEvent, PodStatus, TimelineReport
from kubectl_parser import KubectlOutputParser
from timeline_analyzer import TimelineAnalyzer, ImageComparator
from markdown_generator import MarkdownReportGenerator


app = FastAPI(title="K8s 发布失败时间线分析 API", version="1.0.0")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error = exc.errors()[0]
    field = error.get("loc", ["", ""])[-1] if error.get("loc") else "unknown"
    msg = error.get("msg", "字段验证失败")
    return JSONResponse(
        status_code=400,
        content={
            "detail": {
                "error_code": "MISSING_FIELD",
                "message": f"缺少 {field} 字段: {msg}",
                "details": {"field": field, "error": msg}
            }
        }
    )

parser = KubectlOutputParser()
analyzer = TimelineAnalyzer()
image_comparator = ImageComparator()
markdown_generator = MarkdownReportGenerator()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    init_db()


class ErrorCode:
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_STATE = "INVALID_STATE"
    MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"
    ALREADY_PROCESSED = "ALREADY_PROCESSED"
    NOT_FOUND = "NOT_FOUND"


class K8sEventInput(BaseModel):
    event_time: datetime
    type: str
    reason: str
    message: str
    involved_object_kind: str
    involved_object_name: str
    source_component: str
    count: int = 1


class PodStatusInput(BaseModel):
    pod_name: str
    namespace: str
    phase: str
    ready: str
    status: str
    restarts: int
    age: str
    image: str
    node: Optional[str] = None
    start_time: Optional[datetime] = None


class ReleaseCreateRequest(BaseModel):
    namespace: str = Field(..., description="Kubernetes 命名空间")
    deployment_name: str = Field(..., description="Deployment 名称")
    old_image: Optional[str] = Field(None, description="旧镜像")
    new_image: Optional[str] = Field(None, description="新镜像")
    events: List[K8sEventInput] = Field(default_factory=list, description="事件列表")
    pods: List[PodStatusInput] = Field(default_factory=list, description="Pod 状态列表")
    events_output: Optional[str] = Field(None, description="kubectl get events 原始输出")
    pods_output: Optional[str] = Field(None, description="kubectl get pods 原始输出")


class ReleaseProcessRequest(BaseModel):
    release_id: int = Field(..., description="发布记录ID")


class KubectlParseRequest(BaseModel):
    events_output: Optional[str] = None
    pods_output: Optional[str] = None
    deployments_output: Optional[str] = None
    rs_output: Optional[str] = None


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class ReleaseSummaryResponse(BaseModel):
    id: int
    namespace: str
    deployment_name: str
    release_time: datetime
    status: str
    result: Optional[str] = None
    root_cause: Optional[str] = None
    confidence: Optional[str] = None


class AnalysisResultResponse(BaseModel):
    root_cause: str
    confidence: str
    suggested_actions: List[str]
    key_events_count: int
    abnormal_pods_count: int


def raise_http_error(error_code: str, message: str, details: Dict = None, status_code: int = 400):
    raise HTTPException(
        status_code=status_code,
        detail={
            "error_code": error_code,
            "message": message,
            "details": details or {}
        }
    )


@app.get("/")
async def root():
    return {
        "service": "K8s 发布失败时间线分析 API",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/v1/releases": "创建新的发布记录",
            "POST /api/v1/releases/{id}/process": "分析发布失败原因",
            "GET /api/v1/releases/{id}": "获取发布详情",
            "GET /api/v1/releases/{id}/report": "获取Markdown报告",
            "GET /api/v1/releases": "获取发布列表",
            "POST /api/v1/parse/kubectl": "解析kubectl输出"
        }
    }


@app.post("/api/v1/releases", response_model=ReleaseSummaryResponse)
async def create_release(request: ReleaseCreateRequest, db: Session = Depends(get_db)):
    if not request.namespace:
        raise_http_error(ErrorCode.MISSING_FIELD, "缺少 namespace 字段", {"field": "namespace"})

    if not request.deployment_name:
        raise_http_error(ErrorCode.MISSING_FIELD, "缺少 deployment_name 字段", {"field": "deployment_name"})

    release = DeploymentRelease(
        namespace=request.namespace,
        deployment_name=request.deployment_name,
        old_image=request.old_image,
        new_image=request.new_image,
        status="pending",
        release_time=datetime.utcnow()
    )

    db.add(release)
    db.flush()

    events = []
    if request.events_output:
        parsed_events = parser.parse_events(request.events_output)
        for event in parsed_events:
            events.append(K8sEvent(
                release_id=release.id,
                event_time=event.event_time,
                type=event.type,
                reason=event.reason,
                message=event.message,
                involved_object_kind=event.involved_object_kind,
                involved_object_name=event.involved_object_name,
                source_component=event.source_component,
                count=event.count
            ))

    for event in request.events:
        events.append(K8sEvent(
            release_id=release.id,
            event_time=event.event_time,
            type=event.type,
            reason=event.reason,
            message=event.message,
            involved_object_kind=event.involved_object_kind,
            involved_object_name=event.involved_object_name,
            source_component=event.source_component,
            count=event.count
        ))

    db.bulk_save_objects(events)

    pods = []
    if request.pods_output:
        parsed_pods = parser.parse_pods(request.pods_output)
        for pod in parsed_pods:
            pods.append(PodStatus(
                release_id=release.id,
                pod_name=pod.pod_name,
                namespace=pod.namespace or request.namespace,
                phase=pod.phase or pod.status,
                ready=pod.ready,
                status=pod.status,
                restarts=pod.restarts,
                age=pod.age,
                image="",
                node=pod.node
            ))

    for pod in request.pods:
        pods.append(PodStatus(
            release_id=release.id,
            pod_name=pod.pod_name,
            namespace=pod.namespace,
            phase=pod.phase,
            ready=pod.ready,
            status=pod.status,
            restarts=pod.restarts,
            age=pod.age,
            image=pod.image,
            node=pod.node,
            start_time=pod.start_time
        ))

    db.bulk_save_objects(pods)
    db.commit()
    db.refresh(release)

    return ReleaseSummaryResponse(
        id=release.id,
        namespace=release.namespace,
        deployment_name=release.deployment_name,
        release_time=release.release_time,
        status=release.status,
        result=release.result,
        root_cause=None,
        confidence=None
    )


@app.post("/api/v1/releases/{release_id}/process", response_model=AnalysisResultResponse)
async def process_release(release_id: int, db: Session = Depends(get_db)):
    release = db.query(DeploymentRelease).filter(DeploymentRelease.id == release_id).first()
    if not release:
        raise_http_error(ErrorCode.NOT_FOUND, "发布记录不存在", {"release_id": release_id}, status_code=404)

    if release.status in ["already_processed", "completed", "failed_manual_review"]:
        raise_http_error(ErrorCode.ALREADY_PROCESSED, "该发布已经处理过", {"release_id": release_id, "current_status": release.status})

    if release.status == "processing":
        raise_http_error(ErrorCode.INVALID_STATE, "该发布正在处理中", {"release_id": release_id})

    release.status = "processing"
    db.commit()

    try:
        events = db.query(K8sEvent).filter(K8sEvent.release_id == release_id).all()
        pods = db.query(PodStatus).filter(PodStatus.release_id == release_id).all()

        events_dict = [
            {
                "event_time": e.event_time,
                "type": e.type,
                "reason": e.reason,
                "message": e.message,
                "involved_object_kind": e.involved_object_kind,
                "involved_object_name": e.involved_object_name,
                "source_component": e.source_component,
                "count": e.count
            }
            for e in events
        ]

        pods_dict = [
            {
                "pod_name": p.pod_name,
                "status": p.status,
                "phase": p.phase,
                "ready": p.ready,
                "restarts": p.restarts,
                "age": p.age,
                "image": p.image,
                "node": p.node,
                "start_time": p.start_time
            }
            for p in pods
        ]

        analysis = analyzer.analyze_failure_reason(events_dict, pods_dict)

        abnormal_count = sum(1 for p in pods_dict if p.get('status') not in ['Running', 'Succeeded'])

        image_compare_result = None
        if release.old_image and release.new_image:
            image_compare_result = image_comparator.compare(release.old_image, release.new_image)

        release_info = {
            "namespace": release.namespace,
            "deployment_name": release.deployment_name,
            "release_time": release.release_time,
            "result": "failed" if abnormal_count > 0 else "success"
        }

        markdown_content = markdown_generator.generate_full_report(
            release_info=release_info,
            events=events_dict,
            pods=pods_dict,
            analysis={
                "root_cause": analysis.root_cause,
                "confidence": analysis.confidence,
                "suggested_actions": analysis.suggested_actions
            },
            image_comparison=image_compare_result or {}
        )

        report = TimelineReport(
            release_id=release.id,
            markdown_content=markdown_content,
            root_cause=analysis.root_cause,
            confidence=analysis.confidence,
            suggested_actions="\n".join(analysis.suggested_actions)
        )
        db.add(report)

        release.status = "failed_manual_review" if analysis.confidence == "low" else "completed"
        release.result = "failed" if analysis.root_cause != "Unknown" else "partial"

        db.commit()

        result = AnalysisResultResponse(
            root_cause=analysis.root_cause,
            confidence=analysis.confidence,
            suggested_actions=analysis.suggested_actions,
            key_events_count=len(analysis.key_events),
            abnormal_pods_count=abnormal_count
        )

        if analysis.confidence == "low":
            raise_http_error(
                ErrorCode.MANUAL_REVIEW_REQUIRED,
                "分析置信度低，需要人工复核",
                {
                    "release_id": release_id,
                    "root_cause": analysis.root_cause,
                    "confidence": analysis.confidence,
                    "suggested_actions": analysis.suggested_actions,
                    "report_available": True
                },
                status_code=202
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        release.status = "pending"
        db.commit()
        raise e


@app.get("/api/v1/releases/{release_id}")
async def get_release(release_id: int, db: Session = Depends(get_db)):
    release = db.query(DeploymentRelease).filter(DeploymentRelease.id == release_id).first()
    if not release:
        raise_http_error(ErrorCode.NOT_FOUND, "发布记录不存在", {"release_id": release_id}, status_code=404)

    events = db.query(K8sEvent).filter(K8sEvent.release_id == release_id).all()
    pods = db.query(PodStatus).filter(PodStatus.release_id == release_id).all()
    report = db.query(TimelineReport).filter(TimelineReport.release_id == release_id).first()

    image_compare_result = None
    if release.old_image and release.new_image:
        image_compare_result = image_comparator.compare(release.old_image, release.new_image)

    return {
        "release": {
            "id": release.id,
            "namespace": release.namespace,
            "deployment_name": release.deployment_name,
            "release_time": release.release_time,
            "status": release.status,
            "result": release.result,
            "old_image": release.old_image,
            "new_image": release.new_image,
            "image_comparison": image_compare_result
        },
        "events_count": len(events),
        "pods_count": len(pods),
        "report_available": report is not None,
        "root_cause": report.root_cause if report else None,
        "confidence": report.confidence if report else None
    }


@app.get("/api/v1/releases/{release_id}/report", response_class=PlainTextResponse)
async def get_release_report(release_id: int, format: str = "markdown", db: Session = Depends(get_db)):
    report = db.query(TimelineReport).filter(TimelineReport.release_id == release_id).first()
    if not report:
        raise_http_error(ErrorCode.NOT_FOUND, "报告不存在，请先调用 process 接口", {"release_id": release_id}, status_code=404)

    return report.markdown_content


@app.get("/api/v1/releases", response_model=List[ReleaseSummaryResponse])
async def list_releases(skip: int = 0, limit: int = 20, namespace: str = None, db: Session = Depends(get_db)):
    query = db.query(DeploymentRelease)
    if namespace:
        query = query.filter(DeploymentRelease.namespace == namespace)

    releases = query.order_by(DeploymentRelease.release_time.desc()).offset(skip).limit(limit).all()

    results = []
    for release in releases:
        report = db.query(TimelineReport).filter(TimelineReport.release_id == release.id).first()
        results.append(ReleaseSummaryResponse(
            id=release.id,
            namespace=release.namespace,
            deployment_name=release.deployment_name,
            release_time=release.release_time,
            status=release.status,
            result=release.result,
            root_cause=report.root_cause if report else None,
            confidence=report.confidence if report else None
        ))

    return results


@app.post("/api/v1/parse/kubectl")
async def parse_kubectl_output(request: KubectlParseRequest):
    result = {}

    if request.events_output:
        events = parser.parse_events(request.events_output)
        result["events"] = [
            {
                "event_time": e.event_time,
                "type": e.type,
                "reason": e.reason,
                "message": e.message,
                "involved_object_kind": e.involved_object_kind,
                "involved_object_name": e.involved_object_name,
                "source_component": e.source_component,
                "count": e.count
            }
            for e in events
        ]

    if request.pods_output:
        pods = parser.parse_pods(request.pods_output)
        result["pods"] = [
            {
                "pod_name": p.pod_name,
                "ready": p.ready,
                "status": p.status,
                "restarts": p.restarts,
                "age": p.age,
                "ip": p.ip,
                "node": p.node,
                "nominated_node": p.nominated_node,
                "readness_gates": p.readness_gates
            }
            for p in pods
        ]

    if request.deployments_output:
        deployments = parser.parse_deployments(request.deployments_output)
        result["deployments"] = [
            {
                "name": d.name,
                "ready": d.ready,
                "up_to_date": d.up_to_date,
                "available": d.available,
                "age": d.age,
                "containers": d.containers,
                "images": d.images
            }
            for d in deployments
        ]

    if request.rs_output:
        result["replicasets"] = parser.parse_rs(request.rs_output)

    return result


@app.post("/api/v1/compare/images")
async def compare_images(old_image: str, new_image: str):
    return image_comparator.compare(old_image, new_image)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
