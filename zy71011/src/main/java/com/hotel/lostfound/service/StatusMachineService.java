package com.hotel.lostfound.service;

import com.hotel.lostfound.entity.LostItem;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import com.hotel.lostfound.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class StatusMachineService {

    private static final Logger log = LoggerFactory.getLogger(StatusMachineService.class);

    public boolean canTransition(LostItemStatus from, LostItemStatus to) {
        if (to == LostItemStatus.EXPIRED) {
            return !isTerminated(from);
        }
        
        return switch (from) {
            case REGISTERED -> Set.of(
                    LostItemStatus.PENDING_VERIFICATION,
                    LostItemStatus.VERIFIED,
                    LostItemStatus.PENDING_DISPOSAL,
                    LostItemStatus.DISPOSED
            ).contains(to);
            case PENDING_VERIFICATION -> Set.of(
                    LostItemStatus.VERIFIED,
                    LostItemStatus.REGISTERED
            ).contains(to);
            case VERIFIED -> Set.of(
                    LostItemStatus.PENDING_CLAIM,
                    LostItemStatus.CLAIMED,
                    LostItemStatus.MAILED,
                    LostItemStatus.PENDING_DISPOSAL,
                    LostItemStatus.DISPOSED
            ).contains(to);
            case PENDING_CLAIM -> Set.of(
                    LostItemStatus.CLAIMED,
                    LostItemStatus.MAILED,
                    LostItemStatus.VERIFIED
            ).contains(to);
            case CLAIMED, MAILED, DISPOSED, EXPIRED -> false;
            case PENDING_DISPOSAL -> Set.of(
                    LostItemStatus.DISPOSED,
                    LostItemStatus.VERIFIED
            ).contains(to);
        };
    }

    public void transition(LostItem item, LostItemStatus targetStatus, String operator, String remark) {
        LostItemStatus currentStatus = item.getStatus();
        
        if (!canTransition(currentStatus, targetStatus)) {
            throw new BusinessException(
                    String.format("无法从状态 %s 转换到 %s", currentStatus, targetStatus)
            );
        }
        
        item.addStatusHistory(currentStatus, targetStatus, operator, remark);
        item.setStatus(targetStatus);
        
        log.info("物品 {} 状态变更: {} -> {}, 操作人: {}, 备注: {}",
                item.getItemNo(), currentStatus, targetStatus, operator, remark);
    }

    public boolean isTerminated(LostItemStatus status) {
        return Set.of(
                LostItemStatus.CLAIMED,
                LostItemStatus.MAILED,
                LostItemStatus.DISPOSED,
                LostItemStatus.EXPIRED
        ).contains(status);
    }

    public boolean canClaim(LostItemStatus status) {
        return Set.of(
                LostItemStatus.VERIFIED,
                LostItemStatus.PENDING_CLAIM
        ).contains(status);
    }

    public boolean canVerify(LostItemStatus status) {
        return status == LostItemStatus.REGISTERED || status == LostItemStatus.PENDING_VERIFICATION;
    }

    public boolean canDispose(LostItemStatus status) {
        return Set.of(
                LostItemStatus.REGISTERED,
                LostItemStatus.VERIFIED,
                LostItemStatus.PENDING_DISPOSAL
        ).contains(status);
    }
}
