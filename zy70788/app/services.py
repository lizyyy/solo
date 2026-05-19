import json
import uuid
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.config import settings
from app.database import WebhookFixture, FixtureException, RecordingReport, FixtureStatus, FixtureExceptionType
from app.schemas import FixtureCreate, FixtureManualFix, ExceptionCreate


def generate_fixture_id() -> str:
    return f"fixture_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"


def normalize_payload(payload: str) -> str:
    try:
        data = json.loads(payload)
        return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    except json.JSONDecodeError:
        return payload


def compute_payload_hash(payload: str) -> str:
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def create_fixture_directory(fixture_id: str) -> Path:
    fixture_dir = settings.FIXTURE_DIR / fixture_id
    fixture_dir.mkdir(parents=True, exist_ok=True)
    return fixture_dir


def save_signature_material(fixture_dir: Path, signature_headers: Dict[str, Any], raw_payload: str) -> None:
    sig_file = fixture_dir / "signature_headers.json"
    sig_file.write_text(json.dumps(signature_headers, indent=2, ensure_ascii=False))

    payload_file = fixture_dir / "raw_payload.txt"
    payload_file.write_text(raw_payload)

    normalized = normalize_payload(raw_payload)
    normalized_file = fixture_dir / "normalized_payload.txt"
    normalized_file.write_text(normalized)

    hash_file = fixture_dir / "payload_hash.sha256"
    hash_file.write_text(compute_payload_hash(normalized))


def parse_request_headers(headers: Dict[str, Any]) -> Dict[str, str]:
    return {str(k): str(v) for k, v in headers.items()}


def create_fixture(db: Session, fixture_data: FixtureCreate) -> WebhookFixture:
    fixture_id = generate_fixture_id()
    fixture_dir = create_fixture_directory(fixture_id)

    fixture = WebhookFixture(
        fixture_id=fixture_id,
        request_method=fixture_data.request_method,
        request_url=fixture_data.request_url,
        request_headers=parse_request_headers(fixture_data.request_headers),
        signature_headers=fixture_data.signature_headers,
        raw_payload=fixture_data.raw_payload,
        normalized_payload=normalize_payload(fixture_data.raw_payload),
        timestamp=fixture_data.timestamp or datetime.utcnow(),
        status=FixtureStatus.RECORDED,
        fixture_directory=str(fixture_dir),
        handler=fixture_data.handler
    )

    save_signature_material(fixture_dir, fixture_data.signature_headers, fixture_data.raw_payload)

    db.add(fixture)
    db.commit()
    db.refresh(fixture)
    return fixture


def get_fixture_by_id(db: Session, fixture_id: str) -> Optional[WebhookFixture]:
    return db.query(WebhookFixture).filter(WebhookFixture.fixture_id == fixture_id).first()


def get_all_fixtures(db: Session, skip: int = 0, limit: int = 100, status: Optional[FixtureStatus] = None):
    query = db.query(WebhookFixture)
    if status:
        query = query.filter(WebhookFixture.status == status)
    return query.order_by(WebhookFixture.created_at.desc()).offset(skip).limit(limit).all()


def update_fixture_status(db: Session, fixture_id: str, status: FixtureStatus, handler: Optional[str] = None) -> Optional[WebhookFixture]:
    fixture = get_fixture_by_id(db, fixture_id)
    if not fixture:
        return None

    fixture.status = status
    if handler:
        fixture.handler = handler
    fixture.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(fixture)
    return fixture


