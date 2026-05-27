from typing import Tuple
from app.models import DamageClaim, ItemStatus, SuggestedAction


def validate_damage_claim(claim: DamageClaim, max_claim_ratio: float = 0.5, deposit_amount: float = 0) -> Tuple[ItemStatus, SuggestedAction, str]:
    reasons = []
    status = ItemStatus.NORMAL
    action = SuggestedAction.APPROVE
    
    if not claim.has_photo:
        status = ItemStatus.FAILED
        action = SuggestedAction.REQUEST_EVIDENCE
        reasons.append("损坏扣款缺少照片证据")
    
    if claim.claimed_amount <= 0:
        status = ItemStatus.FAILED
        action = SuggestedAction.REJECT
        reasons.append("扣款金额必须大于0")
    
    if deposit_amount > 0 and claim.claimed_amount > deposit_amount:
        status = ItemStatus.PENDING
        action = SuggestedAction.MANUAL_REVIEW
        reasons.append(f"扣款金额({claim.claimed_amount}元)超过押金({deposit_amount}元)，需人工确认")
    
    if claim.claimed_amount > 1000:
        status = ItemStatus.PENDING
        action = SuggestedAction.MANUAL_REVIEW
        reasons.append("大额扣款(>1000元)需人工复核")
    
    if not reasons:
        reasons.append("损坏证据齐全，金额合理")
    
    evidence_status = "已提供照片" if claim.has_photo else "缺少照片"
    
    return status, action, "; ".join(reasons)
