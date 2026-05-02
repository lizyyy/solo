import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any


def create_sample_html(output_path: Path) -> None:
    html_content = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>示例网页</title>
    <style>
        @font-face {
            font-family: 'Noto Sans SC';
            src: url('fonts/noto-sans-sc.woff2') format('woff2');
        }
        
        body {
            font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
        }
        
        h1 {
            font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
        }
        
        .special {
            font-family: 'Arial Black', sans-serif;
        }
    </style>
</head>
<body>
    <h1 style="font-family: 'SimHei', sans-serif;">品牌宣传页面</h1>
    <p>这是一段使用 Noto Sans SC 字体的文本。</p>
    <p class="special">这段使用 Arial Black 字体。</p>
    <font face="Times New Roman">这是旧格式的字体声明。</font>
</body>
</html>
"""
    output_path.write_text(html_content, encoding="utf-8")


def create_sample_css(output_path: Path) -> None:
    css_content = """.header {
    font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 24px;
}

.body-text {
    font-family: 'Noto Sans SC', sans-serif;
    line-height: 1.6;
}

@font-face {
    font-family: 'CustomFont';
    src: url('custom-font.woff2') format('woff2');
}

.highlight {
    font-family: 'Arial', 'Helvetica', sans-serif;
    font-weight: bold;
}
"""
    output_path.write_text(css_content, encoding="utf-8")


def create_sample_svg(output_path: Path) -> None:
    svg_content = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
    <style>
        .title { font-family: 'Microsoft YaHei', sans-serif; font-size: 24px; }
        .subtitle { font-family: 'Arial', sans-serif; font-size: 16px; }
    </style>
    <text x="20" y="50" class="title" font-family="SimHei">品牌标识</text>
    <text x="20" y="100" class="subtitle">Brand Identity</text>
    <text x="20" y="150" style="font-family: 'Times New Roman', serif;">Tagline</text>
</svg>
"""
    output_path.write_text(svg_content, encoding="utf-8")


def create_sample_manifest(output_path: Path) -> None:
    manifest = {
        "name": "品牌设计项目",
        "version": "1.0.0",
        "fonts": {
            "primary": "PingFang SC",
            "secondary": "Noto Sans SC",
            "english": "Arial",
            "heading": "Microsoft YaHei Bold"
        },
        "metadata": {
            "created_at": "2024-01-01",
            "client": "示例客户",
            "font_licenses": [
                {"font": "PingFang SC", "license": "Apple System"},
                {"font": "Noto Sans SC", "license": "SIL Open Font"}
            ]
        }
    }
    output_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


def create_sample_config(output_path: Path) -> None:
    now = datetime.now()
    future = now + timedelta(days=365)
    past = now - timedelta(days=30)
    
    config = {
        "version": "1.0",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "fonts": {
            "PingFang SC": {
                "font_name": "PingFang SC",
                "font_hash": "abc123def456",
                "license_type": "系统授权",
                "allowed_usage": ["print", "web", "presentation"],
                "allowed_regions": ["CN", "US", "EU"],
                "start_date": "2020-01-01",
                "end_date": None,
                "is_perpetual": True,
                "authorized_for": [],
                "notes": "Apple 系统字体，免费商用"
            },
            "Noto Sans SC": {
                "font_name": "Noto Sans SC",
                "font_hash": "xyz789123",
                "license_type": "SIL Open Font",
                "allowed_usage": ["print", "web", "presentation"],
                "allowed_regions": ["GLOBAL"],
                "start_date": "2020-01-01",
                "end_date": None,
                "is_perpetual": True,
                "authorized_for": [],
                "notes": "Google 开源字体，SIL 授权"
            },
            "Microsoft YaHei": {
                "font_name": "Microsoft YaHei",
                "font_hash": "msyh456789",
                "license_type": "系统授权",
                "allowed_usage": ["print", "web", "presentation"],
                "allowed_regions": ["CN"],
                "start_date": "2020-01-01",
                "end_date": None,
                "is_perpetual": True,
                "authorized_for": [],
                "notes": "Windows 系统字体"
            },
            "Arial": {
                "font_name": "Arial",
                "font_hash": "arial12345",
                "license_type": "系统授权",
                "allowed_usage": ["print", "web", "presentation"],
                "allowed_regions": ["GLOBAL"],
                "start_date": "2020-01-01",
                "end_date": None,
                "is_perpetual": True,
                "authorized_for": [],
                "notes": "系统字体"
            },
            "ExpiredFont": {
                "font_name": "ExpiredFont",
                "font_hash": "expired123",
                "license_type": "商业授权",
                "allowed_usage": ["print"],
                "allowed_regions": ["CN"],
                "start_date": "2023-01-01",
                "end_date": past.strftime("%Y-%m-%d"),
                "is_perpetual": False,
                "authorized_for": [],
                "notes": "已过期的测试字体"
            }
        },
        "clients": {
            "demo-client": {
                "client_id": "demo-client",
                "client_name": "演示客户",
                "default_region": "CN",
                "allowed_fonts": [],
                "blacklisted_fonts": ["Times New Roman"],
                "notes": "用于演示的客户配置"
            }
        },
        "projects": {
            "demo-project": {
                "project_id": "demo-project",
                "project_name": "演示项目",
                "client_id": "demo-client",
                "usage_type": ["print", "web"],
                "region": "CN",
                "start_date": now.strftime("%Y-%m-%d"),
                "end_date": future.strftime("%Y-%m-%d"),
                "fonts": ["PingFang SC", "Noto Sans SC"],
                "output_directories": ["./output"],
                "notes": "用于演示的项目配置"
            }
        },
        "default_allowed_fonts": [
            "PingFang SC",
            "Noto Sans SC",
            "Microsoft YaHei",
            "Arial",
            "Helvetica",
            "sans-serif",
            "serif"
        ],
        "default_blacklisted_fonts": [
            "Comic Sans MS",
            "Papyrus"
        ]
    }
    
    output_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")


