"""Sample training data so the service is demo-able out of the box.

We model one 4-session course with 3 students, covering the typical
situations the operator would need to explain: a clean pass, a late-
penalty case, and a makeup approval case.
"""

STUDENTS_CSV = """employee_id,name,email
E001,张伟,zhangwei@company.com
E002,李娜,lina@company.com
E003,王强,wangqiang@company.com
"""

SESSIONS_CSV = """session_id,course_id,session_date,session_name,start_time,late_minutes,required
S1,C001,2026-03-01,第一课,09:00:00,15,true
S2,C001,2026-03-08,第二课,09:00:00,15,true
S3,C001,2026-03-15,第三课,09:00:00,15,true
S4,C001,2026-03-22,第四课,09:00:00,15,true
"""

# E001 全勤全对
# E002 第二课迟到 10 分钟，第三课缺勤
# E003 第二课 makeup（待审核），第三课缺勤
ATTENDANCE_CSV = """employee_id,session_id,status,check_in_time,note
E001,S1,present,08:55,
E001,S2,present,08:58,
E001,S3,present,08:50,
E001,S4,present,09:00,
E002,S1,present,08:52,
E002,S2,late,09:25,
E002,S3,absent,,病假待审批
E002,S4,present,08:58,
E003,S1,present,08:50,
E003,S2,makeup,,补签:出差
E003,S3,absent,,
E003,S4,present,09:00,
"""

HOMEWORK_JSON = """[
  {"employee_id":"E001","course_id":"C001","score":92,"submitted_at":"2026-03-02"},
  {"employee_id":"E001","course_id":"C001","score":88,"submitted_at":"2026-03-09"},
  {"employee_id":"E001","course_id":"C001","score":95,"submitted_at":"2026-03-16"},
  {"employee_id":"E001","course_id":"C001","score":90,"submitted_at":"2026-03-23"},
  {"employee_id":"E002","course_id":"C001","score":78,"submitted_at":"2026-03-02"},
  {"employee_id":"E002","course_id":"C001","score":80,"submitted_at":"2026-03-09"},
  {"employee_id":"E002","course_id":"C001","score":82,"submitted_at":"2026-03-16"},
  {"employee_id":"E002","course_id":"C001","score":85,"submitted_at":"2026-03-23"},
  {"employee_id":"E003","course_id":"C001","score":88,"submitted_at":"2026-03-02"},
  {"employee_id":"E003","course_id":"C001","score":86,"submitted_at":"2026-03-09"},
  {"employee_id":"E003","course_id":"C001","score":89,"submitted_at":"2026-03-16"},
  {"employee_id":"E003","course_id":"C001","score":91,"submitted_at":"2026-03-23"}
]"""

RULES_JSON = """[
  {
    "course_id": "C001",
    "course_name": "管理培训一期",
    "min_attendance_pct": 75.0,
    "pass_score": 80.0,
    "late_deduction": 3.0,
    "late_allowed_count": 0,
    "require_all_homework": false
  }
]"""
