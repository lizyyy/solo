#!/usr/bin/env python3
"""
生态样方复核看板主程序
"""

import os
import shutil
import json
from pathlib import Path
from modules import data_parser, metrics, validation, exporter
from flask import Flask, render_template, jsonify, request

app = Flask(__name__, template_folder='static/templates')

DATA_DIR = Path("data")
EXAMPLE_DIR = Path("example_data")


def init_data():
    """初始化数据目录，复制示例数据"""
    if not DATA_DIR.exists():
        DATA_DIR.mkdir()
        for file in EXAMPLE_DIR.iterdir():
            if file.is_file():
                shutil.copy(file, DATA_DIR / file.name)


def process_data():
    """处理所有数据并返回结果"""
    parser = data_parser.DataParser(str(DATA_DIR))
    
    df = parser.load_quadrat_csv("quadrat_survey.csv")
    species_list = parser.load_species_json("species_list.json")
    geojson = parser.load_quadrat_geojson("quadrat_coords.geojson")
    rules = parser.load_rules_yaml("rules.yaml")
    
    df['species_name'] = df['species_name'].apply(
        lambda x: parser.normalize_species_name(x, species_list.get('synonyms', {}))
    )
    
    quadrat_metrics = metrics.DiversityMetrics.calculate_quadrat_diversity(df)
    site_metrics = metrics.DiversityMetrics.calculate_site_diversity(df)
    
    validator = validation.DataValidator(species_list, rules)
    anomalies = validator.validate_all(df)
    
    return {
        'survey_data': df.to_dict(orient='records'),
        'quadrat_metrics': quadrat_metrics.to_dict(orient='records'),
        'site_metrics': site_metrics.to_dict(orient='records'),
        'anomalies': anomalies,
        'geojson': geojson,
        'species_list': species_list,
        'sites': df['site_id'].unique().tolist()
    }


@app.route('/')
def index():
    return render_template('dashboard.html')


@app.route('/api/data')
def get_data():
    data = process_data()
    return jsonify(data)


@app.route('/api/export', methods=['POST'])
def export_data():
    data = process_data()
    
    import pandas as pd
    quadrat_metrics_df = pd.DataFrame(data['quadrat_metrics'])
    site_metrics_df = pd.DataFrame(data['site_metrics'])
    
    summary_path = exporter.DataExporter.export_summary_md(
        quadrat_metrics_df,
        site_metrics_df,
        data['anomalies'],
        "summary.md"
    )
    
    anomalies_path = exporter.DataExporter.export_anomalies_csv(
        data['anomalies'],
        "anomalies.csv"
    )
    
    return jsonify({
        'success': True,
        'summary_path': summary_path,
        'anomalies_path': anomalies_path
    })


if __name__ == '__main__':
    init_data()
    print("生态样方复核看板启动中...")
    print("访问 http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
