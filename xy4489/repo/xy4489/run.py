from app import create_app, db
from app.models import (
    Student, Instructor, Certificate, MedicalRecord,
    Cylinder, DiveSite, WeatherForecast, CourseSchedule
)

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'Student': Student,
        'Instructor': Instructor,
        'Certificate': Certificate,
        'MedicalRecord': MedicalRecord,
        'Cylinder': Cylinder,
        'DiveSite': DiveSite,
        'WeatherForecast': WeatherForecast,
        'CourseSchedule': CourseSchedule
    }

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    print("=" * 50)
    print("潜水训练馆风险评估系统已启动")
    print("=" * 50)
    print("")
    print("API 端点:")
    print("  GET  /api/health                    - 健康检查")
    print("")
    print("学员管理:")
    print("  GET  /api/students                  - 获取学员列表")
    print("  POST /api/students                  - 添加学员")
    print("  GET  /api/students/<id>             - 获取学员详情")
    print("")
    print("教练管理:")
    print("  GET  /api/instructors               - 获取教练列表")
    print("  POST /api/instructors               - 添加教练")
    print("")
    print("证书与体检:")
    print("  GET  /api/certificates              - 获取证书列表")
    print("  POST /api/certificates              - 添加证书")
    print("  GET  /api/medical-records           - 获取体检记录")
    print("  POST /api/medical-records           - 添加体检记录")
    print("")
    print("气瓶管理:")
    print("  GET  /api/cylinders                 - 获取气瓶列表")
    print("  POST /api/cylinders                 - 添加气瓶")
    print("  POST /api/cylinders/<id>/fill       - 记录充气")
    print("")
    print("潜点与海况:")
    print("  GET  /api/dive-sites                - 获取潜点列表")
    print("  POST /api/dive-sites                - 添加潜点")
    print("  GET  /api/weather-forecasts         - 获取海况预报")
    print("  POST /api/weather-forecasts         - 添加海况预报")
    print("")
    print("课程管理:")
    print("  GET  /api/courses                   - 获取课程列表")
    print("  POST /api/courses                   - 创建课程")
    print("  POST /api/courses/<id>/enroll       - 学员报名")
    print("")
    print("风险评估:")
    print("  POST /api/risk-assessment/<course_id>  - 执行风险评估")
    print("  GET  /api/risk-assessment/<course_id>  - 获取评估结果")
    print("  POST /api/risk-assessment/<id>/review  - 人工复核改判")
    print("")
    print("导出功能:")
    print("  GET  /api/export/markdown/<course_id>  - 导出 Markdown 放行单")
    print("  GET  /api/export/audit/<course_id>     - 导出 JSON 审计包")
    print("")
    print("日常汇总:")
    print("  GET  /api/daily-summary?date=YYYY-MM-DD  - 当日课程汇总")
    print("")
    print("=" * 50)
    print("服务运行于: http://localhost:5000")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
