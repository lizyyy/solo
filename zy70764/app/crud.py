from sqlalchemy.orm import Session
from sqlalchemy import func
from app import models, schemas
from app.parser import PostmanParser
import json
from datetime import datetime


def create_collection(db: Session, collection_data: dict):
    parser = PostmanParser()
    collection_info, requests = parser.parse_collection(collection_data)

    db_collection = models.Collection(
        name=collection_info['name'],
        postman_id=collection_info['postman_id'],
        schema_version=collection_info['schema_version'],
        raw_content=collection_info['raw_content'],
        total_requests=len(requests),
        status="analyzed"
    )
    db.add(db_collection)
    db.flush()

    requests_with_assertions = 0
    requests_with_examples = 0

    for req_data in requests:
        db_request = models.Request(
            collection_id=db_collection.id,
            name=req_data['name'],
            method=req_data['method'],
            url=req_data['url'],
            path=req_data['path'],
            folder_path=req_data['folder_path'],
            has_assertions=req_data['has_assertions'],
            has_examples=req_data['has_examples'],
            assertion_count=req_data['assertion_count'],
            example_count=req_data['example_count'],
            raw_request=req_data['raw_request'],
            status="pending" if not req_data['has_assertions'] or not req_data['has_examples'] else "completed"
        )
        db.add(db_request)
        db.flush()

        if req_data['has_assertions']:
            requests_with_assertions += 1
        if req_data['has_examples']:
            requests_with_examples += 1

        for assertion_data in req_data['assertions']:
            db_assertion = models.Assertion(
                request_id=db_request.id,
                type=assertion_data['type'],
                content=assertion_data['content'],
                line_number=assertion_data['line_number'],
                is_valid=assertion_data['is_valid']
            )
            db.add(db_assertion)

        for example_data in req_data['examples']:
            db_example = models.Example(
                request_id=db_request.id,
                name=example_data['name'],
                status_code=example_data['status_code'],
                content_type=example_data['content_type'],
                body=example_data['body'],
                raw_example=example_data['raw_example']
            )
            db.add(db_example)

        for variable_data in req_data['variables']:
            db_variable = models.VariableReference(
                request_id=db_request.id,
                name=variable_data['name'],
                context=variable_data['context'],
                line_number=variable_data['line_number'],
                is_resolved=variable_data['is_resolved']
            )
            db.add(db_variable)

    db_collection.requests_with_assertions = requests_with_assertions
    db_collection.requests_with_examples = requests_with_examples

    db.commit()
    db.refresh(db_collection)
    return db_collection


def get_collection(db: Session, collection_id: int):
    return db.query(models.Collection).filter(models.Collection.id == collection_id).first()


def get_collections(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Collection).order_by(models.Collection.created_at.desc()).offset(skip).limit(limit).all()


def delete_collection(db: Session, collection_id: int):
    db_collection = get_collection(db, collection_id)
    if db_collection:
        db.delete(db_collection)
        db.commit()
    return db_collection


def get_request(db: Session, request_id: int):
    return db.query(models.Request).filter(models.Request.id == request_id).first()


def get_requests_by_collection(db: Session, collection_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Request).filter(models.Request.collection_id == collection_id).offset(skip).limit(limit).all()


def get_requests_without_assertions(db: Session, collection_id: int):
    return db.query(models.Request).filter(
        models.Request.collection_id == collection_id,
        models.Request.has_assertions == False
    ).all()


def get_requests_without_examples(db: Session, collection_id: int):
    return db.query(models.Request).filter(
        models.Request.collection_id == collection_id,
        models.Request.has_examples == False
    ).all()


def update_request_status(db: Session, request_id: int, status_update: schemas.StatusUpdate):
    db_request = get_request(db, request_id)
    if not db_request:
        return None

    previous_status = db_request.status
    db_request.status = status_update.new_status

    audit_log = models.AuditLog(
        request_id=request_id,
        action="status_update",
        previous_status=previous_status,
        new_status=status_update.new_status,
        handler=status_update.handler,
        conclusion=status_update.conclusion,
        raw_input=status_update.raw_input
    )
    db.add(audit_log)
    db.commit()
    db.refresh(db_request)
    return db_request


def get_coverage_stats(db: Session, collection_id: int):
    db_collection = get_collection(db, collection_id)
    if not db_collection:
        return None

    total_requests = db_collection.total_requests

    if total_requests == 0:
        assertion_coverage = 0.0
        example_coverage = 0.0
    else:
        assertion_coverage = (db_collection.requests_with_assertions / total_requests) * 100
        example_coverage = (db_collection.requests_with_examples / total_requests) * 100

    requests_without_assertions = total_requests - db_collection.requests_with_assertions
    requests_without_examples = total_requests - db_collection.requests_with_examples

    total_variables = db.query(models.VariableReference).join(models.Request).filter(
        models.Request.collection_id == collection_id
    ).count()

    unresolved_variables = db.query(models.VariableReference).join(models.Request).filter(
        models.Request.collection_id == collection_id,
        models.VariableReference.is_resolved == False
    ).count()

    return schemas.CoverageStats(
        collection_id=collection_id,
        collection_name=db_collection.name,
        total_requests=total_requests,
        assertion_coverage=round(assertion_coverage, 2),
        example_coverage=round(example_coverage, 2),
        requests_without_assertions=requests_without_assertions,
        requests_without_examples=requests_without_examples,
        total_variables=total_variables,
        unresolved_variables=unresolved_variables
    )


def create_report(db: Session, collection_id: int, report_type: str, generated_by: str):
    stats = get_coverage_stats(db, collection_id)
    if not stats:
        return None

    requests_without_assertions = get_requests_without_assertions(db, collection_id)
    requests_without_examples = get_requests_without_examples(db, collection_id)

    report_content = {
        "stats": stats.dict(),
        "requests_without_assertions": [
            {"id": r.id, "name": r.name, "method": r.method, "path": r.path, "folder_path": r.folder_path}
            for r in requests_without_assertions
        ],
        "requests_without_examples": [
            {"id": r.id, "name": r.name, "method": r.method, "path": r.path, "folder_path": r.folder_path}
            for r in requests_without_examples
        ],
        "generated_at": datetime.now().isoformat()
    }

    db_report = models.Report(
        collection_id=collection_id,
        type=report_type,
        content=report_content,
        generated_by=generated_by
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_report(db: Session, report_id: int):
    return db.query(models.Report).filter(models.Report.id == report_id).first()


def get_reports_by_collection(db: Session, collection_id: int):
    return db.query(models.Report).filter(models.Report.collection_id == collection_id).order_by(
        models.Report.created_at.desc()
    ).all()


def get_audit_logs_by_request(db: Session, request_id: int):
    return db.query(models.AuditLog).filter(models.AuditLog.request_id == request_id).order_by(
        models.AuditLog.created_at.desc()
    ).all()


def create_environment(db: Session, name: str, postman_id: str, variables: dict):
    db_env = models.Environment(
        name=name,
        postman_id=postman_id,
        variables=variables
    )
    db.add(db_env)
    db.commit()
    db.refresh(db_env)
    return db_env


def get_environments(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Environment).order_by(models.Environment.created_at.desc()).offset(skip).limit(limit).all()
