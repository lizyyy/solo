from datetime import datetime, timedelta
from models import ClassificationType


def calculate_expiry_classification(expiry_date: datetime, production_date: datetime = None):
    """
    根据有效期计算分类
    """
    today = datetime.now().date()
    expiry_date_only = expiry_date.date()
    
    days_remaining = (expiry_date_only - today).days
    
    if days_remaining <= 0:
        return {
            "classification": ClassificationType.BLOCKED,
            "reason": f"耗材已过期（剩余{days_remaining}天）",
            "follow_up_action": "立即下架，联系供应商处理退货或销毁，禁止入库使用"
        }
    elif days_remaining <= 30:
        return {
            "classification": ClassificationType.BLOCKED,
            "reason": f"效期不足30天（剩余{days_remaining}天）",
            "follow_up_action": "拦截入库，联系采购确认是否退换货，特殊情况需质控审批"
        }
    elif days_remaining <= 90:
        return {
            "classification": ClassificationType.PENDING_SUPPLEMENT,
            "reason": f"效期不足90天（剩余{days_remaining}天）",
            "follow_up_action": "标记为近效期，优先出库使用，监控库存周转情况"
        }
    elif days_remaining <= 180:
        return {
            "classification": ClassificationType.PENDING_SUPPLEMENT,
            "reason": f"效期不足180天（剩余{days_remaining}天）",
            "follow_up_action": "重点关注，制定使用计划，定期检查库存状况"
        }
    else:
        return {
            "classification": ClassificationType.NORMAL,
            "reason": f"效期正常（剩余{days_remaining}天）",
            "follow_up_action": "正常入库，按常规流程管理库存"
        }


def generate_batch_signature(items):
    """
    生成批次签名，用于识别重复提交
    签名基于物料编码、批号、数量的组合
    """
    import hashlib
    
    item_signatures = []
    for item in items:
        item_str = f"{item.material_code}_{item.batch_no}_{item.quantity}"
        item_signatures.append(item_str)
    
    combined = "|".join(sorted(item_signatures))
    return hashlib.md5(combined.encode()).hexdigest()
