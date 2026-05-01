from flask import Flask, render_template, jsonify, request, redirect, url_for, flash
import sys
import os
import csv
from io import StringIO
from flask import make_response
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import DatabaseConnection
from database.schema import DatabaseSchema
from dao.package_template_dao import PackageTemplateDAO
from dao.package_dao import PackageDAO
from dao.cycle_dao import CycleDAO
from business.state_machine import (
    PackageStatus, CycleStatus, IndicatorResult, BusinessRuleError
)
from utils.csv_import_export import CSVImporter, CSVExporter
from utils.report_generator import ReportGenerator


app = Flask(__name__)
app.secret_key = 'sterilization-tracker-secret-key-2026'


@app.context_processor
def inject_now():
    return {'now': datetime.now().strftime('%Y-%m-%d')}


def init_database():
    DatabaseSchema.initialize()
    DatabaseSchema.seed_default_data()


@app.route('/')
def index():
    stats = PackageDAO.count_by_status()
    total = sum(stats.values())
    cycles = CycleDAO.get_all()
    active_cycles = [c for c in cycles if c['status'] == CycleStatus.IN_PROGRESS.value]
    completed_cycles = [c for c in cycles if c['status'] == CycleStatus.COMPLETED.value]
    failed_cycles = [c for c in cycles if c['status'] == CycleStatus.FAILED.value]
    
    return render_template('index.html', 
                          stats=stats, 
                          total=total,
                          cycle_count=len(cycles),
                          active_cycle_count=len(active_cycles),
                          completed_cycle_count=len(completed_cycles),
                          failed_cycle_count=len(failed_cycles))


@app.route('/packages')
def packages():
    status_filter = request.args.get('status', '全部')
    search = request.args.get('search', '')
    
    if status_filter == '全部':
        all_packages = PackageDAO.get_all()
    else:
        all_packages = PackageDAO.get_by_status(status_filter)
    
    if search:
        search_lower = search.lower()
        all_packages = [
            p for p in all_packages
            if search_lower in p['package_number'].lower() or
               search_lower in p['template_name'].lower()
        ]
    
    templates = PackageTemplateDAO.get_all()
    statuses = [s.value for s in PackageStatus]
    
    return render_template('packages.html',
                          packages=all_packages,
                          templates=templates,
                          statuses=statuses,
                          current_filter=status_filter,
                          search=search)


@app.route('/packages/add', methods=['GET', 'POST'])
def add_package():
    if request.method == 'POST':
        template_id = request.form.get('template_id')
        package_number = request.form.get('package_number', '').strip()
        notes = request.form.get('notes', '').strip() or None
        
        if not template_id or not package_number:
            flash('请填写所有必填字段', 'error')
            return redirect(url_for('add_package'))
        
        try:
            PackageDAO.create(int(template_id), package_number, notes)
            flash('器械包创建成功', 'success')
            return redirect(url_for('packages'))
        except Exception as e:
            flash(f'创建失败: {str(e)}', 'error')
    
    templates = PackageTemplateDAO.get_all()
    return render_template('add_package.html', templates=templates)


@app.route('/packages/<int:package_id>/use', methods=['POST'])
def use_package(package_id):
    try:
        pkg = PackageDAO.get_by_id(package_id)
        if not pkg or pkg['status'] != PackageStatus.RELEASED.value:
            flash('只有已放行的器械包可以领用', 'error')
        else:
            PackageDAO.mark_as_used(package_id)
            flash('器械包已领用', 'success')
    except Exception as e:
        flash(f'操作失败: {str(e)}', 'error')
    return redirect(url_for('packages'))


@app.route('/packages/<int:package_id>/discard', methods=['POST'])
def discard_package(package_id):
    reason = request.form.get('reason', '报废')
    try:
        PackageDAO.mark_as_discarded(package_id, reason=reason)
        flash('器械包已报废', 'success')
    except Exception as e:
        flash(f'操作失败: {str(e)}', 'error')
    return redirect(url_for('packages'))


@app.route('/packages/<int:package_id>/history')
def package_history(package_id):
    pkg = PackageDAO.get_by_id(package_id)
    if not pkg:
        flash('器械包不存在', 'error')
        return redirect(url_for('packages'))
    
    history = PackageDAO.get_status_history(package_id)
    return render_template('package_history.html', package=pkg, history=history)


@app.route('/cycles')
def cycles():
    all_cycles = CycleDAO.get_all()
    return render_template('cycles.html', cycles=all_cycles, CycleStatus=CycleStatus)


