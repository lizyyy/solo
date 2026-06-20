import re

with open("/Users/lzy/pro/solo/workspaces/zy72497/src/cli.py", "r", encoding="utf-8") as f:
    content = f.read()

old_pattern = r'''            elif "confirm_normal" in log\.action or \(log_action == "confirm_normal"\):
                steps\.append\(\{
                    "name": f"确认正常 \{r\.complaint_id\}",
                    "action": "confirm",
                    "params": \{
                        "complaint_id": r\.complaint_id,
                        "operator": log\.operator,
                        "is_normal": True,
                        "note": log\.details\.get\("note", ""\),
                    \},
                \}\)
            elif "confirm_abnormal" in log\.action or \(log_action == "confirm_abnormal"\):
                steps\.append\(\{
                    "name": f"确认异常 \{r\.complaint_id\}",
                    "action": "confirm",
                    "params": \{
                        "complaint_id": r\.complaint_id,
                        "operator": log\.operator,
                        "is_normal": False,
                        "note": log\.details\.get\("note", ""\),
                    \},
                \}\)'''

new_text = '''            elif log.new_status == ProcessingStatus.CONFIRMED_ABNORMAL:
                steps.append({
                    "name": f"确认异常 {r.complaint_id}",
                    "action": "confirm",
                    "params": {
                        "complaint_id": r.complaint_id,
                        "operator": log.operator,
                        "is_normal": False,
                        "note": log.details.get("note", ""),
                    },
                })
            elif log.new_status == ProcessingStatus.CONFIRMED_NORMAL:
                steps.append({
                    "name": f"确认正常 {r.complaint_id}",
                    "action": "confirm",
                    "params": {
                        "complaint_id": r.complaint_id,
                        "operator": log.operator,
                        "is_normal": True,
                        "note": log.details.get("note", ""),
                    },
                })'''

new_content = re.sub(old_pattern, new_text, content)

with open("/Users/lzy/pro/solo/workspaces/zy72497/src/cli.py", "w", encoding="utf-8") as f:
    f.write(new_content)

print("修改完成")
print("确认修改成功:", "log.new_status == ProcessingStatus.CONFIRMED_ABNORMAL" in new_content)
