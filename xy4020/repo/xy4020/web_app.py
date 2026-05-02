# -*- coding: utf-8 -*-
"""
AlkCalc Web 应用
为碱度滴定计算工具提供Web界面
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

from flask import Flask, render_template, request, redirect, url_for, flash, session, send_from_directory
from werkzeug.utils import secure_filename

# 添加当前目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from alkcalc.config import ConfigManager, ProjectConfig, QCThresholds, StandardSolution
from alkcalc.csv_parser import SampleCSVParser, TitrationCSVParser, SampleInfo, TitrationReading, SampleTitrationData
from alkcalc.calculator import GranEndpointCalculator, AlkalinityCalculator, AlkalinityResult, GranFitResult
from alkcalc.quality_control import QualityControlChecker, QCStatus, BatchQCResult, SampleQCResult
from alkcalc.storage import DatabaseManager, CalculationBatch, StoredSampleResult
from alkcalc.reporter import MarkdownReporter, CSVExporter


app = Flask(__name__)
app.config['SECRET_KEY'] = 'alkcalc-secret-key-2024'
app.config['UPLOAD_FOLDER'] = Path(__file__).parent / 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
app.config['PROJECT_DIR'] = Path(__file__).parent / 'web_project'


# 创建必要的目录
app.config['UPLOAD_FOLDER'].mkdir(exist_ok=True)
app.config['PROJECT_DIR'].mkdir(exist_ok=True)


ALLOWED_EXTENSIONS = {'csv', 'txt'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_db_manager():
    """获取数据库管理器"""
    data_dir = app.config['PROJECT_DIR'] / 'alkcalc_data'
    data_dir.mkdir(exist_ok=True)
    return DatabaseManager(data_dir)


def get_config_manager():
    """获取配置管理器"""
    return ConfigManager(str(app.config['PROJECT_DIR']))


def ensure_project_initialized():
    """确保项目已初始化"""
    cm = get_config_manager()
    if not cm.is_project_initialized():
        cm.init_project("AlkCalc Web 项目")
        # 设置默认标准液浓度
        cm.set_standard_solution(0.01000, "默认标准液", "DEFAULT-001")


@app.route('/')
def index():
    """首页"""
    ensure_project_initialized()
    
    # 获取最近的计算批次
    db = get_db_manager()
    batches = db.get_all_batches()
    
    # 获取配置
    cm = get_config_manager()
    config = cm.load_config()
    
    return render_template('index.html', 
                         batches=batches,
                         config=config,
                         now=datetime.now().strftime('%Y-%m-%d %H:%M:%S'))


@app.route('/calculate', methods=['GET', 'POST'])
def calculate():
    """计算页面"""
    ensure_project_initialized()
    
    if request.method == 'POST':
        # 检查是否有文件上传
        if 'samples_file' not in request.files or 'titration_file' not in request.files:
            flash('请上传两个CSV文件', 'error')
            return redirect(request.url)
        
        samples_file = request.files['samples_file']
        titration_file = request.files['titration_file']
        
        if samples_file.filename == '' or titration_file.filename == '':
            flash('请选择要上传的文件', 'error')
            return redirect(request.url)
        
        # 获取表单参数
        batch_name = request.form.get('batch_name', '')
        sample_volume = float(request.form.get('sample_volume', 50.0))
        blank_sample = request.form.get('blank_sample', '')
        standard_concentration = float(request.form.get('standard_concentration', 0.01000))
        
        if not batch_name:
            batch_name = f"计算批次 {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        # 保存上传的文件
        if samples_file and allowed_file(samples_file.filename):
            samples_filename = secure_filename(samples_file.filename)
            samples_path = app.config['UPLOAD_FOLDER'] / samples_filename
            samples_file.save(str(samples_path))
        
        if titration_file and allowed_file(titration_file.filename):
            titration_filename = secure_filename(titration_file.filename)
            titration_path = app.config['UPLOAD_FOLDER'] / titration_filename
            titration_file.save(str(titration_path))
        
        # 执行计算
        try:
            # 解析CSV
            sample_parser = SampleCSVParser()
            titration_parser = TitrationCSVParser()
            
            samples = sample_parser.parse(samples_path)
            titration_data = titration_parser.parse(titration_path)
            
            sample_infos = {s.sample_id: s for s in samples}
            
            # 计算
            gran_calc = GranEndpointCalculator()
            alk_calc = AlkalinityCalculator()
            
            # 获取配置
            cm = get_config_manager()
            config = cm.load_config()
            
            qc_checker = QualityControlChecker(
                min_readings=config.qc_thresholds.min_readings,
                ph_monotonic_tolerance=config.qc_thresholds.ph_monotonic_tolerance,
                duplicate_rpd_limit=config.qc_thresholds.duplicate_rpd_limit
            )
            
            # 计算空白样
            blank_volume = 0.0
            if blank_sample and blank_sample in titration_data:
                try:
                    blank_gran = gran_calc.calculate(
                        titration_data[blank_sample].readings,
                        sample_volume
                    )
                    blank_volume = blank_gran.endpoint_volume_ml
                except:
                    pass
            
            # 计算每个样品
            alkalinity_results: Dict[str, AlkalinityResult] = {}
            calculation_errors: Dict[str, str] = {}
            
            for sample in samples:
                sample_id = sample.sample_id
                
                if sample_id not in titration_data:
                    calculation_errors[sample_id] = "缺少滴定数据"
                    continue
                
                try:
                    gran_result = gran_calc.calculate(
                        titration_data[sample_id].readings,
                        sample_volume
                    )
                    
                    alk_result = alk_calc.calculate(
                        sample_id=sample_id,
                        endpoint_volume_ml=gran_result.endpoint_volume_ml,
                        standard_concentration_mol_l=standard_concentration,
                        sample_volume_used_ml=sample_volume,
                        blank_volume_ml=blank_volume if not sample.is_blank else 0.0,
                        temperature_c=sample.temperature_c,
                        dilution_factor=sample.dilution_factor,
                        gran_fit=gran_result
                    )
                    
                    alkalinity_results[sample_id] = alk_result
                    
                except Exception as e:
                    calculation_errors[sample_id] = str(e)
            
            # 质控检查
            batch_qc_result = qc_checker.check_batch_qc(
                sample_infos=sample_infos,
                titration_data=titration_data,
                alkalinity_results=alkalinity_results,
                standard_concentration=standard_concentration
            )
            
            # 保存到数据库
            db = get_db_manager()
            
            batch = db.create_batch(
                batch_name=batch_name,
                project_name=config.project_name,
                standard_concentration_mol_l=standard_concentration,
                sample_volume_used_ml=sample_volume,
                overall_qc_status=batch_qc_result.overall_status.value,
                notes=f"空白扣除: {blank_sample} = {blank_volume:.4f}ml" if blank_sample else ""
            )
            
            # 保存样品结果
            for sample in samples:
                sample_id = sample.sample_id
                
                if sample_id in alkalinity_results:
                    result = alkalinity_results[sample_id]
                    qc_result = batch_qc_result.sample_results.get(sample_id)
                    
                    db.save_sample_result(
                        batch_id=batch.batch_id,
                        sample_id=sample_id,
                        sampling_point=sample.sampling_point,
                        bottle_number=sample.bottle_number,
                        total_alkalinity_mg_l_caco3=result.total_alkalinity_mg_l_caco3,
                        endpoint_volume_ml=result.endpoint_volume_ml,
                        blank_corrected_volume_ml=result.blank_corrected_volume_ml,
                        temperature_c=sample.temperature_c,
                        dilution_factor=sample.dilution_factor,
                        qc_status=qc_result.status.value if qc_result else QCStatus.PASS.value,
                        is_blank=sample.is_blank,
                        is_duplicate=sample.is_duplicate,
                        parent_sample_id=sample.parent_sample_id,
                        qc_issue_count=len(qc_result.issues) if qc_result else 0,
                        qc_issue_codes=",".join([i.code for i in qc_result.issues]) if qc_result else "",
                        qc_issue_messages="; ".join([i.message for i in qc_result.issues]) if qc_result else ""
                    )
            
            # 生成报告
            reporter = MarkdownReporter()
            csv_exporter = CSVExporter()
            
            output_dir = app.config['PROJECT_DIR'] / 'reports'
            output_dir.mkdir(exist_ok=True)
            
            md_path = output_dir / f"batch_{batch.batch_id}_report.md"
            csv_path = output_dir / f"batch_{batch.batch_id}_results.csv"
            
            reporter.generate_report(batch, list(batch_qc_result.sample_results.values()), str(md_path))
            csv_exporter.export_csv(batch, list(batch_qc_result.sample_results.values()), str(csv_path))
            
            flash(f'计算成功！批次ID: {batch.batch_id}', 'success')
            return redirect(url_for('view_result', batch_id=batch.batch_id))
            
        except Exception as e:
            flash(f'计算失败: {str(e)}', 'error')
            return redirect(request.url)
    
    # GET请求 - 显示表单
    cm = get_config_manager()
    config = cm.load_config()
    
    return render_template('calculate.html', 
                         config=config,
                         default_standard=config.standard_solution.concentration_mol_l if config.standard_solution else 0.01000,
                         now=datetime.now().strftime('%Y-%m-%d %H:%M:%S'))


@app.route('/result/<int:batch_id>')
def view_result(batch_id):
    """查看计算结果"""
    db = get_db_manager()
    
    batch_info = db.get_batch_info(batch_id)
    if not batch_info:
        flash('批次不存在', 'error')
        return redirect(url_for('index'))
    
    sample_results = db.get_sample_results(batch_id)
    
    # 统计
    pass_count = sum(1 for r in sample_results if r.qc_status == 'PASS')
    warning_count = sum(1 for r in sample_results if r.qc_status == 'WARNING')
    fail_count = sum(1 for r in sample_results if r.qc_status == 'FAIL')
    error_count = sum(1 for r in sample_results if r.qc_status == 'ERROR')
    
    # 碱度范围
    alkalinities = [r.total_alkalinity_mg_l_caco3 for r in sample_results if r.total_alkalinity_mg_l_caco3 > 0]
    min_alk = min(alkalinities) if alkalinities else 0
    max_alk = max(alkalinities) if alkalinities else 0
    avg_alk = sum(alkalinities) / len(alkalinities) if alkalinities else 0
    
    return render_template('result.html',
                         batch=batch_info,
                         samples=sample_results,
                         pass_count=pass_count,
                         warning_count=warning_count,
                         fail_count=fail_count,
                         error_count=error_count,
                         min_alk=min_alk,
                         max_alk=max_alk,
                         avg_alk=avg_alk)


@app.route('/history')
def history():
    """历史记录页面"""
    db = get_db_manager()
    batches = db.get_all_batches()
    
    # 获取每个批次的样品数
    for batch in batches:
        sample_count = db.get_sample_count(batch.batch_id)
        batch.sample_count = sample_count
    
    # 统计质控状态
    pass_count = 0
    warning_count = 0
    fail_count = 0
    
    for batch in batches:
        status = batch.overall_qc_status
        if status == 'PASS':
            pass_count += 1
        elif status == 'WARNING':
            warning_count += 1
        else:
            fail_count += 1
    
    stats = {
        'pass_count': pass_count,
        'warning_count': warning_count,
        'fail_count': fail_count
    }
    
    return render_template('history.html', batches=batches, stats=stats)


@app.route('/config', methods=['GET', 'POST'])
def config_page():
    """配置页面"""
    cm = get_config_manager()
    
    if request.method == 'POST':
        try:
            # 更新标准液浓度
            standard_concentration = float(request.form.get('standard_concentration', 0.01000))
            standard_name = request.form.get('standard_name', '盐酸标准溶液')
            standard_batch = request.form.get('standard_batch', '')
            
            # 更新质控阈值
            duplicate_rpd_limit = float(request.form.get('duplicate_rpd_limit', 10.0))
            min_readings = int(request.form.get('min_readings', 5))
            ph_monotonic_tolerance = float(request.form.get('ph_monotonic_tolerance', 0.05))
            
            cm.set_standard_solution(standard_concentration, standard_name, standard_batch)
            cm.set_qc_threshold(
                duplicate_rpd_limit=duplicate_rpd_limit,
                min_readings=min_readings,
                ph_monotonic_tolerance=ph_monotonic_tolerance
            )
            
            flash('配置已更新', 'success')
        except Exception as e:
            flash(f'更新失败: {str(e)}', 'error')
        
        return redirect(url_for('config_page'))
    
    # GET请求
    config = cm.load_config()
    return render_template('config.html', config=config)


@app.route('/download/<int:batch_id>/<file_type>')
def download_file(batch_id, file_type):
    """下载报告文件"""
    output_dir = app.config['PROJECT_DIR'] / 'reports'
    
    if file_type == 'report':
        filename = f"batch_{batch_id}_report.md"
    elif file_type == 'csv':
        filename = f"batch_{batch_id}_results.csv"
    else:
        flash('无效的文件类型', 'error')
        return redirect(url_for('index'))
    
    return send_from_directory(str(output_dir), filename, as_attachment=True)


@app.route('/api/batch/<int:batch_id>')
def api_batch(batch_id):
    """API: 获取批次详情"""
    db = get_db_manager()
    batch = db.get_batch_info(batch_id)
    
    if not batch:
        return {'error': 'Batch not found'}, 404
    
    samples = db.get_sample_results(batch_id)
    
    return {
        'batch_id': batch.batch_id,
        'batch_name': batch.batch_name,
        'created_at': batch.created_at,
        'project_name': batch.project_name,
        'overall_status': batch.overall_qc_status,
        'samples': [{
            'sample_id': s.sample_id,
            'sampling_point': s.sampling_point,
            'bottle_number': s.bottle_number,
            'alkalinity': s.total_alkalinity_mg_l_caco3,
            'qc_status': s.qc_status
        } for s in samples]
    }


# 模板过滤器
@app.template_filter('datetime_format')
def datetime_format(value, format='%Y-%m-%d %H:%M:%S'):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except:
            return value
    return value.strftime(format)


@app.template_filter('status_badge')
def status_badge(status):
    badges = {
        'PASS': '<span class="badge bg-success">PASS</span>',
        'WARNING': '<span class="badge bg-warning text-dark">WARNING</span>',
        'FAIL': '<span class="badge bg-danger">FAIL</span>',
        'ERROR': '<span class="badge bg-secondary">ERROR</span>'
    }
    return badges.get(status, status)


if __name__ == '__main__':
    print("=" * 60)
    print("  AlkCalc 碱度滴定计算工具 - Web版本")
    print("=" * 60)
    print()
    print("正在启动Web服务器...")
    print("请在浏览器中打开: http://localhost:5000")
    print()
    
    app.run(debug=True, host='0.0.0.0', port=5000)
