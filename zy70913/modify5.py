with open("app/api/__init__.py", "r") as f:
    content = f.read()

content = content.replace('prefix="/grievance"', 'prefix="/grievances"')
print("修改5完成")

with open("app/api/__init__.py", "w") as f:
    f.write(content)
print("文件已保存")
