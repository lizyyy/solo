from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from services import (
    VideoService, BitrateTemplateService, TranscodeTaskService,
    PlaybackService, SubtitleService, StatisticsService, InitializationService
)

app = Flask(__name__)
CORS(app)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/videos', methods=['GET'])
def get_videos():
    videos = VideoService.get_all_videos()
    return jsonify({"success": True, "data": videos})


@app.route('/api/videos', methods=['POST'])
def create_video():
    data = request.json
    required_fields = ['name', 'size', 'duration', 'format']
    if not all(field in data for field in required_fields):
        return jsonify({"success": False, "message": "缺少必填字段"}), 400
    
    video = VideoService.create_video(
        name=data['name'],
        size=data['size'],
        duration=data['duration'],
        format=data['format'],
        has_subtitle=data.get('has_subtitle', False),
        subtitle_languages=data.get('subtitle_languages', []),
        created_by=data.get('created_by', '客服主管')
    )
    return jsonify({"success": True, "data": video})


@app.route('/api/videos/<video_id>', methods=['GET'])
def get_video(video_id):
    video = VideoService.get_video(video_id)
    if not video:
        return jsonify({"success": False, "message": "视频不存在"}), 404
    return jsonify({"success": True, "data": video})


@app.route('/api/templates', methods=['GET'])
def get_templates():
    templates = BitrateTemplateService.get_all_templates()
    return jsonify({"success": True, "data": templates})


@app.route('/api/templates', methods=['POST'])
def create_template():
    data = request.json
    required_fields = ['name', 'bitrate', 'resolution']
    if not all(field in data for field in required_fields):
        return jsonify({"success": False, "message": "缺少必填字段"}), 400
    
    template = BitrateTemplateService.create_template(
        name=data['name'],
        bitrate=data['bitrate'],
        resolution=data['resolution'],
        require_subtitle=data.get('require_subtitle', False),
        subtitle_languages=data.get('subtitle_languages', [])
    )
    return jsonify({"success": True, "data": template})


@app.route('/api/templates/<template_id>', methods=['PUT'])
def update_template(template_id):
    data = request.json
    success = BitrateTemplateService.update_template(template_id, **data)
    if not success:
        return jsonify({"success": False, "message": "模板不存在"}), 404
    template = BitrateTemplateService.get_template(template_id)
    return jsonify({"success": True, "data": template})


@app.route('/api/templates/<template_id>/check-subtitle', methods=['POST'])
def check_subtitle_requirement(template_id):
    data = request.json
    if 'video_id' not in data:
        return jsonify({"success": False, "message": "缺少video_id"}), 400
    
    ok, message = BitrateTemplateService.check_subtitle_requirement(template_id, data['video_id'])
    return jsonify({"success": True, "can_proceed": ok, "message": message})


@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = TranscodeTaskService.get_all_tasks()
    return jsonify({"success": True, "data": tasks})


@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json
    if 'video_id' not in data or 'template_id' not in data:
        return jsonify({"success": False, "message": "缺少video_id或template_id"}), 400
    
    result = TranscodeTaskService.create_task(data['video_id'], data['template_id'])
    if result.get('error'):
        return jsonify({"success": False, "message": result['message']}), 400
    return jsonify({"success": True, "data": result})


@app.route('/api/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    task = TranscodeTaskService.get_task(task_id)
    if not task:
        return jsonify({"success": False, "message": "任务不存在"}), 404
    return jsonify({"success": True, "data": task})


@app.route('/api/tasks/<task_id>/start', methods=['POST'])
def start_task(task_id):
    success = TranscodeTaskService.start_task(task_id)
    if not success:
        return jsonify({"success": False, "message": "任务无法启动"}), 400
    task = TranscodeTaskService.get_task(task_id)
    return jsonify({"success": True, "data": task})


@app.route('/api/tasks/<task_id>/complete', methods=['POST'])
def complete_task(task_id):
    data = request.json
    output_path = data.get('output_path', f'/output/{task_id}.mp4')
    success = TranscodeTaskService.complete_task(task_id, output_path)
    if not success:
        return jsonify({"success": False, "message": "任务无法完成"}), 400
    task = TranscodeTaskService.get_task(task_id)
    return jsonify({"success": True, "data": task})


@app.route('/api/tasks/<task_id>/fail', methods=['POST'])
def fail_task(task_id):
    data = request.json
    error_message = data.get('error_message', '未知错误')
    success = TranscodeTaskService.fail_task(task_id, error_message)
    if not success:
        return jsonify({"success": False, "message": "任务不存在"}), 404
    task = TranscodeTaskService.get_task(task_id)
    return jsonify({"success": True, "data": task})


@app.route('/api/tasks/<task_id>/retry', methods=['POST'])
def retry_task(task_id):
    data = request.json
    reason = data.get('reason', '重试任务')
    operator = data.get('operator', '技术支持')
    
    result = TranscodeTaskService.retry_task(task_id, reason, operator)
    if result.get('error'):
        return jsonify({"success": False, "message": result['message']}), 400
    return jsonify({"success": True, "data": result})


@app.route('/api/tasks/failed', methods=['GET'])
def get_failed_tasks():
    tasks = TranscodeTaskService.get_failed_tasks()
    return jsonify({"success": True, "data": tasks})


@app.route('/api/playback-urls', methods=['GET'])
def get_playback_urls():
    urls = PlaybackService.get_all_urls()
    return jsonify({"success": True, "data": urls})


@app.route('/api/playback-urls/<task_id>', methods=['GET'])
def get_playback_urls_by_task(task_id):
    urls = PlaybackService.get_urls_by_task(task_id)
    return jsonify({"success": True, "data": urls})


@app.route('/api/subtitles', methods=['GET'])
def get_subtitles():
    subtitles = SubtitleService.get_all_subtitles()
    return jsonify({"success": True, "data": subtitles})


@app.route('/api/subtitles', methods=['POST'])
def create_subtitle():
    data = request.json
    required_fields = ['video_id', 'language', 'name']
    if not all(field in data for field in required_fields):
        return jsonify({"success": False, "message": "缺少必填字段"}), 400
    
    subtitle = SubtitleService.create_subtitle(
        video_id=data['video_id'],
        language=data['language'],
        name=data['name']
    )
    return jsonify({"success": True, "data": subtitle})


@app.route('/api/subtitles/<subtitle_id>/approve', methods=['POST'])
def approve_subtitle(subtitle_id):
    success = SubtitleService.approve_subtitle(subtitle_id)
    if not success:
        return jsonify({"success": False, "message": "字幕不存在"}), 404
    return jsonify({"success": True, "message": "字幕已批准"})


@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    stats = StatisticsService.get_statistics()
    return jsonify({"success": True, "data": stats})


@app.route('/api/statistics/daily', methods=['GET'])
def get_daily_stats():
    stats = StatisticsService.get_daily_stats()
    return jsonify({"success": True, "data": stats})


@app.route('/api/init', methods=['POST'])
def initialize_data():
    data = request.json or {}
    clear_first = data.get('clear_first', False)
    
    if clear_first:
        InitializationService.clear_all_data()
    
    success = InitializationService.initialize_from_sample()
    if not success:
        return jsonify({"success": False, "message": "初始化数据文件不存在"}), 404
    
    return jsonify({"success": True, "message": "数据初始化完成"})


@app.errorhandler(404)
def not_found(error):
    return jsonify({"success": False, "message": "接口不存在"}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"success": False, "message": "服务器内部错误"}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
