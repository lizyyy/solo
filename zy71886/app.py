import json
import csv
import io
import copy
from datetime import datetime
from flask import Flask, jsonify, request, render_template, Response, session

from models import ExperimentRecord, CalibrationEntry, DataPackage
from errors import UserError, humanize
from drift import detect_drift

app = Flask(__name__)
app.secret_key = "heat-conduction-lab-2026"

_store = {
    "records": [],
    "calibrations": [],
    "errors": [],
    "warnings": [],
    "drifts": [],
    "filter_state": {},
    "loaded": False,
}


def _reset_store():
    _store["records"] = []
    _store["calibrations"] = []
    _store["errors"] = []
    _store["warnings"] = []
    _store["drifts"] = []
    _store["filter_state"] = {}
    _store["loaded"] = False


def _ingest_package(pkg_data):
    _reset_store()

    records_raw = pkg_data.get("records", [])
    calibrations_raw = pkg_data.get("calibrations", [])
    pkg_name = pkg_data.get("package_name", "unknown")

    calibrations = []
    for i, c in enumerate(calibrations_raw):
        try:
            entry = CalibrationEntry(
                sample_id=str(c["sample_id"]),
                temperature_ref=float(c["temperature_ref"]),
                thermal_conductivity_ref=float(c["thermal_conductivity_ref"]),
                unit=c.get("unit", "°C"),
                calibration_date=c.get("calibration_date", ""),
                version=c.get("version", ""),
                operator=c.get("operator", ""),
            )
        except (KeyError, ValueError) as e:
            _store["errors"].append(
                humanize("INVALID_VALUE", line=i + 1, field=str(e), value=c)
            )
            continue
        calibrations.append(entry)

    _store["calibrations"] = calibrations

    cal_units = {c.sample_id: c.unit for c in calibrations}

    seen = {}
    records = []

    late_attachments = []
    corrections = []

    for i, r in enumerate(records_raw):
        try:
            rec = ExperimentRecord(
                id=str(r["id"]),
                sample_id=str(r["sample_id"]),
                timestamp=r.get("timestamp", ""),
                temperature=float(r["temperature"]),
                thermal_conductivity=float(r["thermal_conductivity"]),
                unit=r.get("unit", "°C"),
                source=r.get("source", "experiment"),
                is_correction=r.get("is_correction", False),
                is_late_attachment=r.get("is_late_attachment", False),
                corrected_record_id=r.get("corrected_record_id"),
                operator=r.get("operator", ""),
                batch_id=r.get("batch_id", ""),
                notes=r.get("notes", ""),
            )
        except (KeyError, ValueError) as e:
            _store["errors"].append(
                humanize("MISSING_FIELD", line=i + 1, field=str(e))
            )
            continue

        expected_unit = cal_units.get(rec.sample_id, "°C")
        if rec.unit != expected_unit:
            _store["errors"].append(
                humanize(
                    "UNIT_MISMATCH",
                    line=i + 1,
                    actual_unit=rec.unit,
                    expected_unit=expected_unit,
                )
            )
            _convert_unit(rec, expected_unit)

        if rec.is_late_attachment:
            late_attachments.append(rec)
            _store["warnings"].append(
                humanize(
                    "LATE_ATTACHMENT",
                    filename=f"记录{rec.id}",
                )
            )
            continue

        if rec.is_correction:
            corrections.append(rec)
            continue

        key = f"{rec.sample_id}|{rec.timestamp}"
        if key in seen:
            _store["warnings"].append(
                humanize(
                    "DUPLICATE_RECORD",
                    sample_id=rec.sample_id,
                    timestamp=rec.timestamp,
                )
            )
            continue

        seen[key] = len(records)
        records.append(rec)

    for la in late_attachments:
        key = f"{la.sample_id}|{la.timestamp}"
        if key in seen:
            _store["warnings"].append(
                humanize(
                    "DUPLICATE_RECORD",
                    sample_id=la.sample_id,
                    timestamp=la.timestamp,
                )
            )
            continue
        seen[key] = len(records)
        records.append(la)

    records.sort(key=lambda x: x.timestamp)

    for corr in corrections:
        target_id = corr.corrected_record_id
        found = False
        for idx, rec in enumerate(records):
            if rec.id == target_id:
                old_tc = rec.thermal_conductivity
                old_temp = rec.temperature
                rec.original_temperature = old_temp
                rec.original_tc = old_tc
                rec.temperature = corr.temperature
                rec.thermal_conductivity = corr.thermal_conductivity
                rec.is_correction = True
                rec.notes = corr.notes or f"人工更正: {old_tc}→{corr.thermal_conductivity}"
                _store["warnings"].append(
                    humanize(
                        "CORRECTION_APPLIED",
                        sample_id=corr.sample_id,
                        timestamp=corr.timestamp,
                        old_value=f"{old_tc:.4f}",
                        new_value=f"{corr.thermal_conductivity:.4f}",
                    )
                )
                found = True
                break
        if not found:
            records.append(corr)

    _store["records"] = records

    drifts = detect_drift(records, calibrations)
    _store["drifts"] = drifts
    for d in drifts:
        _store["warnings"].append(d.message)

    _store["loaded"] = True
    _store["filter_state"] = {"package_name": pkg_name}

    return {
        "record_count": len(records),
        "calibration_count": len(calibrations),
        "error_count": len(_store["errors"]),
        "warning_count": len(_store["warnings"]),
        "drift_count": len(drifts),
    }


