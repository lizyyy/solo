from flask import Flask, request, jsonify
from datetime import datetime
from database import init_db, db
from models import LectureWaitlist, WaitlistStatus, AdmissionType, DataSource
from exceptions import (
    WaitlistAPIException,
    RecordConflictException,
    VersionMismatchException,
    WaitlistOrderConflictException,
    ManualAdmissionConflictException,
    DuplicateReaderException,
    InvalidDataException,
    RecordNotFoundException
)

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///lecture_waitlist.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

init_db(app)


@app.errorhandler(WaitlistAPIException)
def handle_waitlist_exception(e):
    response = jsonify(e.to_dict())
    response.status_code = e.status_code
    return response


def validate_waitlist_data(data):
    required_fields = [
        "lecture_id", "lecture_title", "lecture_date", "lecture_venue",
        "reader_id", "reader_name", "reader_phone", "waitlist_number"
    ]
    missing = [f for f in required_fields if f not in data or not data[f]]
    if missing:
        raise InvalidDataException(
            "缺少必填字段",
            field_errors={f: "此字段为必填项" for f in missing}
        )

    try:
        datetime.fromisoformat(data["lecture_date"].replace("Z", "+00:00"))
    except (ValueError, TypeError):
        raise InvalidDataException(
            "讲座日期格式无效",
            field_errors={"lecture_date": "请使用 ISO 8601 格式，如 2024-01-15T14:00:00"}
        )

    if not isinstance(data["waitlist_number"], int) or data["waitlist_number"] < 1:
        raise InvalidDataException(
            "候补序号必须为正整数",
            field_errors={"waitlist_number": "必须为大于等于 1 的整数"}
        )

    if len(data["reader_phone"]) < 7 or not data["reader_phone"].replace("-", "").isdigit():
        raise InvalidDataException(
            "手机号格式无效",
            field_errors={"reader_phone": "请输入有效的电话号码"}
        )

    return True


@app.route("/api/waitlist", methods=["GET"])
def get_waitlist():
    lecture_id = request.args.get("lecture_id")
    status = request.args.get("status")

    query = LectureWaitlist.query

    if lecture_id:
        query = query.filter_by(lecture_id=lecture_id)
    if status:
        query = query.filter_by(status=WaitlistStatus(status))

    records = query.order_by(LectureWaitlist.lecture_id, LectureWaitlist.waitlist_number).all()

    return jsonify({
        "success": True,
        "data": [r.to_dict() for r in records],
        "total": len(records)
    })


@app.route("/api/waitlist/<int:record_id>", methods=["GET"])
def get_waitlist_record(record_id):
    record = LectureWaitlist.query.get(record_id)
    if not record:
        raise RecordNotFoundException("候补记录不存在", record_id=record_id)

    return jsonify({
        "success": True,
        "data": record.to_dict()
    })


@app.route("/api/waitlist", methods=["POST"])
def create_waitlist():
    data = request.get_json()
    validate_waitlist_data(data)

    existing = LectureWaitlist.query.filter_by(
        lecture_id=data["lecture_id"],
        reader_id=data["reader_id"]
    ).first()
    if existing:
        raise DuplicateReaderException(
            "该读者已在此讲座的候补名单中",
            lecture_id=data["lecture_id"],
            reader_id=data["reader_id"]
        )

    same_position = LectureWaitlist.query.filter_by(
        lecture_id=data["lecture_id"],
        waitlist_number=data["waitlist_number"]
    ).all()
    if same_position:
        raise WaitlistOrderConflictException(
            f"讲座 {data['lecture_id']} 中候补序号 {data['waitlist_number']} 已被占用",
            lecture_id=data["lecture_id"],
            waitlist_number=data["waitlist_number"],
            existing_readers=same_position
        )

    new_record = LectureWaitlist(
        lecture_id=data["lecture_id"],
        lecture_title=data["lecture_title"],
        lecture_date=datetime.fromisoformat(data["lecture_date"].replace("Z", "+00:00")),
        lecture_venue=data["lecture_venue"],
        reader_id=data["reader_id"],
        reader_name=data["reader_name"],
        reader_phone=data["reader_phone"],
        reader_department=data.get("reader_department"),
        waitlist_number=data["waitlist_number"],
        status=WaitlistStatus(data.get("status", "waiting")),
        data_source=DataSource(data.get("data_source", "system")),
        source_note=data.get("source_note")
    )

    if data.get("waitlist_time"):
        new_record.waitlist_time = datetime.fromisoformat(data["waitlist_time"].replace("Z", "+00:00"))

    db.session.add(new_record)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "候补记录创建成功",
        "data": new_record.to_dict()
    }), 201


