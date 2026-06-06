#!/usr/bin/env python3
# 复盘脚本: 夏日电音节 - 2026-07-15
# 生成时间: 2026-06-06 23:50:45
# 此脚本可完整复现该场次的所有操作

import sys
sys.path.insert(0, '.')

from datetime import datetime
from src.models import *
from src.importer import ImportEngine
from src.rules import BoundaryRuleEngine
from src.workflow import WorkflowEngine
from src.history import HistoryEngine
from src.storage import ShowStorage

storage = ShowStorage()

# ========== 1. 创建场次 ==========
show = DJShow(
    id="show_c2e8db67",
    name="夏日电音节",
    date=datetime.fromisoformat("2026-07-15T00:00:00"),
    venue="上海体育馆",
    dj_name="DJ MAX",
)

# ========== 导入排练群接龙 (1/1) ==========
raw_content_0 = """
批次:A区VIP
张三 售票 ¥880 10排5座 备注:媒体嘉宾
李四 售票 ¥880 10排6座
王五 赠票  10排7座 备注:主办方邀请

批次:B区普通
赵六 售票 ¥380 20排1座
钱七 售票 ¥380 20排2座

批次:C区赠票
孙八 赠票  30排1座 备注:合作方
周九 赠票  30排2座
"""
result = ImportEngine.import_rehearsal(
    show=show,
    source_filename="demo_rehearsal.txt",
    raw_content=raw_content_0,
    imported_by="阿梅",
)
print('导入结果:', result)

# ========== 上传合同截图 (1/1) ==========
WorkflowEngine.upload_contract_screenshot(
    show=show,
    image_path="data/contract_screenshot.jpg",
    uploaded_by="阿梅",
    ocr_text=None,
    linked_batch_ids=[],
    note="合同页第一页",
)

# ========== 修改记录 (1/3) ==========
# [2026-06-06 23:48:37.251348] 阿梅 修改 batch.status
# mixed → pending_review
# 原因: 送录音师复核

# ========== 修改记录 (2/3) ==========
# [2026-06-06 23:48:37.253033] 阿梅 修改 workflow.stage
# stage_1_imported → stage_2_contract_reviewed
# 原因: 合同已核对

# ========== 修改记录 (3/3) ==========
# [2026-06-06 23:48:37.253731] 阿梅 修改 workflow.stage
# stage_2_contract_reviewed → stage_3_authorized
# 原因: 授权更新

# ========== 保存结果 ==========
storage.save_show(show)
print("场次已保存:", show.id)
print("当前阶段:", WorkflowEngine.get_stage_description(show.workflow_stage))
print("复盘完成!")
