from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import csv
import io
import random
import string

app = Flask(__name__)
CORS(app)

slugs = {}
blacklist = {}
click_logs = []
domains = {}


def init_test_data():
    global slugs, blacklist, click_logs, domains
    
    test_slugs = [
        {"slug": "promo-2024", "target_url": "https://malicious-site.com/phish", "target_domain": "malicious-site.com", "owner": "张三", "created_at": "2024-01-15", "status": "normal"},
        {"slug": "spring-sale", "target_url": "https://legitimate-shop.com/deals", "target_domain": "legitimate-shop.com", "owner": "李四", "created_at": "2024-02-20", "status": "normal"},
        {"slug": "vip-access", "target_url": "https://phishing-attack.net/login", "target_domain": "phishing-attack.net", "owner": "王五", "created_at": "2024-03-10", "status": "normal"},
        {"slug": "download-app", "target_url": "https://safe-app.org/download", "target_domain": "safe-app.org", "owner": "张三", "created_at": "2024-03-15", "status": "normal"},
        {"slug": "free-gift", "target_url": "https://scam-site.com/gift", "target_domain": "scam-site.com", "owner": "赵六", "created_at": "2024-04-01", "status": "normal"},
        {"slug": "newsletter", "target_url": "https://real-news.com/subscribe", "target_domain": "real-news.com", "owner": "李四", "created_at": "2024-04-15", "status": "normal"},
    ]
    
    for s in test_slugs:
        slugs[s["slug"]] = s
        
        for i in range(30):
            date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            sources = ["direct", "google", "facebook", "twitter", "email", "unknown"]
            for _ in range(random.randint(5, 50)):
                source = random.choice(sources)
                click_logs.append({
                    "slug": s["slug"],
                    "timestamp": f"{date} {random.randint(0,23):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}",
                    "source": source,
                    "ip": f"192.168.{random.randint(1,255)}.{random.randint(1,255)}",
                    "user_agent": "Mozilla/5.0..."
                })
    
    blacklist_rules = [
        {"domain": "malicious-site.com", "rule": "已知钓鱼域名", "reason": "多次报告欺诈行为", "added_at": "2024-01-20", "added_by": "系统自动检测"},
        {"domain": "phishing-attack.net", "rule": "仿冒登录页面", "reason": "银行投诉举报", "added_at": "2024-03-12", "added_by": "风控团队"},
        {"domain": "scam-site.com", "rule": "虚假奖品诈骗", "reason": "大量用户投诉", "added_at": "2024-04-05", "added_by": "风控团队"},
    ]
    
    for rule in blacklist_rules:
        blacklist[rule["domain"]] = rule
        
        for slug_data in slugs.values():
            if slug_data["target_domain"] == rule["domain"]:
                slug_data["status"] = "banned"
                slug_data["banned_at"] = rule["added_at"]
                slug_data["ban_reason"] = rule["reason"]


@app.route('/api/search', methods=['GET'])
def search_slug():
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify({"error": "查询参数不能为空"}), 400
        
    results = []
    for slug, data in slugs.items():
        if query in slug.lower() or query in data["target_domain"].lower() or query in data.get("owner", "").lower():
            results.append({
                "slug": slug,
                **data,
                "is_risky": data["target_domain"] in blacklist,
                "risk_reason": blacklist.get(data["target_domain"], {}).get("reason", "") if data["target_domain"] in blacklist else ""
            })
    
    return jsonify({"results": results, "count": len(results)})


@app.route('/api/validate', methods=['POST'])
def validate_slug():
    data = request.json
    slug = data.get('slug', '').strip()
    
    if not slug:
        return jsonify({"valid": False, "reason": "slug不能为空"})
        
    if slug in slugs:
        slug_data = slugs[slug]
        is_risky = slug_data["target_domain"] in blacklist
        return jsonify({
            "valid": True,
            "exists": True,
            "slug": slug,
            "target_url": slug_data["target_url"],
            "target_domain": slug_data["target_domain"],
            "is_risky": is_risky,
            "status": slug_data.get("status", "normal"),
            "risk_details": blacklist.get(slug_data["target_domain"]) if is_risky else None
        })
    else:
        return jsonify({"valid": True, "exists": False, "slug": slug})


@app.route('/api/batch-import', methods=['POST'])
def batch_import():
    data = request.json
    slugs_list = data.get('slugs', [])
    
    results = []
    for slug_item in slugs_list:
        slug = slug_item.get('slug', '').strip()
        target_url = slug_item.get('target_url', '')
        owner = slug_item.get('owner', '未知')
        
        validation = validate_slug_internal(slug, target_url)
        
        if validation["valid"]:
            if not validation["exists"]:
                slugs[slug] = {
                    "slug": slug,
                    "target_url": target_url,
                    "target_domain": validation["domain"],
                    "owner": owner,
                    "created_at": datetime.now().strftime("%Y-%m-%d"),
                    "status": "banned" if validation["is_risky"] else "normal",
                    "ban_reason": validation["risk_reason"] if validation["is_risky"] else None
                }
            
            results.append({
                "slug": slug,
                "success": True,
                "is_risky": validation["is_risky"],
                "risk_reason": validation.get("risk_reason", ""),
                "action": "已封禁" if validation["is_risky"] else "正常"
            })
        else:
            results.append({
                "slug": slug,
                "success": False,
                "reason": validation["reason"]
            })
    
    return jsonify({
        "total": len(results),
        "success": sum(1 for r in results if r["success"]),
        "risky_found": sum(1 for r in results if r.get("is_risky", False)),
        "results": results
    })


