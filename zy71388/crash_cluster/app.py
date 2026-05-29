from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, List
from core.models import CrashReport, CrashCluster
from core.normalizer import StackNormalizer
from core.clustering import ClusteringEngine
from core.store import Store
from core.export import generate_trend, export_csv, export_json, export_markdown

app = FastAPI(title="Crash Cluster", version="1.0.0")

normalizer = StackNormalizer()
engine = ClusteringEngine(normalizer)
store = Store()


class CrashSubmit(BaseModel):
    app_version: Optional[str] = None
    device_model: Optional[str] = None
    stack_trace: Optional[str] = None
    user_note: Optional[str] = None
    raw_log: Optional[str] = None

    model_config = {"json_schema_extra": {
        "examples": [{
            "app_version": "2.3.1",
            "device_model": "iPhone15,2",
            "stack_trace": "#0 0x10293aab4 MyApp.crash_handler + 128\n#1 a1b2 0x10293a000\n#2 MyApp.ViewController.viewDidLoad() + 56",
            "user_note": "启动时必现",
            "raw_log": "full log..."
        }]
    }}


class CrashPatch(BaseModel):
    app_version: Optional[str] = None
    device_model: Optional[str] = None
    stack_trace: Optional[str] = None
    user_note: Optional[str] = None
    raw_log: Optional[str] = None


class BatchSubmit(BaseModel):
    crashes: List[CrashSubmit]