def manual_fix_fixture(db: Session, fixture_id: str, fix_data: FixtureManualFix) -> Optional[WebhookFixture]:
    fixture = get_fixture_by_id(db, fixture_id)
    if not fixture:
        return None

    if fix_data.signature_headers is not None:
        fixture.signature_headers = fix_data.signature_headers

    if fix_data.raw_payload is not None:
        fixture.raw_payload = fix_data.raw_payload
        fixture.normalized_payload = normalize_payload(fix_data.raw_payload)
    elif fix_data.normalized_payload is not None:
        fixture.normalized_payload = fix_data.normalized_payload

    if fix_data.handler:
        fixture.handler = fix_data.handler

    fixture.status = FixtureStatus.NORMALIZED
    fixture.updated_at = datetime.utcnow()

    if fixture.fixture_directory:
        fixture_dir = Path(fixture.fixture_directory)
        if fixture_dir.exists():
            save_signature_material(fixture_dir, fixture.signature_headers, fixture.raw_payload)

    exception = FixtureException(
        fixture_id=fixture.id,
        exception_type=FixtureExceptionType.OTHER,
        raw_input=json.dumps(fix_data.model_dump(), ensure_ascii=False),
        handler=fix_data.handler,
        conclusion=f"人工修正: {fix_data.conclusion}",
        resolved=True,
        resolved_at=datetime.utcnow()
    )
    db.add(exception)

    db.commit()
    db.refresh(fixture)
    return fixture


def withdraw_fixture(db: Session, fixture_id: str, handler: str, conclusion: str) -> Optional[WebhookFixture]:
    fixture = get_fixture_by_id(db, fixture_id)
    if not fixture:
        return None

    fixture.status = FixtureStatus.WITHDRAWN
    fixture.handler = handler
    fixture.updated_at = datetime.utcnow()

    exception = FixtureException(
        fixture_id=fixture.id,
        exception_type=FixtureExceptionType.OTHER,
        raw_input="withdraw",
        handler=handler,
        conclusion=f"撤回: {conclusion}",
        resolved=True,
        resolved_at=datetime.utcnow()
    )
    db.add(exception)

    db.commit()
    db.refresh(fixture)
    return fixture


def close_fixture(db: Session, fixture_id: str, handler: str) -> Optional[WebhookFixture]:
    fixture = get_fixture_by_id(db, fixture_id)
    if not fixture:
        return None

    fixture.status = FixtureStatus.CLOSED
    fixture.handler = handler
    fixture.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(fixture)
    return fixture


def add_exception(db: Session, fixture_id: int, exception_data: ExceptionCreate) -> FixtureException:
    exception = FixtureException(
        fixture_id=fixture_id,
        exception_type=exception_data.exception_type,
        raw_input=exception_data.raw_input,
        handler=exception_data.handler,
        conclusion=exception_data.conclusion
    )
    db.add(exception)
    db.commit()
    db.refresh(exception)
    return exception


def resolve_exception(db: Session, exception_id: int, conclusion: str, handler: str) -> Optional[FixtureException]:
    exception = db.query(FixtureException).filter(FixtureException.id == exception_id).first()
    if not exception:
        return None

    exception.resolved = True
    exception.resolved_at = datetime.utcnow()
    exception.conclusion = conclusion
    exception.handler = handler

    db.commit()
    db.refresh(exception)
    return exception


def generate_replay_script_content(fixture: WebhookFixture, target_url: Optional[str] = None) -> str:
    url = target_url or fixture.request_url
    fixture_id_val = fixture.fixture_id
    created_at_val = fixture.created_at.isoformat()
    request_method_val = fixture.request_method
    raw_payload_val = fixture.raw_payload
    
    headers_json = json.dumps(fixture.request_headers, indent=2, ensure_ascii=False)
    signature_headers_json = json.dumps(fixture.signature_headers, indent=2, ensure_ascii=False)

    script_lines = [
        '#!/usr/bin/env python3',
        '"""',
        f'Webhook 重放脚本',
        f'夹具ID: {fixture_id_val}',
        f'创建时间: {created_at_val}',
        '"""',
        '',
        'import httpx',
        'import json',
        '',
        f'FIXTURE_ID = "{fixture_id_val}"',
        f'TARGET_URL = "{url}"',
        f'RESPONSE_METHOD = "{request_method_val}"',
        '',
        f'RESPONSE_HEADERS = {headers_json}',
        '',
        f'SIGNATURE_HEADERS = {signature_headers_json}',
        '',
        'RAW_PAYLOAD = r"""',
        f'{raw_payload_val}',
        '"""',
        '',
        '',
        'def main():',
        '    print("=== 重放夹具: {} ===".format(FIXTURE_ID))',
        '    print("目标URL: {}".format(TARGET_URL))',
        '    print("请求方法: {}".format(RESPONSE_METHOD))',
        '    ',
        '    all_headers = {**RESPONSE_HEADERS, **SIGNATURE_HEADERS}',
        '    ',
        '    print("\\n请求头:")',
        '    for k, v in all_headers.items():',
        '        print("  {}: {}".format(k, v))',
        '    ',
        '    print("\\n载荷:")',
        '    print(RAW_PAYLOAD)',
        '    ',
        '    try:',
        '        response = httpx.request(',
        '            method=RESPONSE_METHOD,',
        '            url=TARGET_URL,',
        '            headers=all_headers,',
        '            content=RAW_PAYLOAD.encode("utf-8"),',
        '            timeout=30',
        '        )',
        '        print("\\n=== 响应 ===")',
        '        print("状态码: {}".format(response.status_code))',
        '        print("响应头: {}".format(dict(response.headers)))',
        '        print("响应体: {}".format(response.text))',
        '    except Exception as e:',
        '        print("\\n重放失败: {}".format(e))',
        '',
        '',
        'if __name__ == "__main__":',
        '    main()',
    ]
    return '\n'.join(script_lines)


