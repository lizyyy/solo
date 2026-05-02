from typing import Dict, List
from pathlib import Path
from parsers.manifest import ImageEntry


def generate_html_gallery(
    manifest: Dict[str, ImageEntry],
    annotations: Dict[str, List],
    issues: List[dict],
    base_path: str,
    output_path: str
) -> None:
    issue_image_ids = set()
    for issue in issues:
        if issue.get("image_id"):
            ids = issue["image_id"].split(",")
            issue_image_ids.update(ids)
    
    total_images = len(manifest)
    issue_count = len(issue_image_ids)
    
    html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dataset Sample Gallery</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .gallery {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }}
        .card {{
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .card img {{
            width: 100%;
            height: 200px;
            object-fit: cover;
            background-color: #eee;
        }}
        .card .info {{
            padding: 12px;
        }}
        .card .info h3 {{
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #333;
        }}
        .card .info p {{
            margin: 4px 0;
            font-size: 12px;
            color: #666;
        }}
        .card.has-issue {{
            border: 2px solid #dc2626;
        }}
        .card.warning {{
            border: 2px solid #d97706;
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .header h1 {{
            color: #1f2937;
            margin-bottom: 8px;
        }}
        .header p {{
            color: #6b7280;
            margin: 0;
        }}
        .issue-badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            margin-right: 4px;
        }}
        .issue-badge.error {{
            background-color: #fee2e2;
            color: #dc2626;
        }}
        .issue-badge.warning {{
            background-color: #fef3c7;
            color: #d97706;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Dataset Sample Gallery</h1>
        <p>Total images: {total_images} | With issues: {issue_count}</p>
    </div>
    <div class="gallery">"""
    
    for image_id, entry in manifest.items():
        image_issues = []
        for issue in issues:
            if issue.get("image_id") and image_id in issue["image_id"]:
                image_issues.append(issue)
        
        full_path = Path(base_path) / entry.file_path
        img_src = str(full_path) if full_path.exists() else "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect fill='%23eee' width='200' height='200'/><text fill='%23999' font-family='sans-serif' font-size='14' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'>Image Not Found</text></svg>"
        
        card_class = "card"
        if image_issues:
            severities = [i["severity"] for i in image_issues]
            if "error" in severities:
                card_class += " has-issue"
            else:
                card_class += " warning"
        
        html_content += f"""
        <div class="{card_class}">
            <img src="{img_src}" alt="{image_id}">
            <div class="info">
                <h3>{image_id}</h3>
                <p><strong>Size:</strong> {entry.width} x {entry.height}</p>
                <p><strong>Path:</strong> {entry.file_path}</p>"""
        
        if image_issues:
            html_content += """
                <p><strong>Issues:</strong></p>
                <div>"""
            for issue in image_issues:
                badge_class = "error" if issue["severity"] == "error" else "warning"
                html_content += f"""
                    <span class="issue-badge {badge_class}">{issue['issue_type']}</span>"""
            html_content += """
                </div>"""
        
        html_content += """
            </div>
        </div>"""
    
    html_content += """
    </div>
</body>
</html>"""
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)