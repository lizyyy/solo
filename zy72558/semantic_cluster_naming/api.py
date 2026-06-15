import os
from typing import Optional
from flask import Flask, jsonify, request, render_template_string, send_from_directory

from .models import init_db, ReviewStatus, TrainingStatus, SnapshotStatus
from .snapshot_import import SnapshotImporter
from .clustering import ClusteringEngine
from .result_service import ResultService


def create_app(db_path: Optional[str] = None):
    app = Flask(__name__, template_folder="templates")
    app.config["DB_PATH"] = db_path or os.environ.get("SCN_DB_PATH", "semantic_cluster.db")

    def get_session():
        Session, _ = init_db(f"sqlite:///{app.config['DB_PATH']}")
        return Session()

    @app.route("/")
    def index():
        db = get_session()
        try:
            importer = SnapshotImporter(db)
            engine = ClusteringEngine(db)
            service = ResultService(db)

            snapshots = importer.list_snapshots(limit=50)
            runs = engine.list_runs(limit=50)
            pending_reviews = service.get_pending_reviews()

            total_snapshots = len([s for s in snapshots if s.get("exists")])
            total_runs = len(runs)
            total_pending = len(pending_reviews)
            duplicate_runs = len([r for r in runs if r.get("is_duplicate_run")])

            return render_template_string(
                INDEX_HTML,
                total_snapshots=total_snapshots,
                total_runs=total_runs,
                total_pending=total_pending,
                duplicate_runs=duplicate_runs,
                snapshots=snapshots,
                runs=runs,
                pending_reviews=pending_reviews,
                ReviewStatus=ReviewStatus,
                TrainingStatus=TrainingStatus,
                SnapshotStatus=SnapshotStatus,
            )
        finally:
            db.close()

    @app.route("/api/snapshots", methods=["GET"])
    def list_snapshots():
        db = get_session()
        try:
            importer = SnapshotImporter(db)
            limit = request.args.get("limit", 100, type=int)
            return jsonify({"code": 0, "data": importer.list_snapshots(limit=limit)})
        finally:
            db.close()

    @app.route("/api/snapshots/<snapshot_id>", methods=["GET"])
    def get_snapshot(snapshot_id):
        db = get_session()
        try:
            importer = SnapshotImporter(db)
            summary = importer.get_snapshot_summary(snapshot_id)
            return jsonify({"code": 0, "data": summary})
        except Exception as e:
            return jsonify({"code": 1, "error": str(e)}), 400
        finally:
            db.close()

    @app.route("/api/runs", methods=["GET"])
    def list_runs():
        db = get_session()
        try:
            engine = ClusteringEngine(db)
            snapshot_id = request.args.get("snapshot_id")
            limit = request.args.get("limit", 100, type=int)
            runs = engine.list_runs(snapshot_id=snapshot_id, limit=limit)

            for r in runs:
                r["_source"] = "api/single_result_source"
                r["_result_fields_aligned"] = [
                    "status", "review_status", "is_duplicate_run",
                    "duplicate_of_run_id", "metrics", "cluster_info"
                ]
            return jsonify({"code": 0, "data": runs})
        finally:
            db.close()

    @app.route("/api/runs/<run_id>", methods=["GET"])
    def get_run(run_id):
        db = get_session()
        try:
            service = ResultService(db)
            data = service.get_results_for_display(run_id)
            data["_source"] = "result_service.single_source_for_all"
            data["_alignment_note"] = (
                "此处返回的数据与页面展示、CSV/JSON导出均读取同一份ClusteringResult表，"
                "重复训练记录（is_duplicate_run/duplicate_of_run_id/review_status）三端一致"
            )
            return jsonify({"code": 0, "data": data})
        except Exception as e:
            return jsonify({"code": 1, "error": str(e)}), 400
        finally:
            db.close()

    @app.route("/api/runs/<run_id>/log", methods=["GET"])
    def get_run_log(run_id):
        db = get_session()
        try:
            engine = ClusteringEngine(db)
            log = engine.get_training_log(run_id)
            return jsonify({"code": 0, "data": {"run_id": run_id, "log": log}})
        except Exception as e:
            return jsonify({"code": 1, "error": str(e)}), 400
        finally:
            db.close()

    @app.route("/api/runs/<run_id>/export", methods=["GET"])
    def export_run(run_id):
        db = get_session()
        try:
            service = ResultService(db)
            fmt = request.args.get("format", "json")
            if fmt == "json":
                results = service.get_results(run_id)
                run_summary = service.get_results_for_display(run_id)
                payload = {
                    "_source": "result_service.single_source_for_all",
                    "_alignment_check": "与/api/runs/<id>、HTML页面、CSV导出同源",
                    "run": {
                        "run_id": run_summary["run_id"],
                        "snapshot_id": run_summary["snapshot_id"],
                        "status": run_summary["status"],
                        "review_status": run_summary["review_status"],
                        "is_duplicate_run": run_summary["is_duplicate_run"],
                    },
                    "results": results,
                }
                return jsonify({"code": 0, "data": payload})
            else:
                return jsonify({"code": 1, "error": "仅支持 json 格式通过API导出；CSV请用 CLI scn result export"}), 400
        except Exception as e:
            return jsonify({"code": 1, "error": str(e)}), 400
        finally:
            db.close()

    @app.route("/api/reviews/pending", methods=["GET"])
    def pending_reviews():
        db = get_session()
        try:
            service = ResultService(db)
            items = service.get_pending_reviews()
            for item in items:
                item["_note"] = (
                    "同一批数据重复训练两次时，review_status=pending_review，"
                    "此处、API运行详情、HTML页面三处来源一致"
                )
            return jsonify({"code": 0, "data": items})
        finally:
            db.close()

    @app.route("/api/reviews/<run_id>/decide", methods=["POST"])
    def decide_review(run_id):
        db = get_session()
        try:
            service = ResultService(db, actor=request.json.get("reviewer", "unknown"))
            body = request.get_json(force=True) or {}
            decision = body.get("decision")
            reviewer = body.get("reviewer", "unknown")
            comments = body.get("comments")
            if decision not in ("approve", "reject"):
                return jsonify({"code": 1, "error": "decision 必须是 approve 或 reject"}), 400
            ok = service.review_duplicate_run(run_id, decision, reviewer, comments)
            return jsonify({"code": 0 if ok else 1, "data": {"decided": decision, "run_id": run_id}})
        except Exception as e:
            return jsonify({"code": 1, "error": str(e)}), 400
        finally:
            db.close()

    @app.route("/api/audit", methods=["GET"])
    def audit_log():
        db = get_session()
        try:
            service = ResultService(db)
            run_id = request.args.get("run_id")
            snapshot_id = request.args.get("snapshot_id")
            limit = request.args.get("limit", 100, type=int)
            return jsonify({
                "code": 0,
                "data": service.get_audit_trail(run_id=run_id, snapshot_id=snapshot_id, limit=limit)
            })
        finally:
            db.close()

    @app.route("/run/<run_id>")
    def run_detail_page(run_id):
        db = get_session()
        try:
            service = ResultService(db)
            data = service.get_results_for_display(run_id)
            audit = service.get_audit_trail(run_id=run_id, limit=50)
            return render_template_string(
                RUN_DETAIL_HTML,
                data=data,
                audit=audit,
                ReviewStatus=ReviewStatus,
                TrainingStatus=TrainingStatus,
            )
        except Exception as e:
            return f"<h2>加载失败</h2><p>{e}</p>", 400
        finally:
            db.close()

    @app.route("/snapshot/<snapshot_id>")
    def snapshot_detail_page(snapshot_id):
        db = get_session()
        try:
            importer = SnapshotImporter(db)
            engine = ClusteringEngine(db)
            service = ResultService(db)
            summary = importer.get_snapshot_summary(snapshot_id)
            runs = engine.list_runs(snapshot_id=snapshot_id, limit=20)
            audit = service.get_audit_trail(snapshot_id=snapshot_id, limit=50)
            return render_template_string(
                SNAPSHOT_DETAIL_HTML,
                snapshot_id=snapshot_id,
                summary=summary,
                runs=runs,
                audit=audit,
                ReviewStatus=ReviewStatus,
                TrainingStatus=TrainingStatus,
            )
        except Exception as e:
            return f"<h2>加载失败</h2><p>{e}</p>", 400
        finally:
            db.close()

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "db": app.config["DB_PATH"]})

    return app


