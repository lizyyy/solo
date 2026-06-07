import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from flask import Flask, jsonify, request, send_from_directory
from contract_review.core import ReviewStore, VersionComparator, SampleImporter
from contract_review.models import DesensitizationRule, FeedbackTicket

app = Flask(__name__, static_folder="../web", static_url_path="")

store = ReviewStore("data")
comparator = VersionComparator(store)
importer = SampleImporter(store)


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/samples", methods=["GET"])
def get_samples():
    version = request.args.get("version")
    masked_only = request.args.get("masked_only", "").lower() == "true"

    samples = list(store.samples.values())
    if version:
        samples = [s for s in samples if s.model_version == version]
    if masked_only:
        samples = [s for s in samples if s.is_masked_by_avg]

    samples.sort(key=lambda s: (0 if s.is_masked_by_avg else 1, -s.overall_confidence))
    return jsonify([s.to_dict() for s in samples])


@app.route("/api/samples/<sample_id>", methods=["GET"])
def get_sample(sample_id):
    sample = store.get_sample(sample_id)
    if not sample:
        return jsonify({"error": "样本不存在"}), 404

    data = sample.to_dict()
    data["tickets"] = [t.to_dict() for t in store.get_tickets_by_sample(sample_id)]
    data["rules"] = [r.to_dict() for r in store.get_rules_by_sample(sample_id)]
    return jsonify(data)


@app.route("/api/samples/<sample_id>", methods=["PUT"])
def update_sample(sample_id):
    data = request.json
    updated = store.update_sample(sample_id, **data)
    if not updated:
        return jsonify({"error": "样本不存在"}), 404
    return jsonify({"success": True})


@app.route("/api/samples/<sample_id>/notes", methods=["POST"])
def add_note(sample_id):
    sample = store.get_sample(sample_id)
    if not sample:
        return jsonify({"error": "样本不存在"}), 404

    data = request.json
    rule = DesensitizationRule(
        sample_id=sample_id,
        rule_type=data.get("rule_type", "desensitization"),
        pattern=data.get("pattern", ""),
        replacement=data.get("replacement", ""),
        note=data.get("note", ""),
        added_by=data.get("added_by", "小孟")
    )
    store.add_rule(rule)
    return jsonify({"success": True, "rule_id": rule.rule_id})


@app.route("/api/samples/<sample_id>/tickets", methods=["POST"])
def add_ticket(sample_id):
    sample = store.get_sample(sample_id)
    if not sample:
        return jsonify({"error": "样本不存在"}), 404

    data = request.json
    ticket = FeedbackTicket(
        sample_id=sample_id,
        title=data.get("title", ""),
        description=data.get("description", ""),
        reporter=data.get("reporter", "知识库编辑"),
        status="open"
    )
    store.add_ticket(ticket)
    return jsonify({"success": True, "ticket_id": ticket.ticket_id})


@app.route("/api/compare", methods=["POST"])
def compare_versions():
    data = request.json
    v1 = data.get("v1")
    v2 = data.get("v2")
    by = data.get("generated_by", "system")

    if not v1 or not v2:
        return jsonify({"error": "缺少版本参数 v1/v2"}), 400

    report = comparator.compare(v1, v2, by)
    return jsonify(report.to_dict())


@app.route("/api/compare/text", methods=["POST"])
def compare_text():
    data = request.json
    v1 = data.get("v1")
    v2 = data.get("v2")
    by = data.get("generated_by", "system")

    if not v1 or not v2:
        return jsonify({"error": "缺少版本参数 v1/v2"}), 400

    report = comparator.compare(v1, v2, by)
    text = comparator.generate_human_readable_report(report)
    return jsonify({"report_id": report.report_id, "text": text})


@app.route("/api/reports", methods=["GET"])
def list_reports():
    reports = list(store.reports.values())
    reports.sort(key=lambda r: r.generated_at, reverse=True)
    return jsonify([r.to_dict() for r in reports])


@app.route("/api/import/demo", methods=["POST"])
def import_demo():
    data = request.json
    version = data.get("version", "1.0.0")
    count = int(data.get("count", 5))
    ids = importer.generate_demo_samples(version, count)
    return jsonify({"imported": len(ids), "sample_ids": ids})


@app.route("/api/versions", methods=["GET"])
def get_versions():
    versions = set(s.model_version for s in store.samples.values())
    return jsonify(sorted(versions, reverse=True))


@app.route("/api/masked-samples", methods=["GET"])
def get_masked_samples():
    samples = store.get_masked_samples()
    return jsonify([s.to_dict() for s in samples])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
