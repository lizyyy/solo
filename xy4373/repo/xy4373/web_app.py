import os
import sys
from flask import Flask, render_template, jsonify, request, send_file
from datetime import datetime

# 添加当前目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from scanner import FileScanner
from checker import Checker
from state_manager import StateManager
from config import config


def create_app():
    """创建Flask应用"""
    app = Flask(__name__)
    
    # 初始化状态管理器
    state_manager = StateManager()
    
    # ==================== 页面路由 ====================
    
    @app.route('/')
    def index():
        """首页"""
        return render_template('index.html')
    
    @app.route('/dashboard')
    def dashboard():
        """仪表板页面"""
        return render_template('dashboard.html')
    
    @app.route('/pending')
    def pending():
        """待处理项页面"""
        return render_template('pending.html')
    
    @app.route('/programs')
    def programs():
        """节目列表页面"""
        return render_template('programs.html')
    
    @app.route('/reports')
    def reports():
        """报告页面"""
        return render_template('reports.html')
    
    # ==================== API 路由 ====================
    
    @app.route('/api/scan', methods=['POST'])
    def api_scan():
        """扫描目录API"""
        data = request.get_json()
        directory_path = data.get('directory', '')
        
        if not directory_path:
            return jsonify({"error": "目录路径不能为空"}), 400
        
        if not os.path.isdir(directory_path):
            return jsonify({"error": f"目录不存在: {directory_path}"}), 400
        
        scanner = FileScanner()
        results = scanner.scan_directory(directory_path)
        
        # 保存扫描结果
        state_manager.save_project_scan(directory_path, results)
        
        return jsonify({
            "success": True,
            "directory": directory_path,
            "programs_count": len(results),
            "programs": results
        })
    
    @app.route('/api/check', methods=['POST'])
    def api_check():
        """检查目录API"""
        data = request.get_json()
        directory_path = data.get('directory', '')
        
        if not directory_path:
            return jsonify({"error": "目录路径不能为空"}), 400
        
        if not os.path.isdir(directory_path):
            return jsonify({"error": f"目录不存在: {directory_path}"}), 400
        
        # 先扫描
        scanner = FileScanner()
        scan_results = scanner.scan_directory(directory_path)
        
        if not scan_results:
            return jsonify({
                "success": False,
                "error": "未找到匹配的节目文件夹",
                "supported_patterns": [
                    {"id": pid, "name": pc.name, "pattern": pc.folder_pattern}
                    for pid, pc in config.programs.items()
                ]
            }), 400
        
        # 保存扫描结果
        state_manager.save_project_scan(directory_path, scan_results)
        
        # 检查每个节目
        checker = Checker()
        check_results = []
        
        for scan_result in scan_results:
            check_result = checker.check_program(scan_result)
            check_results.append(check_result)
            state_manager.save_check_result(check_result)
        
        return jsonify({
            "success": True,
            "directory": directory_path,
            "programs_count": len(check_results),
            "results": check_results
        })
    
    @app.route('/api/programs', methods=['GET'])
    def api_get_programs():
        """获取所有检查结果API"""
        directory_path = request.args.get('directory', '')
        
        check_results = state_manager.get_check_results(
            directory_path if directory_path else None
        )
        
        # 统计信息
        total = len(check_results)
        passed = sum(1 for r in check_results if r["overall_status"] == "passed")
        failed = sum(1 for r in check_results if r["overall_status"] == "failed")
        warning = sum(1 for r in check_results if r["overall_status"] == "warning")
        
        return jsonify({
            "success": True,
            "stats": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "warning": warning
            },
            "programs": check_results
        })
    
    @app.route('/api/pending', methods=['GET'])
    def api_get_pending():
        """获取待处理项API"""
        directory_path = request.args.get('directory', '')
        
        pending_items = state_manager.get_pending_items(
            directory_path if directory_path else None
        )
        
        return jsonify({
            "success": True,
            "count": len(pending_items),
            "items": pending_items
        })
    
    @app.route('/api/confirm', methods=['POST'])
    def api_confirm_fix():
        """确认修复API"""
        data = request.get_json()
        folder_path = data.get('folder_path', '')
        check_type = data.get('check_type', '')
        
        if not folder_path or not check_type:
            return jsonify({"error": "缺少必要参数: folder_path 或 check_type"}), 400
        
        if state_manager.confirm_fix(folder_path, check_type):
            return jsonify({
                "success": True,
                "message": f"已确认修复: {check_type}"
            })
        else:
            return jsonify({"error": "未找到检查结果"}), 404
    
    @app.route('/api/unconfirm', methods=['POST'])
    def api_unconfirm_fix():
        """取消确认修复API"""
        data = request.get_json()
        folder_path = data.get('folder_path', '')
        check_type = data.get('check_type', '')
        
        if not folder_path or not check_type:
            return jsonify({"error": "缺少必要参数: folder_path 或 check_type"}), 400
        
        if state_manager.unconfirm_fix(folder_path, check_type):
            return jsonify({
                "success": True,
                "message": f"已取消确认修复: {check_type}"
            })
        else:
            return jsonify({"error": "未找到检查结果或确认记录"}), 404
    
    @app.route('/api/export', methods=['GET'])
    def api_export_report():
        """导出报告API"""
        directory_path = request.args.get('directory', '')
        format = request.args.get('format', 'json')
        
        if format not in ['json', 'csv', 'html']:
            return jsonify({"error": "不支持的导出格式"}), 400
        
        report_content = state_manager.export_report(
            directory_path if directory_path else None,
            format
        )
        
        if format == 'json':
            return jsonify(report_content)
        elif format == 'csv':
            return report_content, 200, {'Content-Type': 'text/csv; charset=utf-8'}
        elif format == 'html':
            return report_content, 200, {'Content-Type': 'text/html; charset=utf-8'}
    
    @app.route('/api/stats', methods=['GET'])
    def api_get_stats():
        """获取统计信息API"""
        check_results = state_manager.get_check_results()
        pending_items = state_manager.get_pending_items()
        
        total = len(check_results)
        passed = sum(1 for r in check_results if r["overall_status"] == "passed")
        failed = sum(1 for r in check_results if r["overall_status"] == "failed")
        warning = sum(1 for r in check_results if r["overall_status"] == "warning")
        
        # 按严重程度统计待处理项
        severity_stats = {
            "high": sum(1 for i in pending_items if i["severity"] == "high"),
            "medium": sum(1 for i in pending_items if i["severity"] == "medium"),
            "low": sum(1 for i in pending_items if i["severity"] == "low"),
            "info": sum(1 for i in pending_items if i["severity"] == "info")
        }
        
        return jsonify({
            "success": True,
            "programs": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "warning": warning
            },
            "pending": {
                "total": len(pending_items),
                "by_severity": severity_stats
            },
            "last_updated": state_manager._state.get("last_updated")
        })
    
    @app.route('/api/programs/<path:folder_path>', methods=['GET'])
    def api_get_program_detail(folder_path):
        """获取单个节目详情API"""
        # 解码路径
        folder_path = folder_path.replace('%2F', '/')
        
        check_results = state_manager.get_check_results()
        
        for result in check_results:
            if result["folder_path"] == folder_path:
                return jsonify({
                    "success": True,
                    "program": result
                })
        
        return jsonify({"error": "未找到节目"}), 404
    
    @app.route('/api/reset', methods=['POST'])
    def api_reset_state():
        """重置状态API"""
        # 需要确认
        data = request.get_json()
        confirm = data.get('confirm', False)
        
        if not confirm:
            return jsonify({"error": "需要确认操作"}), 400
        
        state_manager.reset_state()
        return jsonify({
            "success": True,
            "message": "状态已重置"
        })
    
    @app.route('/api/supported-programs', methods=['GET'])
    def api_get_supported_programs():
        """获取支持的节目类型API"""
        programs = []
        for program_id, program_config in config.programs.items():
            programs.append({
                "id": program_id,
                "name": program_config.name,
                "folder_pattern": program_config.folder_pattern,
                "expected_cover_width": program_config.expected_cover_width,
                "expected_cover_height": program_config.expected_cover_height,
                "min_audio_duration": program_config.min_audio_duration,
                "max_audio_duration": program_config.max_audio_duration,
                "check_subtitle_sync": program_config.check_subtitle_sync
            })
        
        return jsonify({
            "success": True,
            "programs": programs
        })
    
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host=config.web_host, port=config.web_port, debug=True)
