import os

# 读取文件
with open("app/api/endpoints.py", "r") as f:
    content = f.read()

# 修改1: 更新导入语句
content = content.replace(
    "from app.models import Batch, Grievance, BatchStatus, GrievanceStatus",
    "from app.models import Batch, Grievance, BatchStatus, GrievanceStatus, ProcessingHistory"
)
content = content.replace(
    "from app.schemas import Batch as BatchSchema, Grievance as GrievanceSchema, UploadResponse, BatchResultResponse",
    "from app.schemas import Batch as BatchSchema, Grievance as GrievanceSchema, UploadResponse, BatchResultResponse, ProcessingHistory as ProcessingHistorySchema"
)

print("修改1完成")

# 写入文件
with open("app/api/endpoints.py", "w") as f:
    f.write(content)

print("文件已保存")

