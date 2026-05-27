from .models import Submission, Task, ChangeLog, FieldChange
from .models import CATEGORY_NORMAL, CATEGORY_PENDING, CATEGORY_INTERCEPTED

def classify_submission(db, submission, task):
    avg = submission.subsidy_amount / submission.meal_days if submission.meal_days > 0 else 0
    if not submission.student_id or not submission.class_name:
        return (CATEGORY_PENDING, "学号或班级信息缺失", "请补充学生学号和班级信息")
    if len(submission.student_id) < 6:
        return (CATEGORY_PENDING, "学号格式不规范", "请检查学号格式，长度应不少于6位")
    if submission.meal_days > 31:
        return (CATEGORY_INTERCEPTED, "用餐天数异常", "用餐天数不能超过31天，请核实后重新提交")
    if avg < 300:
        return (CATEGORY_INTERCEPTED, "日均补贴金额过低", "日均补贴低于3元，请核实学生用餐情况")
    if avg > 5000:
        return (CATEGORY_INTERCEPTED, "日均补贴金额过高", "日均补贴超过50元，请核实补贴标准是否正确")
    return (CATEGORY_NORMAL, "信息完整，符合标准", "补贴材料审核通过，进入后续流程")

def log_category_change(db, task, submission, actor_id, reason, old_category, new_category):
    log = ChangeLog(task_id=task.id, submission_id=submission.id, actor_id=actor_id, change_type="category", reason=reason, before_value={"category": old_category}, after_value={"category": new_category})
    db.add(log); db.flush(); return log

def log_state_change(db, task, submission, actor_id, reason, old_state, new_state):
    log = ChangeLog(task_id=task.id, submission_id=submission.id, actor_id=actor_id, change_type="state", reason=reason, before_value={"state": old_state}, after_value={"state": new_state})
    db.add(log); db.flush(); return log

def log_field_changes(db, submission, task, actor_id, reason, field_updates):
    log = ChangeLog(task_id=task.id, submission_id=submission.id, actor_id=actor_id, change_type="field", reason=reason, before_value={k: getattr(submission, k) for k in field_updates.keys()}, after_value=field_updates)
    db.add(log); db.flush()
    for k, v in field_updates.items():
        fc = FieldChange(submission_id=submission.id, change_log_id=log.id, field_name=k, before_value=str(getattr(submission, k)), after_value=str(v))
        db.add(fc)
    db.flush(); return log