def save_replay_script(fixture: WebhookFixture, target_url: Optional[str] = None) -> str:
    script_content = generate_replay_script_content(fixture, target_url)
    fixture_dir = Path(fixture.fixture_directory) if fixture.fixture_directory else settings.FIXTURE_DIR
    script_path = fixture_dir / f"replay_{fixture.fixture_id}.py"
    script_path.write_text(script_content, encoding='utf-8')
    return str(script_path)


def generate_report_content(fixture: WebhookFixture) -> str:
    exceptions = [
        {
            "type": e.exception_type,
            "handler": e.handler,
            "conclusion": e.conclusion,
            "resolved": e.resolved,
            "created_at": e.created_at.isoformat()
        }
        for e in fixture.exceptions
    ]

    report = {
        "fixture_id": fixture.fixture_id,
        "status": fixture.status,
        "request_method": fixture.request_method,
        "request_url": fixture.request_url,
        "timestamp": fixture.timestamp.isoformat(),
        "handler": fixture.handler,
        "created_at": fixture.created_at.isoformat(),
        "updated_at": fixture.updated_at.isoformat(),
        "fixture_directory": fixture.fixture_directory,
        "signature_headers": fixture.signature_headers,
        "payload_hash": compute_payload_hash(fixture.normalized_payload or fixture.raw_payload),
        "exceptions_count": len(exceptions),
        "exceptions": exceptions
    }
    return json.dumps(report, indent=2, ensure_ascii=False)


def create_recording_report(db: Session, fixture_id: str) -> Optional[RecordingReport]:
    fixture = get_fixture_by_id(db, fixture_id)
    if not fixture:
        return None

    script_path = save_replay_script(fixture)
    report_content = generate_report_content(fixture)

    report = RecordingReport(
        fixture_id=fixture.id,
        report_content=report_content,
        replay_script_path=script_path,
        created_at=datetime.utcnow()
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    report_file = settings.REPORT_DIR / f"report_{fixture.fixture_id}.json"
    report_file.write_text(report_content, encoding='utf-8')

    return report


def export_fixture_data(fixture: WebhookFixture) -> Dict[str, Any]:
    return {
        "fixture_id": fixture.fixture_id,
        "request_method": fixture.request_method,
        "request_url": fixture.request_url,
        "request_headers": fixture.request_headers,
        "signature_headers": fixture.signature_headers,
        "raw_payload": fixture.raw_payload,
        "normalized_payload": fixture.normalized_payload,
        "timestamp": fixture.timestamp.isoformat(),
        "status": fixture.status,
        "handler": fixture.handler,
        "created_at": fixture.created_at.isoformat(),
        "updated_at": fixture.updated_at.isoformat(),
        "exceptions": [
            {
                "type": e.exception_type,
                "raw_input": e.raw_input,
                "handler": e.handler,
                "conclusion": e.conclusion,
                "resolved": e.resolved,
                "created_at": e.created_at.isoformat()
            }
            for e in fixture.exceptions
        ]
    }