@app.route('/cycles/add', methods=['GET', 'POST'])
def add_cycle():
    if request.method == 'POST':
        cycle_number = request.form.get('cycle_number', '').strip()
        autoclave_id = request.form.get('autoclave_id', '').strip()
        operator = request.form.get('operator', '').strip()
        temp = request.form.get('temperature', '')
        pressure = request.form.get('pressure', '')
        notes = request.form.get('notes', '').strip() or None
        
        if not cycle_number or not autoclave_id or not operator:
            flash('请填写所有必填字段', 'error')
            return redirect(url_for('add_cycle'))
        
        try:
            temperature = float(temp) if temp else None
            pressure_val = float(pressure) if pressure else None
            
            CycleDAO.create(
                cycle_number=cycle_number,
                autoclave_id=autoclave_id,
                operator=operator,
                temperature=temperature,
                pressure=pressure_val,
                notes=notes
            )
            flash('锅次创建成功', 'success')
            return redirect(url_for('cycles'))
        except Exception as e:
            flash(f'创建失败: {str(e)}', 'error')
    
    default_number = CycleDAO.generate_cycle_number()
    return render_template('add_cycle.html', default_number=default_number)


@app.route('/cycles/<int:cycle_id>')
def cycle_detail(cycle_id):
    cycle = CycleDAO.get_by_id(cycle_id)
    if not cycle:
        flash('锅次不存在', 'error')
        return redirect(url_for('cycles'))
    
    packages = PackageDAO.get_by_cycle(cycle_id)
    available_packages = [
        p for p in PackageDAO.get_all()
        if p['status'] in [PackageStatus.PENDING_STERILIZATION.value, PackageStatus.ISOLATED.value]
    ]
    
    return render_template('cycle_detail.html', 
                          cycle=cycle, 
                          packages=packages,
                          available_packages=available_packages,
                          IndicatorResult=IndicatorResult,
                          PackageStatus=PackageStatus,
                          CycleStatus=CycleStatus)


@app.route('/cycles/<int:cycle_id>/add_package', methods=['POST'])
def add_package_to_cycle(cycle_id):
    package_ids = request.form.getlist('package_ids')
    if not package_ids:
        flash('请选择要添加的器械包', 'error')
        return redirect(url_for('cycle_detail', cycle_id=cycle_id))
    
    added_count = 0
    errors = []
    for pkg_id_str in package_ids:
        try:
            pkg_id = int(pkg_id_str)
            PackageDAO.add_to_cycle(pkg_id, cycle_id)
            added_count += 1
        except Exception as e:
            errors.append(str(e))
    
    if added_count > 0:
        flash(f'成功添加 {added_count} 个器械包', 'success')
    if errors:
        flash(f'部分添加失败: {", ".join(errors[:3])}', 'error')
    
    return redirect(url_for('cycle_detail', cycle_id=cycle_id))


@app.route('/cycles/<int:cycle_id>/remove_package/<int:package_id>', methods=['POST'])
def remove_package_from_cycle(cycle_id, package_id):
    reason = request.form.get('reason', '从锅次移除')
    try:
        PackageDAO.remove_from_cycle(package_id, cycle_id, reason)
        flash('器械包已从锅次移除', 'success')
    except Exception as e:
        flash(f'移除失败: {str(e)}', 'error')
    return redirect(url_for('cycle_detail', cycle_id=cycle_id))


@app.route('/cycles/<int:cycle_id>/complete', methods=['POST'])
def complete_cycle(cycle_id):
    bio_result = request.form.get('biological_indicator')
    chem_result = request.form.get('chemical_indicator')
    operator = request.form.get('operator', '').strip() or None
    temp = request.form.get('temperature', '')
    pressure = request.form.get('pressure', '')
    
    try:
        if temp or pressure:
            temperature = float(temp) if temp else None
            pressure_val = float(pressure) if pressure else None
            CycleDAO.update(cycle_id, temperature=temperature, pressure=pressure_val)
        
        CycleDAO.complete_cycle(
            cycle_id=cycle_id,
            biological_indicator=bio_result,
            chemical_indicator=chem_result,
            operator=operator
        )
        flash('锅次已完成，器械包状态更新为待放行', 'success')
    except Exception as e:
        flash(f'操作失败: {str(e)}', 'error')
    
    return redirect(url_for('cycle_detail', cycle_id=cycle_id))


@app.route('/cycles/<int:cycle_id>/release', methods=['POST'])
def release_cycle(cycle_id):
    try:
        released = CycleDAO.release_packages(cycle_id)
        flash(f'成功放行 {released} 个器械包', 'success')
    except Exception as e:
        flash(f'放行失败: {str(e)}', 'error')
    
    return redirect(url_for('cycle_detail', cycle_id=cycle_id))


@app.route('/cycles/<int:cycle_id>/fail', methods=['POST'])
def fail_cycle(cycle_id):
    reason = request.form.get('failure_reason', '').strip()
    if not reason:
        flash('请输入失败原因', 'error')
        return redirect(url_for('cycle_detail', cycle_id=cycle_id))
    
    try:
        CycleDAO.fail_cycle(cycle_id, reason)
        flash('锅次已标记为失败，相关器械包已隔离', 'success')
    except Exception as e:
        flash(f'操作失败: {str(e)}', 'error')
    
    return redirect(url_for('cycle_detail', cycle_id=cycle_id))