def _report_to_dict(r: CrashReport) -> dict:
    return {
        "id": r.id,
        "app_version": r.app_version,
        "device_model": r.device_model,
        "stack_trace": r.stack_trace,
        "user_note": r.user_note,
        "normalized_stack": r.normalized_stack,
        "stack_fingerprint": r.stack_fingerprint,
        "version_bucket": r.version_bucket,
        "device_family": r.device_family,
        "cluster_id": r.cluster_id,
        "is_obfuscated": r.is_obfuscated,
        "obfuscated_frames": r.obfuscated_frames,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _cluster_to_dict(c: CrashCluster) -> dict:
    return {
        "id": c.id,
        "fingerprint": c.fingerprint,
        "version_bucket": c.version_bucket,
        "representative_stack": c.representative_stack,
        "crash_count": len(c.crash_ids),
        "crash_ids": c.crash_ids,
        "device_distribution": c.device_distribution,
        "version_distribution": c.version_distribution,
        "obfuscated_count": c.obfuscated_count,
        "first_seen": c.first_seen,
        "last_seen": c.last_seen,
    }


@app.post("/crashes", summary="Submit a single crash report")
def submit_crash(body: CrashSubmit):
    if not any([body.app_version, body.device_model, body.stack_trace, body.raw_log]):
        raise HTTPException(400, "At least one of app_version/device_model/stack_trace/raw_log is required")
    report = CrashReport(
        app_version=body.app_version,
        device_model=body.device_model,
        stack_trace=body.stack_trace,
        user_note=body.user_note,
        raw_log=body.raw_log,
    )
    report = engine.process_report(report)
    store.add_crash(report)
    return {"id": report.id, "status": "created", "crash": _report_to_dict(report)}


@app.post("/crashes/batch", summary="Submit multiple crash reports at once")
def submit_batch(body: BatchSubmit):
    results = []
    for item in body.crashes:
        report = CrashReport(
            app_version=item.app_version,
            device_model=item.device_model,
            stack_trace=item.stack_trace,
            user_note=item.user_note,
            raw_log=item.raw_log,
        )
        report = engine.process_report(report)
        store.add_crash(report)
        results.append({"id": report.id, "status": "created"})
    return {"submitted": len(results), "results": results}


@app.patch("/crashes/{crash_id}", summary="Append data to an existing crash report")
def patch_crash(crash_id: str, body: CrashPatch):
    existing = store.get_crash(crash_id)
    if not existing:
        raise HTTPException(404, f"Crash {crash_id} not found")
    updates = {}
    for k in ["app_version", "device_model", "stack_trace", "user_note", "raw_log"]:
        v = getattr(body, k, None)
        if v is not None:
            updates[k] = v
    if not updates:
        raise HTTPException(400, "No fields to update")
    updated = store.update_crash(crash_id, **updates)
    if "stack_trace" in updates and updated:
        norm, is_obf, obf_frames = normalizer.normalize_stack(updates["stack_trace"])
        updated.normalized_stack = norm
        updated.is_obfuscated = is_obf
        updated.obfuscated_frames = obf_frames
        updated.stack_fingerprint = normalizer.fingerprint(norm)
        store.update_crash(crash_id,
                           normalized_stack=norm,
                           is_obfuscated=is_obf,
                           obfuscated_frames=obf_frames,
                           stack_fingerprint=updated.stack_fingerprint)
    if "app_version" in updates and updated:
        from core.version_device import VersionBucketer
        vb = VersionBucketer.bucket(updates["app_version"])
        updated.version_bucket = vb
        store.update_crash(crash_id, version_bucket=vb)
    if "device_model" in updates and updated:
        from core.version_device import DeviceNormalizer
        df = DeviceNormalizer.family(updates["device_model"])
        updated.device_family = df
        store.update_crash(crash_id, device_family=df)
    return {"id": crash_id, "status": "updated", "crash": _report_to_dict(updated)}


@app.get("/crashes", summary="List crash reports with optional filters")
def list_crashes(
    cluster_id: Optional[str] = Query(None),
    version_bucket: Optional[str] = Query(None),
    device_family: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
):
    crashes = store.list_crashes(cluster_id=cluster_id,
                                  version_bucket=version_bucket,
                                  device_family=device_family,
                                  limit=limit)
    return {"count": len(crashes), "crashes": [_report_to_dict(c) for c in crashes]}


@app.get("/crashes/{crash_id}", summary="Get a single crash report")
def get_crash(crash_id: str):
    r = store.get_crash(crash_id)
    if not r:
        raise HTTPException(404, f"Crash {crash_id} not found")
    return _report_to_dict(r)


@app.post("/clusters/run", summary="Run clustering on all stored crashes")
def run_clustering():
    crashes = list(store.crashes.values())
    if not crashes:
        raise HTTPException(400, "No crash reports to cluster. Submit some first.")
    clusters = engine.cluster(crashes)
    store.replace_clusters(clusters)
    for c in crashes:
        if c.cluster_id:
            pass
    version_issues = engine.detect_version_misclassification(crashes, clusters)
    duplicates = engine.detect_duplicates(crashes)
    return {
        "clusters_found": len(clusters),
        "total_crashes": len(crashes),
        "version_misclassifications": version_issues,
        "duplicates_found": duplicates,
        "clusters": [_cluster_to_dict(c) for c in clusters],
    }


@app.get("/clusters", summary="List clusters with optional filters")
def list_clusters(
    min_count: int = Query(0, ge=0),
    version_bucket: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
):
    clusters = store.list_clusters(min_count=min_count,
                                    version_bucket=version_bucket,
                                    limit=limit)
    return {"count": len(clusters), "clusters": [_cluster_to_dict(c) for c in clusters]}


@app.get("/clusters/{cluster_id}", summary="Get cluster detail with member crashes")
def get_cluster(cluster_id: str):
    c = store.get_cluster(cluster_id)
    if not c:
        raise HTTPException(404, f"Cluster {cluster_id} not found")
    member_crashes = [store.get_crash(cid) for cid in c.crash_ids]
    member_crashes = [m for m in member_crashes if m]
    return {
        **_cluster_to_dict(c),
        "members": [_report_to_dict(m) for m in member_crashes],
    }


@app.get("/trend", summary="Get crash trend over time")
def get_trend(group_by: str = Query("day", regex="^(hour|day|week|month)$")):
    crashes = list(store.crashes.values())
    clusters = list(store.clusters.values())
    return generate_trend(clusters, crashes, group_by=group_by)


@app.get("/report", summary="Export clustering report")
def export_report(fmt: str = Query("json", regex="^(json|csv|markdown)$")):
    crashes = list(store.crashes.values())
    clusters = list(store.clusters.values())
    if not clusters:
        raise HTTPException(400, "No clusters yet. Run POST /clusters/run first.")
    if fmt == "csv":
        return PlainTextResponse(content=export_csv(clusters, crashes),
                                  media_type="text/csv")
    elif fmt == "markdown":
        return PlainTextResponse(content=export_markdown(clusters, crashes),
                                  media_type="text/markdown")
    else:
        return export_json(clusters, crashes)


@app.get("/analysis/duplicates", summary="Detect duplicate stack traces")
def find_duplicates():
    crashes = list(store.crashes.values())
    if not crashes:
        raise HTTPException(400, "No crash reports yet.")
    dups = engine.detect_duplicates(crashes)
    return {"duplicate_groups": len(dups), "duplicates": dups}


@app.get("/analysis/version-issues", summary="Detect version misclassification")
def find_version_issues():
    crashes = list(store.crashes.values())
    clusters = list(store.clusters.values())
    if not clusters:
        raise HTTPException(400, "No clusters yet. Run POST /clusters/run first.")
    issues = engine.detect_version_misclassification(crashes, clusters)
    return {"issue_count": len(issues), "issues": issues}


@app.get("/analysis/obfuscated", summary="List obfuscated crash reports")
def find_obfuscated():
    crashes = [c for c in store.crashes.values() if c.is_obfuscated]
    return {"obfuscated_count": len(crashes), "crashes": [_report_to_dict(c) for c in crashes]}


@app.delete("/crashes", summary="Clear all data (for testing)")
def clear_all():
    store.clear()
    return {"status": "cleared"}


@app.get("/", summary="Service status")
def status():
    return {
        "service": "crash-cluster",
        "crashes": len(store.crashes),
        "clusters": len(store.clusters),
        "endpoints": [
            "POST /crashes          - Submit crash",
            "POST /crashes/batch    - Batch submit",
            "PATCH /crashes/{id}    - Append data to crash",
            "GET  /crashes          - List crashes",
            "GET  /crashes/{id}     - Get crash detail",
            "POST /clusters/run     - Run clustering",
            "GET  /clusters         - List clusters",
            "GET  /clusters/{id}    - Cluster detail + members",
            "GET  /trend            - Trend data",
            "GET  /report           - Export report (json/csv/markdown)",
            "GET  /analysis/duplicates    - Find duplicates",
            "GET  /analysis/version-issues - Find version problems",
            "GET  /analysis/obfuscated    - Find obfuscated stacks",
        ],
    }