@app.route("/api/waitlist/<int:record_id>", methods=["PUT"])
def update_waitlist(record_id):
    data = request.get_json()
    record = LectureWaitlist.query.get(record_id)

    if not record:
        raise RecordNotFoundException("候补记录不存在", record_id=record_id)

    if "version" in data and data["version"] != record.version:
        raise VersionMismatchException(
            "版本不匹配，该记录已被他人修改，请刷新后重试",
            expected_version=data["version"],
            actual_version=record.version
        )

    if "waitlist_number" in data:
        same_position = LectureWaitlist.query.filter(
            LectureWaitlist.lecture_id == record.lecture_id,
            LectureWaitlist.waitlist_number == data["waitlist_number"],
            LectureWaitlist.id != record_id
        ).all()
        if same_position:
            raise WaitlistOrderConflictException(
                f"该讲座中候补序号 {data['waitlist_number']} 已被占用",
                lecture_id=record.lecture_id,
                waitlist_number=data["waitlist_number"],
                existing_readers=same_position
            )
        record.waitlist_number = data["waitlist_number"]

    if "status" in data:
        record.status = WaitlistStatus(data["status"])
    if "admission_type" in data:
        record.admission_type = AdmissionType(data["admission_type"])
    if "admission_time" in data:
        record.admission_time = datetime.fromisoformat(data["admission_time"].replace("Z", "+00:00"))
    if "admission_operator" in data:
        record.admission_operator = data["admission_operator"]
    if "admission_remark" in data:
        record.admission_remark = data["admission_remark"]
    if "source_note" in data:
        record.source_note = data["source_note"]
    if "reader_name" in data:
        record.reader_name = data["reader_name"]
    if "reader_phone" in data:
        record.reader_phone = data["reader_phone"]
    if "reader_department" in data:
        record.reader_department = data["reader_department"]

    record.version += 1
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "候补记录更新成功",
        "data": record.to_dict()
    })


@app.route("/api/waitlist/<int:record_id>/admit", methods=["POST"])
def admit_reader(record_id):
    data = request.get_json()
    record = LectureWaitlist.query.get(record_id)

    if not record:
        raise RecordNotFoundException("候补记录不存在", record_id=record_id)

    if record.status in [WaitlistStatus.ADMITTED, WaitlistStatus.CANCELLED]:
        raise ManualAdmissionConflictException(
            f"无法入场，当前状态为 {record.status.value}",
            lecture_id=record.lecture_id,
            reader_id=record.reader_id,
            current_status=record.status
        )

    if "version" in data and data["version"] != record.version:
        raise VersionMismatchException(
            "版本不匹配，该记录已被他人修改，请刷新后重试",
            expected_version=data["version"],
            actual_version=record.version
        )

    record.status = WaitlistStatus.ADMITTED
    record.admission_type = AdmissionType(data.get("admission_type", "manual_admission"))
    record.admission_time = datetime.now()
    record.admission_operator = data.get("operator", "system")
    record.admission_remark = data.get("remark", "主办方手工放人")
    record.version += 1

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "读者入场成功",
        "data": record.to_dict()
    })


@app.route("/api/waitlist/<int:record_id>", methods=["DELETE"])
def delete_waitlist(record_id):
    record = LectureWaitlist.query.get(record_id)
    if not record:
        raise RecordNotFoundException("候补记录不存在", record_id=record_id)

    db.session.delete(record)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "候补记录删除成功"
    })