@app.route('/trace')
def trace():
    package_number = request.args.get('package_number', '')
    pkg = None
    history = []
    
    if package_number:
        pkg = PackageDAO.get_by_number(package_number)
        if pkg:
            history = PackageDAO.get_status_history(pkg['id'])
        else:
            flash(f'未找到器械包: {package_number}', 'error')
    
    return render_template('trace.html', 
                          package_number=package_number,
                          package=pkg,
                          history=history)


@app.route('/reports')
def reports():
    return render_template('reports.html')


@app.route('/reports/inventory')
def report_inventory():
    report = ReportGenerator.generate_inventory_report()
    text = ReportGenerator.format_report_text(report, '库存报告')
    return render_template('report_view.html', title='库存报告', content=text)


@app.route('/reports/failed_cycles')
def report_failed_cycles():
    report = ReportGenerator.generate_failed_cycles_report()
    text = ReportGenerator.format_report_text(report, '失败锅次报告')
    return render_template('report_view.html', title='失败锅次报告', content=text)


@app.route('/reports/daily')
def report_daily():
    report = ReportGenerator.generate_daily_summary_report()
    text = ReportGenerator.format_report_text(report, '每日汇总报告')
    return render_template('report_view.html', title='每日汇总报告', content=text)


@app.route('/import', methods=['GET', 'POST'])
def import_packages():
    if request.method == 'POST':
        if 'csv_file' not in request.files:
            flash('没有选择文件', 'error')
            return redirect(request.url)
        
        file = request.files['csv_file']
        if file.filename == '':
            flash('没有选择文件', 'error')
            return redirect(request.url)
        
        if file:
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
                file.save(f.name)
                temp_path = f.name
            
            try:
                imported, skipped, errors = CSVImporter.import_packages(temp_path)
                
                if errors:
                    error_msg = '\n'.join(errors[:10])
                    flash(f'导入完成: 成功{imported}个, 跳过{skipped}个。错误: {error_msg}', 'warning')
                else:
                    flash(f'成功导入 {imported} 个器械包', 'success')
            except Exception as e:
                flash(f'导入失败: {str(e)}', 'error')
            finally:
                import os
                os.unlink(temp_path)
            
            return redirect(url_for('packages'))
    
    return render_template('import.html')


@app.route('/export/inventory')
def export_inventory():
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    
    fieldnames = ['id', 'package_number', 'template_name', 'status',
                  'current_cycle_id', 'notes', 'created_at', 'updated_at']
    writer.writerow(fieldnames)
    
    packages = PackageDAO.get_all()
    for pkg in packages:
        writer.writerow([
            pkg.get('id', ''),
            pkg.get('package_number', ''),
            pkg.get('template_name', ''),
            pkg.get('status', ''),
            pkg.get('current_cycle_id', ''),
            pkg.get('notes', ''),
            pkg.get('created_at', ''),
            pkg.get('updated_at', '')
        ])
    
    output.seek(0)
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = "attachment; filename=inventory.csv"
    response.headers["Content-type"] = "text/csv"
    return response


@app.route('/export/cycles')
def export_cycles():
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    
    fieldnames = ['cycle_id', 'cycle_number', 'autoclave_id', 'operator',
                  'start_time', 'end_time', 'temperature', 'pressure',
                  'biological_indicator', 'chemical_indicator', 'cycle_status',
                  'failure_reason', 'package_id', 'package_number', 'template_name',
                  'package_status']
    writer.writerow(fieldnames)
    
    cycles = CycleDAO.get_all()
    for cycle in cycles:
        packages = CycleDAO.get_cycle_packages_history(cycle['id'])
        for pkg in packages:
            writer.writerow([
                cycle.get('id', ''),
                cycle.get('cycle_number', ''),
                cycle.get('autoclave_id', ''),
                cycle.get('operator', ''),
                cycle.get('start_time', ''),
                cycle.get('end_time', ''),
                cycle.get('temperature', ''),
                cycle.get('pressure', ''),
                cycle.get('biological_indicator', ''),
                cycle.get('chemical_indicator', ''),
                cycle.get('status', ''),
                cycle.get('failure_reason', ''),
                pkg.get('package_id', ''),
                pkg.get('package_number', ''),
                pkg.get('template_name', ''),
                pkg.get('status', '')
            ])
    
    output.seek(0)
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = "attachment; filename=cycle_traceability.csv"
    response.headers["Content-type"] = "text/csv"
    return response


@app.route('/api/packages')
def api_packages():
    status_filter = request.args.get('status')
    if status_filter:
        packages = PackageDAO.get_by_status(status_filter)
    else:
        packages = PackageDAO.get_all()
    return jsonify({'packages': packages})


@app.route('/api/cycles')
def api_cycles():
    cycles = CycleDAO.get_all()
    return jsonify({'cycles': cycles})


@app.route('/api/cycles/<int:cycle_id>/packages')
def api_cycle_packages(cycle_id):
    packages = PackageDAO.get_by_cycle(cycle_id)
    return jsonify({'packages': packages})


if __name__ == '__main__':
    init_database()
    app.run(debug=True, host='0.0.0.0', port=5000)
