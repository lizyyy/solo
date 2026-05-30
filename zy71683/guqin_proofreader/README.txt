古琴谱指法校对器 - 简明说明
============================

1. 启动
   cd guqin_proofreader
   pip3 install -r requirements.txt
   python3 seed.py                  # 初始化样例数据（仅首次）
   python3 -m uvicorn main:app --port 8000
   浏览器打开 http://localhost:8000/docs 查看全部接口

2. 样例数据（seed.py 已写入）
   谱稿1《流水》id=1  — 指法漏标、重复标注、手工更正、弦号越界、小节错位、版本覆盖
   谱稿2《酒狂》id=2  — 3/4拍号但拍数标为4（伪装正常数据）
   谱稿3《阳关三叠》id=3 — 版本号重复、全小节无指法

3. 核心流程
   POST /reports/proofread         校对：{"score_id":1,"version_id":2}
   POST /reports/compare?old_version_id=1&new_version_id=2   版本比对
   GET  /reports/{id}              查看校对报告
   GET  /reports/{id}/export       导出纯文本报告
   GET  /reports/anomalies/{score_id}  按谱稿定位异常
   GET  /audit                     查操作日志（支持 entity_type/action/version_id 筛选）

4. 失败记录在哪看
   - 校对异常：GET /reports/anomalies/{score_id}?severity=error  筛选严重程度
   - 操作轨迹：GET /audit?entity_type=proofread&limit=50
   - 纯文本报告：GET /reports/{id}/export（含原因分析和关联数据，可直接转发）

5. 重置数据
   删除 guqin_proofreader.db 后重新 python3 seed.py

6. 接口一览
   /scores          谱稿 CRUD
   /scores/{id}/versions  版本管理
   /fingering/annotations 指法标注
   /fingering/measures    小节位置
   /annotations           学生批注（含标记已解决）
   /reports/proofread     发起校对
   /reports/compare       版本比对
   /reports/anomalies     异常定位
   /reports/{id}/export   报告导出
   /audit                 操作日志查询