def validate_slug_internal(slug, target_url):
    if not slug:
        return {"valid": False, "reason": "slug不能为空"}
    
    if not target_url:
        return {"valid": False, "reason": "目标URL不能为空"}
        
    from urllib.parse import urlparse
    try:
        parsed = urlparse(target_url)
        domain = parsed.netloc or parsed.path.split('/')[0]
    except:
        return {"valid": False, "reason": "URL格式无效"}
        
    is_risky = domain in blacklist
    risk_reason = blacklist.get(domain, {}).get("reason", "") if is_risky else ""
    
    return {
        "valid": True,
        "exists": slug in slugs,
        "domain": domain,
        "is_risky": is_risky,
        "risk_reason": risk_reason
    }


@app.route('/api/ban', methods=['POST'])
def ban_slug():
    data = request.json
    slug = data.get('slug', '').strip()
    reason = data.get('reason', '风控拦截')
    operator = data.get('operator', '管理员')
    
    if slug not in slugs:
        return jsonify({"success": False, "reason": "slug不存在"})
        
    slugs[slug]["status"] = "banned"
    slugs[slug]["banned_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    slugs[slug]["ban_reason"] = reason
    slugs[slug]["banned_by"] = operator
    
    return jsonify({"success": True, "slug": slug})


@app.route('/api/unban', methods=['POST'])
def unban_slug():
    data = request.json
    slug = data.get('slug', '').strip()
    operator = data.get('operator', '管理员')
    
    if slug not in slugs:
        return jsonify({"success": False, "reason": "slug不存在"})
        
    slugs[slug]["status"] = "normal"
    slugs[slug]["unbanned_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    slugs[slug]["unbanned_by"] = operator
    
    return jsonify({"success": True, "slug": slug})


@app.route('/api/click-trends', methods=['GET'])
def get_click_trends():
    slug = request.args.get('slug', '')
    days = int(request.args.get('days', 7))
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    filtered_logs = [log for log in click_logs 
                     if (not slug or log["slug"] == slug) 
                     and datetime.strptime(log["timestamp"].split()[0], "%Y-%m-%d") >= start_date]
    
    daily_data = {}
    source_data = {}
    
    for log in filtered_logs:
        date = log["timestamp"].split()[0]
        source = log["source"]
        
        if date not in daily_data:
            daily_data[date] = {"clicks": 0, "sources": {}}
        daily_data[date]["clicks"] += 1
        
        if source not in daily_data[date]["sources"]:
            daily_data[date]["sources"][source] = 0
        daily_data[date]["sources"][source] += 1
        
        if source not in source_data:
            source_data[source] = 0
        source_data[source] += 1
    
    dates = sorted(daily_data.keys())
    trends = [{"date": d, "clicks": daily_data[d]["clicks"], "sources": daily_data[d]["sources"]} for d in dates]
    
    return jsonify({
        "trends": trends,
        "sources": source_data,
        "total_clicks": sum(v["clicks"] for v in daily_data.values()),
        "date_range": {"start": start_date.strftime("%Y-%m-%d"), "end": end_date.strftime("%Y-%m-%d")}
    })


@app.route('/api/blacklist', methods=['GET'])
def get_blacklist():
    return jsonify({"rules": list(blacklist.values()), "count": len(blacklist)})


@app.route('/api/export', methods=['GET'])
def export_data():
    slug = request.args.get('slug', '')
    days = int(request.args.get('days', 30))
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    filtered_logs = [log for log in click_logs 
                     if (not slug or log["slug"] == slug) 
                     and datetime.strptime(log["timestamp"].split()[0], "%Y-%m-%d") >= start_date]
    
    grouped = {}
    for log in filtered_logs:
        slug_name = log["slug"]
        owner = slugs.get(slug_name, {}).get("owner", "未知")
        date = log["timestamp"].split()[0]
        source = log["source"]
        
        key = (owner, date, source)
        if key not in grouped:
            grouped[key] = 0
        grouped[key] += 1
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["负责人", "日期", "访问来源", "点击量"])
    
    for (owner, date, source), count in sorted(grouped.items()):
        writer.writerow([owner, date, source, count])
    
    output.seek(0)
    
    mem = io.BytesIO()
    mem.write(output.getvalue().encode('utf-8-sig'))
    mem.seek(0)
    
    filename = f"风控数据导出_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return send_file(
        mem,
        mimetype='text/csv; charset=utf-8',
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/stats', methods=['GET'])
def get_stats():
    banned_count = sum(1 for s in slugs.values() if s.get("status") == "banned")
    normal_count = len(slugs) - banned_count
    total_clicks = len(click_logs)
    
    return jsonify({
        "total_slugs": len(slugs),
        "banned_slugs": banned_count,
        "normal_slugs": normal_count,
        "blacklist_rules": len(blacklist),
        "total_clicks_7d": total_clicks
    })


if __name__ == '__main__':
    init_test_data()
    app.run(debug=True, port=5001)
