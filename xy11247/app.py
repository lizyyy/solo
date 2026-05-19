from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from models import db, ImportBatch
from services import ImportService, ReviewService, ExportService
import json

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
db.init_app(app)

@app.before_request
def create_tables():
    db.create_all()

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': '公益书库后端服务运行正常'})

@app.route('/api/import/batch', methods=['POST'])
def batch_import():
    try:
        data = request.get_json()
        if not data or 'records' not in data:
            return jsonify({
                'success': False,
                'message': '参数错误：缺少records字段'
            }), 400
        
        records = data['records']
        created_by = data.get('created_by', 'system')
        
        if not isinstance(records, list):
            return jsonify({
                'success': False,
                'message': 'records必须是数组格式'
            }), 400
        
        results = ImportService.batch_import(records, created_by)
        
        return jsonify({
            'success': True,
            'message': f'批量导入完成：成功{len(results["success"])}条，失败{len(results["failed"])}条，重复{len(results["duplicate"])}条',
            'data': results
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'服务器错误：{str(e)}'
        }), 500

@app.route('/api/import/batches', methods=['GET'])
def get_batches():
    try:
        batches = ImportBatch.query.order_by(ImportBatch.created_at.desc()).all()
        result = []
        for batch in batches:
            result.append({
                'id': batch.id,
                'batch_no': batch.batch_no,
                'total_count': batch.total_count,
                'success_count': batch.success_count,
                'failed_count': batch.failed_count,
                'duplicate_count': batch.duplicate_count,
                'created_by': batch.created_by,
                'created_at': batch.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'is_reviewed': batch.is_reviewed,
                'reviewed_at': batch.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if batch.reviewed_at else None
            })
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/import/records', methods=['GET'])
def get_import_records():
    try:
        batch_id = request.args.get('batch_id')
        status = request.args.get('status')
        
        records = ExportService.get_import_records(batch_id, status)
        return jsonify({'success': True, 'data': records})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/review/record/<int:record_id>', methods=['POST'])
def review_record(record_id):
    try:
        data = request.get_json()
        action = data.get('action')
        reviewer = data.get('reviewer', 'system')
        remark = data.get('remark', '')
        
        if not action:
            return jsonify({'success': False, 'message': '缺少action参数'}), 400
        
        success, message = ReviewService.review_record(record_id, reviewer, action, remark)
        return jsonify({'success': success, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    try:
        inventory = ExportService.get_inventory_list()
        return jsonify({'success': True, 'data': inventory})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/books', methods=['GET'])
def get_books():
    try:
        from models import Book
        books = Book.query.all()
        result = []
        for book in books:
            result.append({
                'id': book.id,
                'isbn': book.isbn,
                'isbn_valid': book.isbn_valid,
                'title': book.title,
                'author': book.author,
                'publisher': book.publisher,
                'created_at': book.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        from models import Book, BookInventory
        total_books = Book.query.count()
        total_inventory = db.session.query(db.func.sum(BookInventory.quantity)).scalar() or 0
        total_batches = ImportBatch.query.count()
        
        return jsonify({
            'success': True,
            'data': {
                'total_books': total_books,
                'total_inventory': total_inventory,
                'total_batches': total_batches
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/docs', methods=['GET'])
def get_api_docs():
    docs = {
        'title': '公益书库后端API文档',
        'endpoints': [
            {
                'method': 'GET',
                'path': '/api/health',
                'description': '健康检查',
                'response': {'status': 'ok', 'message': '服务状态'}
            },
            {
                'method': 'POST',
                'path': '/api/import/batch',
                'description': '批量导入书籍',
                'request': {
                    'records': [{'isbn': 'xxx', 'title': '书名', 'author': '作者', 'condition': '品相', 'grade': '年级', 'quantity': 1}],
                    'created_by': '操作人'
                },
                'response': {'success': True, 'message': '导入结果', 'data': {'success': [], 'failed': [], 'duplicate': []}}
            },
            {
                'method': 'GET',
                'path': '/api/import/batches',
                'description': '获取所有导入批次'
            },
            {
                'method': 'GET',
                'path': '/api/import/records',
                'description': '获取导入记录',
                'params': {'batch_id': '批次ID（可选）', 'status': '状态过滤（可选）'}
            },
            {
                'method': 'POST',
                'path': '/api/review/record/{record_id}',
                'description': '复核单条记录',
                'request': {'action': 'approve/reject/force_import', 'reviewer': '复核人', 'remark': '备注'}
            },
            {
                'method': 'GET',
                'path': '/api/inventory',
                'description': '获取库存清单（可直接导出）'
            },
            {
                'method': 'GET',
                'path': '/api/books',
                'description': '获取所有书籍信息'
            },
            {
                'method': 'GET',
                'path': '/api/stats',
                'description': '获取统计数据'
            }
        ]
    }
    return jsonify(docs)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
