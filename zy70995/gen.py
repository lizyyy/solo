import pathlib
p = pathlib.Path("app/main.py")
lines = p.read_text().splitlines()
lines.append("")
lines.append("def classify_submission(db, submission, task):")
lines.append("    apd = submission.subsidy_amount / submission.meal_days if submission.meal_days > 0 else 0")