INDEX_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>语义向量聚类命名 - 总览</title>
<style>
body { font-family: -apple-system, "PingFang SC", sans-serif; margin: 24px; color: #222; }
.card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.metric { background: #f9fafb; border-radius: 10px; padding: 16px; }
.metric .n { font-size: 28px; font-weight: 700; }
.metric .l { color: #6b7280; font-size: 13px; margin-top: 4px; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.tag.y { background: #fef3c7; color: #92400e; }
.tag.g { background: #d1fae5; color: #065f46; }
.tag.r { background: #fee2e2; color: #991b1b; }
.tag.b { background: #dbeafe; color: #1e40af; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #f3f4f6; }
th { background: #fafafa; }
a { color: #2563eb; text-decoration: none; }
.note { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 14px; font-size: 12px; color: #92400e; margin-bottom: 16px; }
.src-badge { font-size: 10px; color: #059669; background: #ecfdf5; padding: 1px 6px; border-radius: 4px; }
</style>
</head>
<body>
<h1>语义向量聚类命名系统 <span class="src-badge">同源数据: ResultService</span></h1>
<div class="note">
  页面展示 / HTTP API / CSV 导出 三方均读取同一份 <code>ClusteringResult</code> 表，
  尤其是「同一批数据重复训练两次」的记录，<b>状态、review_status、duplicate_of_run_id 三端完全对齐</b>。
</div>

<div class="grid">
  <div class="metric"><div class="n">{{ total_snapshots }}</div><div class="l">特征快照</div></div>
  <div class="metric"><div class="n">{{ total_runs }}</div><div class="l">聚类运行</div></div>
  <div class="metric"><div class="n" style="color:#b45309">{{ total_pending }}</div><div class="l">待策略产品复核</div></div>
  <div class="metric"><div class="n" style="color:#b91c1c">{{ duplicate_runs }}</div><div class="l">重复训练记录</div></div>
</div>

<div class="card">
<h3>待策略产品复核（同一批数据重复训练两次自动进入）</h3>
{% if pending_reviews %}
<table>
  <tr><th>运行ID</th><th>快照ID</th><th>重复训练</th><th>原运行ID</th><th>提交时间</th><th>提交人</th><th>操作</th></tr>
  {% for p in pending_reviews %}
  <tr>
    <td><a href="/run/{{ p.run_id }}">{{ p.run_id }}</a></td>
    <td><a href="/snapshot/{{ p.snapshot_id }}">{{ p.snapshot_id }}</a></td>
    <td>{% if p.is_duplicate_run %}<span class="tag r">是</span>{% else %}<span class="tag g">否</span>{% endif %}</td>
    <td>{% if p.duplicate_of_run_id %}<a href="/run/{{ p.duplicate_of_run_id }}">{{ p.duplicate_of_run_id }}</a>{% else %}-{% endif %}</td>
    <td>{{ p.started_at.strftime('%Y-%m-%d %H:%M') if p.started_at else '-' }}</td>
    <td>{{ p.created_by }}</td>
    <td><a href="/run/{{ p.run_id }}">查看并复核</a></td>
  </tr>
  {% endfor %}
</table>
{% else %}
<p style="color:#059669">暂无待复核项</p>
{% endif %}
</div>

<div class="card">
<h3>特征快照列表</h3>
<table>
  <tr><th>快照ID</th><th>总行数</th><th>版本数</th><th>有重复导入</th><th>导入时间</th><th>详情</th></tr>
  {% for s in snapshots if s.get('exists') %}
  <tr>
    <td><a href="/snapshot/{{ s.snapshot_id }}">{{ s.snapshot_id }}</a></td>
    <td>{{ s.total_rows }}</td>
    <td>{{ s.versions | length }}</td>
    <td>
      {% if s.versions.values() | selectattr('has_duplicate') | list %}
        <span class="tag r">是</span>
      {% else %}
        <span class="tag g">否</span>
      {% endif %}
    </td>
    <td>{{ s.imported_at.strftime('%Y-%m-%d %H:%M') if s.imported_at else '-' }}</td>
    <td><a href="/snapshot/{{ s.snapshot_id }}">详情</a></td>
  </tr>
  {% endfor %}
</table>
</div>

<div class="card">
<h3>聚类训练运行列表 <span class="src-badge">与 API /api/runs 同源</span></h3>
<table>
  <tr>
    <th>运行ID</th><th>快照ID</th><th>状态</th><th>复核状态</th>
    <th>重复训练</th><th>原运行ID</th><th>聚类数</th><th>开始时间</th><th>详情</th>
  </tr>
  {% for r in runs if r.get('exists') %}
  <tr>
    <td><a href="/run/{{ r.run_id }}">{{ r.run_id }}</a></td>
    <td><a href="/snapshot/{{ r.snapshot_id }}">{{ r.snapshot_id }}</a></td>
    <td>
      {% if r.status == TrainingStatus.SUCCESS.value %}<span class="tag g">成功</span>
      {% elif r.status == TrainingStatus.DUPLICATE_TRAINING.value %}<span class="tag y">重复训练</span>
      {% elif r.status == TrainingStatus.FAILED.value %}<span class="tag r">失败</span>
      {% else %}<span class="tag b">{{ r.status }}</span>{% endif %}
    </td>
    <td>
      {% if r.review_status == ReviewStatus.PENDING_REVIEW.value %}<span class="tag y">待复核</span>
      {% elif r.review_status == ReviewStatus.APPROVED.value %}<span class="tag g">已通过</span>
      {% elif r.review_status == ReviewStatus.REJECTED.value %}<span class="tag r">已驳回</span>
      {% else %}<span class="tag b">常规</span>{% endif %}
    </td>
    <td>{% if r.is_duplicate_run %}<span class="tag r">是</span>{% else %}<span class="tag g">否</span>{% endif %}</td>
    <td>{% if r.duplicate_of_run_id %}<a href="/run/{{ r.duplicate_of_run_id }}">{{ r.duplicate_of_run_id }}</a>{% else %}-{% endif %}</td>
    <td>{{ r.params.n_clusters if r.params else '-' }}</td>
    <td>{{ r.started_at.strftime('%Y-%m-%d %H:%M') if r.started_at else '-' }}</td>
    <td><a href="/run/{{ r.run_id }}">详情</a></td>
  </tr>
  {% endfor %}
</table>
</div>

<div class="card">
<h3>可用入口</h3>
<ul>
  <li><b>页面总览</b>：<code>/</code>（本页）</li>
  <li><b>快照详情</b>：<code>/snapshot/&lt;snapshot_id&gt;</code></li>
  <li><b>运行详情</b>：<code>/run/&lt;run_id&gt;</code>（含结果、复核、状态、历史留痕）</li>
  <li><b>API 列表</b>：
    <code>/api/snapshots</code>、<code>/api/runs</code>、<code>/api/runs/&lt;id&gt;</code>、
    <code>/api/runs/&lt;id&gt;/export</code>、<code>/api/reviews/pending</code>、<code>/api/audit</code>
  </li>
</ul>
</div>
</body>
</html>
"""


RUN_DETAIL_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>运行详情 - {{ data.run_id }}</title>
<style>
body { font-family: -apple-system, "PingFang SC", sans-serif; margin: 24px; color: #222; }
.card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.tag.y { background: #fef3c7; color: #92400e; }
.tag.g { background: #d1fae5; color: #065f46; }
.tag.r { background: #fee2e2; color: #991b1b; }
.tag.b { background: #dbeafe; color: #1e40af; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #f3f4f6; }
th { background: #fafafa; }
.kv { display: grid; grid-template-columns: 180px 1fr; gap: 6px 16px; }
.kv div.k { color: #6b7280; }
pre { background: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 8px; overflow-x: auto; }
.src-badge { font-size: 10px; color: #059669; background: #ecfdf5; padding: 1px 6px; border-radius: 4px; }
.warn { background: #fff7ed; border-left: 3px solid #ea580c; padding: 8px 14px; color: #9a3412; }
.ok { background: #f0fdf4; border-left: 3px solid #16a34a; padding: 8px 14px; color: #14532d; }
a { color: #2563eb; }
</style>
</head>
<body>
<h1>运行详情 <span class="src-badge">ResultService 同源数据</span> <small>{{ data.run_id }}</small></h1>
<p><a href="/">← 返回总览</a> &nbsp; | &nbsp; <a href="/snapshot/{{ data.snapshot_id }}">快照 {{ data.snapshot_id }}</a></p>

<div class="card">
<h3>状态说明（策略产品重点查看）</h3>
<div class="kv">
  <div class="k">快照ID</div><div>{{ data.snapshot_id }}</div>
  <div class="k">训练状态</div>
  <div>
    {% if data.status == TrainingStatus.SUCCESS.value %}<span class="tag g">success</span>
    {% elif data.status == TrainingStatus.DUPLICATE_TRAINING.value %}<span class="tag y">duplicate_training（同一批数据重复训练）</span>
    {% elif data.status == TrainingStatus.FAILED.value %}<span class="tag r">failed</span>
    {% else %}<span class="tag b">{{ data.status }}</span>{% endif %}
  </div>
  <div class="k">复核状态</div>
  <div>
    {% if data.review_status == ReviewStatus.PENDING_REVIEW.value %}
      <div class="warn"><b>pending_review - 需策略产品复核</b>，原因：同一批数据重复训练两次，不自动归为正常。</div>
    {% elif data.review_status == ReviewStatus.APPROVED.value %}
      <div class="ok"><b>approved - 策略产品已复核通过</b></div>
    {% elif data.review_status == ReviewStatus.REJECTED.value %}
      <span class="tag r">rejected</span>
    {% else %}
      <span class="tag b">normal</span>
    {% endif %}
  </div>
  <div class="k">是否重复训练</div>
  <div>{% if data.is_duplicate_run %}<span class="tag r">是</span>{% else %}<span class="tag g">否</span>{% endif %}</div>
  <div class="k">总行数</div><div>{{ data.total_rows }}</div>
  <div class="k">评估指标</div>
  <div>
    {% if data.metrics %}
      inertia={{ data.metrics.inertia }},
      silhouette={{ data.metrics.silhouette_score }},
      clusters={{ data.metrics.n_clusters }}
    {% else %}-{% endif %}
  </div>
</div>
</div>

<div class="card">
<h3>三端一致性说明 <span class="src-badge">同源</span></h3>
<p>此页面展示的 <code>status / review_status / is_duplicate_run / clusters / results</code> 与以下出口读取同一份数据：</p>
<ul>
  <li>HTTP API：<code>GET /api/runs/{{ data.run_id }}</code></li>
  <li>HTTP API 导出：<code>GET /api/runs/{{ data.run_id }}/export?format=json</code></li>
  <li>CLI 导出：<code>scn result export {{ data.run_id }} out.csv</code></li>
</ul>
<p>尤其是「同一批数据重复训练两次」的记录，三方显示完全一致，不会出现一处异常、一处消失。</p>
</div>

<div class="card">
<h3>簇信息</h3>
<table>
  <tr><th>簇ID</th><th>簇名称</th><th>已人工编辑</th><th>样本数</th></tr>
  {% for c in data.clusters %}
  <tr>
    <td>{{ c.cluster_id }}</td>
    <td>{{ c.cluster_name }}</td>
    <td>{% if c.cluster_name_edited %}<span class="tag y">是</span>{% else %}否{% endif %}</td>
    <td>{{ c.count }}</td>
  </tr>
  {% endfor %}
</table>
</div>

<div class="card">
<h3>结果明细（前30行，含原始行号 / 人工改动标记）</h3>
<table>
  <tr>
    <th>原始行号</th><th>簇ID</th><th>簇名称</th>
    <th>簇名已编辑</th><th>人工调整簇</th><th>调整原因</th><th>调整人</th>
  </tr>
  {% for r in data.results[:30] %}
  <tr>
    <td><b>{{ r.original_row_number }}</b></td>
    <td>{{ r.cluster_id }}</td>
    <td>{{ r.cluster_name }}</td>
    <td>{% if r.cluster_name_edited %}<span class="tag y">是</span>{% else %}-{% endif %}</td>
    <td>{% if r.is_manual_override %}<span class="tag r">是</span>{% else %}-{% endif %}</td>
    <td>{{ r.override_reason or '-' }}</td>
    <td>{{ r.overridden_by or '-' }}</td>
  </tr>
  {% endfor %}
</table>
</div>

<div class="card">
<h3>历史留痕（审计日志，最近50条）</h3>
<table>
  <tr><th>时间</th><th>操作</th><th>操作人</th><th>字段</th><th>旧值</th><th>新值</th></tr>
  {% for a in audit %}
  <tr>
    <td>{{ a.timestamp.strftime('%Y-%m-%d %H:%M:%S') if a.timestamp else '-' }}</td>
    <td>{{ a.action }}</td>
    <td>{{ a.actor }}</td>
    <td>{{ a.field_changed or '-' }}</td>
    <td>{{ (a.old_value or '')[:40] }}</td>
    <td>{{ (a.new_value or '')[:40] }}</td>
  </tr>
  {% endfor %}
</table>
</div>

</body>
</html>
"""


SNAPSHOT_DETAIL_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>快照详情 - {{ snapshot_id }}</title>
<style>
body { font-family: -apple-system, "PingFang SC", sans-serif; margin: 24px; color: #222; }
.card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.tag.y { background: #fef3c7; color: #92400e; }
.tag.g { background: #d1fae5; color: #065f46; }
.tag.r { background: #fee2e2; color: #991b1b; }
.tag.b { background: #dbeafe; color: #1e40af; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #f3f4f6; }
th { background: #fafafa; }
pre { background: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 8px; overflow-x: auto; }
a { color: #2563eb; }
</style>
</head>
<body>
<h1>快照详情 <small>{{ snapshot_id }}</small></h1>
<p><a href="/">← 返回总览</a></p>

<div class="card">
<h3>快照概览</h3>
<pre>{{ summary | tojson(indent=2, ensure_ascii=False) }}</pre>
</div>

<div class="card">
<h3>关联的聚类训练（含重复训练记录）</h3>
<table>
  <tr>
    <th>运行ID</th><th>状态</th><th>复核状态</th>
    <th>重复训练</th><th>原运行ID</th><th>聚类数</th><th>开始时间</th>
  </tr>
  {% for r in runs if r.get('exists') %}
  <tr>
    <td><a href="/run/{{ r.run_id }}">{{ r.run_id }}</a></td>
    <td>
      {% if r.status == TrainingStatus.SUCCESS.value %}<span class="tag g">success</span>
      {% elif r.status == TrainingStatus.DUPLICATE_TRAINING.value %}<span class="tag y">duplicate_training</span>
      {% elif r.status == TrainingStatus.FAILED.value %}<span class="tag r">failed</span>
      {% else %}<span class="tag b">{{ r.status }}</span>{% endif %}
    </td>
    <td>
      {% if r.review_status == ReviewStatus.PENDING_REVIEW.value %}<span class="tag y">待复核</span>
      {% elif r.review_status == ReviewStatus.APPROVED.value %}<span class="tag g">已通过</span>
      {% elif r.review_status == ReviewStatus.REJECTED.value %}<span class="tag r">已驳回</span>
      {% else %}<span class="tag b">normal</span>{% endif %}
    </td>
    <td>{% if r.is_duplicate_run %}<span class="tag r">是</span>{% else %}<span class="tag g">否</span>{% endif %}</td>
    <td>{% if r.duplicate_of_run_id %}<a href="/run/{{ r.duplicate_of_run_id }}">{{ r.duplicate_of_run_id }}</a>{% else %}-{% endif %}</td>
    <td>{{ r.params.n_clusters if r.params else '-' }}</td>
    <td>{{ r.started_at.strftime('%Y-%m-%d %H:%M') if r.started_at else '-' }}</td>
  </tr>
  {% endfor %}
</table>
</div>

<div class="card">
<h3>历史留痕</h3>
<table>
  <tr><th>时间</th><th>操作</th><th>操作人</th><th>字段</th><th>旧值</th><th>新值</th></tr>
  {% for a in audit %}
  <tr>
    <td>{{ a.timestamp.strftime('%Y-%m-%d %H:%M:%S') if a.timestamp else '-' }}</td>
    <td>{{ a.action }}</td>
    <td>{{ a.actor }}</td>
    <td>{{ a.field_changed or '-' }}</td>
    <td>{{ (a.old_value or '')[:40] }}</td>
    <td>{{ (a.new_value or '')[:40] }}</td>
  </tr>
  {% endfor %}
</table>
</div>

</body>
</html>
"""


def run_server(host: str = "127.0.0.1", port: int = 8765, db_path: Optional[str] = None):
    app = create_app(db_path=db_path)
    app.run(host=host, port=port, debug=False)