def create_sample_scan_result(output_path: Path) -> None:
    scan_results = [
        {
            "font_name": "PingFang SC",
            "file_path": "./assets/page.html",
            "file_type": "html",
            "page": None,
            "section": "style",
            "context": None,
            "detected_from": "inline_css",
            "metadata": {}
        },
        {
            "font_name": "Microsoft YaHei",
            "file_path": "./assets/page.html",
            "file_type": "html",
            "page": None,
            "section": None,
            "context": None,
            "detected_from": "style_attribute",
            "metadata": {}
        },
        {
            "font_name": "Noto Sans SC",
            "file_path": "./assets/page.html",
            "file_type": "html",
            "page": None,
            "section": "style",
            "context": None,
            "detected_from": "inline_css",
            "metadata": {}
        },
        {
            "font_name": "Arial Black",
            "file_path": "./assets/page.html",
            "file_type": "html",
            "page": None,
            "section": "style",
            "context": None,
            "detected_from": "inline_css",
            "metadata": {}
        },
        {
            "font_name": "Times New Roman",
            "file_path": "./assets/page.html",
            "file_type": "html",
            "page": None,
            "section": None,
            "context": None,
            "detected_from": "font_face",
            "metadata": {}
        },
        {
            "font_name": "PingFang SC",
            "file_path": "./assets/styles.css",
            "file_type": "css",
            "page": None,
            "section": None,
            "context": None,
            "detected_from": "font_family",
            "metadata": {}
        },
        {
            "font_name": "Noto Sans SC",
            "file_path": "./assets/styles.css",
            "file_type": "css",
            "page": None,
            "section": None,
            "context": None,
            "detected_from": "font_family",
            "metadata": {}
        },
        {
            "font_name": "Arial",
            "file_path": "./assets/styles.css",
            "file_type": "css",
            "page": None,
            "section": None,
            "context": None,
            "detected_from": "font_family",
            "metadata": {}
        },
        {
            "font_name": "Microsoft YaHei",
            "file_path": "./assets/logo.svg",
            "file_type": "svg",
            "page": None,
            "section": None,
            "context": None,
            "detected_from": "attribute",
            "metadata": {}
        },
        {
            "font_name": "Arial",
            "file_path": "./assets/logo.svg",
            "file_type": "svg",
            "page": None,
            "section": "style",
            "context": None,
            "detected_from": "inline_css",
            "metadata": {}
        },
        {
            "font_name": "Times New Roman",
            "file_path": "./assets/logo.svg",
            "file_type": "svg",
            "page": None,
            "section": None,
            "context": None,
            "detected_from": "style_attribute",
            "metadata": {}
        }
    ]
    
    output_path.write_text(json.dumps(scan_results, indent=2, ensure_ascii=False), encoding="utf-8")


def create_demo_directory(target_path: Path) -> None:
    target_path.mkdir(parents=True, exist_ok=True)
    
    assets_dir = target_path / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    
    create_sample_html(assets_dir / "page.html")
    create_sample_css(assets_dir / "styles.css")
    create_sample_svg(assets_dir / "logo.svg")
    create_sample_manifest(assets_dir / "manifest.json")
    create_sample_config(target_path / "font-auditor.json")
    create_sample_scan_result(target_path / "scan-example.json")
    
    readme_content = """# 字体授权巡检员演示目录

此目录包含用于演示字体授权巡检员工具的示例文件。

## 快速开始

```bash
# 1. 初始化配置（如果还没有）
font-auditor init

# 2. 扫描 assets 目录中的字体使用
font-auditor scan ./assets -o scan.json

# 3. 检查字体授权合规性
font-auditor check scan.json -q quarantine.json

# 4. 生成报告
font-auditor report -s scan.json -q quarantine.json -o ./reports
```

## 目录结构

```
demo/
├── assets/
│   ├── page.html      - 示例 HTML 文件，包含多种字体声明
│   ├── styles.css     - 示例 CSS 文件
│   ├── logo.svg       - 示例 SVG 矢量图
│   └── manifest.json  - 项目清单文件
├── font-auditor.json  - 示例配置文件（授权台账）
├── scan-example.json  - 预生成的扫描结果示例
└── README.md          - 本文件
```

## 示例配置说明

配置文件 `font-auditor.json` 包含：

- **已授权字体**:
  - PingFang SC (永久授权)
  - Noto Sans SC (SIL 开源授权)
  - Microsoft YaHei (系统授权)
  - Arial (系统授权)
  - ExpiredFont (已过期，用于测试)

- **客户配置**:
  - 演示客户 (黑名单: Times New Roman)

- **项目配置**:
  - 演示项目 (用途: print, web; 区域: CN)

## 预期测试结果

运行完整流程后，你应该看到：

1. **扫描结果**: 发现约 11 个字体使用项
2. **合规检查**:
   - 合规字体: PingFang SC, Noto Sans SC, Microsoft YaHei, Arial
   - 违规字体: Times New Roman (在客户黑名单中), Arial Black (未注册)
3. **隔离区**: 包含违规记录
4. **报告**: 生成 Markdown、CSV 和 JSON 格式的报告

## 测试场景

此演示包含以下测试场景：

- ✅ 已授权字体的正常使用
- ❌ 黑名单字体的使用 (Times New Roman)
- ❌ 未授权字体的使用 (Arial Black)
- ⏰ 过期授权的测试 (ExpiredFont 在配置中但未在示例文件中使用)

"""
    (target_path / "README.md").write_text(readme_content, encoding="utf-8")