def _convert_unit(record, target_unit):
    if record.unit == "°F" and target_unit == "°C":
        record.temperature = (record.temperature - 32) * 5 / 9
        record.unit = "°C"
    elif record.unit == "K" and target_unit == "°C":
        record.temperature = record.temperature - 273.15
        record.unit = "°C"
    elif record.unit == "W/(m·K)" and target_unit == "W/(cm·K)":
        record.thermal_conductivity = record.thermal_conductivity / 100
        record.unit = "W/(cm·K)"


def _apply_filters(records, filters):
    filtered = records
    if filters.get("sample_id"):
        filtered = [r for r in filtered if r.sample_id == filters["sample_id"]]
    if filters.get("batch_id"):
        filtered = [r for r in filtered if r.batch_id == filters["batch_id"]]
    if filters.get("source"):
        filtered = [r for r in filtered if r.source == filters["source"]]
    if filters.get("exclude_corrections"):
        filtered = [r for r in filtered if not r.is_correction]
    return filtered


def _compute_axis_range(records):
    if not records:
        return {"x_min": 0, "x_max": 100, "y_min": 0, "y_max": 1}
    temps = [r.temperature for r in records]
    tcs = [r.thermal_conductivity for r in records]
    x_min, x_max = min(temps), max(temps)
    y_min, y_max = min(tcs), max(tcs)
    x_pad = (x_max - x_min) * 0.05 or 1
    y_pad = (y_max - y_min) * 0.05 or 0.1
    return {
        "x_min": round(x_min - x_pad, 2),
        "x_max": round(x_max + x_pad, 2),
        "y_min": round(y_min - y_pad, 4),
        "y_max": round(y_max + y_pad, 4),
    }