@app.route("/api/waitlist/import", methods=["POST"])
def import_waitlist():
    data = request.get_json()
    records = data.get("records", [])
    operator = data.get("operator", "system")

    success_count = 0
    error_count = 0
    errors = []

    for idx, record_data in enumerate(records):
        try:
            validate_waitlist_data(record_data)

            existing = LectureWaitlist.query.filter_by(
                lecture_id=record_data["lecture_id"],
                reader_id=record_data["reader_id"]
            ).first()

            if existing:
                raise RecordConflictException(
                    f"第 {idx + 1} 行：该读者已在此讲座候补名单中，不能静默覆盖",
                    existing_record=existing,
                    conflicting_data=record_data
                )

            new_record = LectureWaitlist(
                lecture_id=record_data["lecture_id"],
                lecture_title=record_data["lecture_title"],
                lecture_date=datetime.fromisoformat(record_data["lecture_date"].replace("Z", "+00:00")),
                lecture_venue=record_data["lecture_venue"],
                reader_id=record_data["reader_id"],
                reader_name=record_data["reader_name"],
                reader_phone=record_data["reader_phone"],
                reader_department=record_data.get("reader_department"),
                waitlist_number=record_data["waitlist_number"],
                status=WaitlistStatus(record_data.get("status", "waiting")),
                data_source=DataSource(record_data.get("data_source", "spreadsheet")),
                source_note=record_data.get("source_note", f"批量导入，操作人：{operator}")
            )

            db.session.add(new_record)
            db.session.flush()
            success_count += 1

        except WaitlistAPIException as e:
            error_count += 1
            errors.append({
                "row": idx + 1,
                "error_code": e.error_code,
                "message": e.message,
                "details": e.details
            })
            db.session.rollback()
        except Exception as e:
            error_count += 1
            errors.append({
                "row": idx + 1,
                "error_code": "UNKNOWN_ERROR",
                "message": str(e)
            })
            db.session.rollback()

    db.session.commit()

    return jsonify({
        "success": True,
        "summary": {
            "total": len(records),
            "success": success_count,
            "failed": error_count
        },
        "errors": errors
    })


@app.route("/api/waitlist/export", methods=["GET"])
def export_waitlist():
    lecture_id = request.args.get("lecture_id")
    query = LectureWaitlist.query

    if lecture_id:
        query = query.filter_by(lecture_id=lecture_id)

    records = query.order_by(LectureWaitlist.lecture_id, LectureWaitlist.waitlist_number).all()

    return jsonify({
        "success": True,
        "export_time": datetime.now().isoformat(),
        "total_records": len(records),
        "data": [r.to_dict() for r in records]
    })


@app.route("/api/lectures/<lecture_id>/waitlist/consistency-check", methods=["GET"])
def consistency_check(lecture_id):
    records = LectureWaitlist.query.filter_by(lecture_id=lecture_id).order_by(LectureWaitlist.waitlist_number).all()

    if not records:
        return jsonify({
            "success": True,
            "lecture_id": lecture_id,
            "consistent": True,
            "message": "该讲座暂无候补记录"
        })

    issues = []

    expected_numbers = set(range(1, len(records) + 1))
    actual_numbers = set(r.waitlist_number for r in records)

    missing = expected_numbers - actual_numbers
    duplicates = [n for n in actual_numbers if list(r.waitlist_number for r in records).count(n) > 1]

    if missing:
        issues.append({
            "type": "MISSING_WAITLIST_NUMBER",
            "message": f"缺少候补序号: {sorted(missing)}",
            "missing_numbers": sorted(missing)
        })

    if duplicates:
        dup_details = []
        for n in duplicates:
            readers = [r for r in records if r.waitlist_number == n]
            dup_details.append({
                "waitlist_number": n,
                "readers": [{"reader_id": r.reader_id, "reader_name": r.reader_name} for r in readers]
            })
        issues.append({
            "type": "DUPLICATE_WAITLIST_NUMBER",
            "message": f"候补序号重复: {duplicates}",
            "details": dup_details
        })

    admitted_records = [r for r in records if r.status == WaitlistStatus.ADMITTED]
    for admitted in admitted_records:
        if not admitted.admission_type or not admitted.admission_time:
            issues.append({
                "type": "INCOMPLETE_ADMISSION_INFO",
                "message": f"读者 {admitted.reader_name} 已入场但缺少入场信息",
                "reader_id": admitted.reader_id,
                "reader_name": admitted.reader_name
            })

    return jsonify({
        "success": True,
        "lecture_id": lecture_id,
        "consistent": len(issues) == 0,
        "total_records": len(records),
        "issues": issues
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
