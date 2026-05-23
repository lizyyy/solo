import os

# 读取文件
with open("app/api/endpoints.py", "r") as f:
    content = f.read()

# 修改2: 添加 flight_file 和 photo_file 参数
old_func_def = """async def upload_files(
    grievance_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):"""

new_func_def = """async def upload_files(
    grievance_file: UploadFile = File(...),
    flight_file: Optional[UploadFile] = File(None),
    photo_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):"""

content = content.replace(old_func_def, new_func_def)

print("修改2完成")

# 写入文件
with open("app/api/endpoints.py", "w") as f:
    f.write(content)

print("文件已保存")