def _filters_from_request():
    return {
        "sample_id": request.args.get("sample_id", ""),
        "batch_id": request.args.get("batch_id", ""),
        "source": request.args.get("source", ""),
        "exclude_corrections": request.args.get("exclude_corrections", "false") == "true",
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/upload", methods=["POST"])
def upload():
    if request.is_json:
        pkg_data = request.get_json()
    else:
        f = request.files.get("file")
        if not f:
            raise UserError("MISSING_FIELD", field="file")
        pkg_data = json.load(f)

    result = _ingest_package(pkg_data)
    return jsonify({"status": "ok", "summary": result})


@app.route("/api/load-sample", methods=["POST"])
def load_sample():
    import os

    sample_path = os.path.join(os.path.dirname(__file__), "data", "sample_package.json")
    if not os.path.exists(sample_path):
        return jsonify({"status": "error", "message": "示例数据包不存在"}), 404
    with open(sample_path, "r", encoding="utf-8") as f:
        pkg_data = json.load(f)
    result = _ingest_package(pkg_data)
    return jsonify({"status": "ok", "summary": result})


@app.route("/api/records")
def get_records():
    if not _store["loaded"]:
        return jsonify({"status": "error", "message": "尚未导入数据包，请先上传或加载示例数据"}), 400
    filters = _filters_from_request()
    _store["filter_state"] = filters
    filtered = _apply_filters(_store["records"], filters)
    axis_range = _compute_axis_range(filtered)
    return jsonify({
        "status": "ok",
        "filter_state": filters,
        "axis_range": axis_range,
        "records": [
            {
                "id": r.id,
                "sample_id": r.sample_id,
                "timestamp": r.timestamp,
                "temperature": r.temperature,
                "thermal_conductivity": r.thermal_conductivity,
                "unit": r.unit,
                "source": r.source,
                "is_correction": r.is_correction,
                "is_late_attachment": r.is_late_attachment,
                "operator": r.operator,
                "batch_id": r.batch_id,
                "notes": r.notes,
                "original_temperature": r.original_temperature,
                "original_tc": r.original_tc,
            }
            for r in filtered
        ],
    })


@app.route("/api/curve/<sample_id>")
def get_curve(sample_id):
    if not _store["loaded"]:
        return jsonify({"status": "error", "message": "尚未导入数据包"}), 400
    filters = _filters_from_request()
    filters["sample_id"] = sample_id
    _store["filter_state"] = filters
    filtered = _apply_filters(_store["records"], filters)
    filtered.sort(key=lambda r: r.temperature)
    axis_range = _compute_axis_range(filtered)
    return jsonify({
        "status": "ok",
        "sample_id": sample_id,
        "filter_state": filters,
        "axis_range": axis_range,
        "points": [
            {"x": r.temperature, "y": r.thermal_conductivity, "id": r.id, "is_correction": r.is_correction, "is_late_attachment": r.is_late_attachment}
            for r in filtered
        ],
    })


@app.route("/api/export")
def export_csv():
    if not _store["loaded"]:
        return jsonify({"status": "error", "message": "尚未导入数据包"}), 400
    filters = _filters_from_request()
    if not filters.get("sample_id") and _store["filter_state"].get("sample_id"):
        filters["sample_id"] = _store["filter_state"]["sample_id"]
    filtered = _apply_filters(_store["records"], filters)
    axis_range = _compute_axis_range(filtered)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["序号", "记录ID", "样本ID", "时间", "温度(°C)", "热导率(W/(m·K))", "来源", "是否更正", "是否晚到", "操作员", "批次", "备注"])
    for i, r in enumerate(filtered, 1):
        writer.writerow([
            i, r.id, r.sample_id, r.timestamp, f"{r.temperature:.2f}",
            f"{r.thermal_conductivity:.4f}", r.source,
            "是" if r.is_correction else "否",
            "是" if r.is_late_attachment else "否",
            r.operator, r.batch_id, r.notes,
        ])
    writer.writerow([])
    writer.writerow(["屏幕范围", f"温度: {axis_range['x_min']}~{axis_range['x_max']}°C", f"热导率: {axis_range['y_min']}~{axis_range['y_max']} W/(m·K)"])

    csv_bytes = output.getvalue().encode("utf-8-sig")
    return Response(
        csv_bytes,
        mimetype="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=experiment_grading_table.csv"},
    )


@app.route("/api/drifts")
def get_drifts():
    if not _store["loaded"]:
        return jsonify({"status": "error", "message": "尚未导入数据包"}), 400
    return jsonify({
        "status": "ok",
        "drifts": [
            {
                "sample_id": d.sample_id,
                "drift_value": d.drift_value,
                "source": d.source,
                "operator": d.operator,
                "record_id": d.record_id,
                "calibration_version": d.calibration_version,
                "message": d.message,
            }
            for d in _store["drifts"]
        ],
    })


@app.route("/api/messages")
def get_messages():
    return jsonify({
        "status": "ok",
        "errors": _store["errors"],
        "warnings": _store["warnings"],
    })


@app.route("/api/filter-state")
def get_filter_state():
    return jsonify({"status": "ok", "filter_state": _store["filter_state"]})


@app.route("/api/samples")
def get_samples():
    if not _store["loaded"]:
        return jsonify({"status": "error", "message": "尚未导入数据包"}), 400
    sample_ids = sorted(set(r.sample_id for r in _store["records"]))
    batch_ids = sorted(set(r.batch_id for r in _store["records"] if r.batch_id))
    return jsonify({"status": "ok", "sample_ids": sample_ids, "batch_ids": batch_ids})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
