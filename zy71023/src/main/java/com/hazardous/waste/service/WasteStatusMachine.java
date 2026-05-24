package com.hazardous.waste.service;

import com.hazardous.waste.entity.WasteRecord;
import com.hazardous.waste.enums.ErrorCode;
import com.hazardous.waste.enums.WasteStatus;
import com.hazardous.waste.exception.BusinessException;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class WasteStatusMachine {

    public boolean canTransition(WasteStatus current, WasteStatus target) {
        return switch (current) {
            case PENDING_SUBMIT -> Set.of(WasteStatus.PENDING_REVIEW, WasteStatus.RETURNED).contains(target);
            case PENDING_REVIEW -> Set.of(WasteStatus.REVIEW_PASSED, WasteStatus.RETURNED, WasteStatus.REJECTED).contains(target);
            case REVIEW_PASSED -> Set.of(WasteStatus.STORING, WasteStatus.RETURNED).contains(target);
            case STORING -> Set.of(WasteStatus.OVERDUE, WasteStatus.PENDING_TRANSFER, WasteStatus.RETURNED).contains(target);
            case OVERDUE -> Set.of(WasteStatus.PENDING_TRANSFER, WasteStatus.RETURNED).contains(target);
            case PENDING_TRANSFER -> Set.of(WasteStatus.TRANSFERRED, WasteStatus.STORING).contains(target);
            case TRANSFERRED -> Set.of(WasteStatus.DISPOSED).contains(target);
            case RETURNED -> Set.of(WasteStatus.PENDING_REVIEW).contains(target);
            default -> false;
        };
    }

    public void transition(WasteRecord record, WasteStatus targetStatus, String operator, String remark) {
        WasteStatus current = record.getStatus();
        if (!canTransition(current, targetStatus)) {
            throw new BusinessException(ErrorCode.INVALID_STATUS,
                    String.format("无法从 %s 状态转换到 %s 状态", current, targetStatus));
        }
        record.setStatus(targetStatus);
        record.getOperationLogs().add(new WasteRecord.OperationLog(
                String.format("状态变更: %s -> %s", current, targetStatus),
                operator,
                remark
        ));
    }

    public boolean canSubmit(WasteStatus status) {
        return status == WasteStatus.PENDING_SUBMIT || status == WasteStatus.RETURNED;
    }

    public boolean canReview(WasteStatus status) {
        return status == WasteStatus.PENDING_REVIEW;
    }

    public boolean canStore(WasteStatus status) {
        return status == WasteStatus.REVIEW_PASSED;
    }

    public boolean canTransfer(WasteStatus status) {
        return status == WasteStatus.STORING || status == WasteStatus.OVERDUE;
    }

    public boolean canDispose(WasteStatus status) {
        return status == WasteStatus.TRANSFERRED;
    }
}
