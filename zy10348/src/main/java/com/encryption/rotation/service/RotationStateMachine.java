package com.encryption.rotation.service;

import com.encryption.rotation.exception.RotationException;
import com.encryption.rotation.model.enums.RotationStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
public class RotationStateMachine {

    private static final Set<RotationStatus> TERMINAL_STATUSES = Set.of(
        RotationStatus.COMPLETED,
        RotationStatus.CANCELLED,
        RotationStatus.FAILED
    );

    public void validateTransition(RotationStatus currentStatus, RotationStatus targetStatus) {
        if (isTerminalStatus(currentStatus)) {
            throw new RotationException("INVALID_STATE_TRANSITION", 
                "当前状态[" + currentStatus + "]为终态，不允许状态变更");
        }

        boolean isValid = switch (currentStatus) {
            case PENDING -> targetStatus == RotationStatus.VALIDATING || 
                           targetStatus == RotationStatus.CANCELLED;
            case VALIDATING -> targetStatus == RotationStatus.IN_PROGRESS || 
                              targetStatus == RotationStatus.FAILED ||
                              targetStatus == RotationStatus.CANCELLED;
            case IN_PROGRESS -> targetStatus == RotationStatus.PARTIAL_SUCCESS || 
                               targetStatus == RotationStatus.VERIFYING ||
                               targetStatus == RotationStatus.FAILED ||
                               targetStatus == RotationStatus.CANCELLED;
            case PARTIAL_SUCCESS -> targetStatus == RotationStatus.VERIFYING || 
                                   targetStatus == RotationStatus.FAILED ||
                                   targetStatus == RotationStatus.CANCELLED;
            case VERIFYING -> targetStatus == RotationStatus.COMPLETED || 
                             targetStatus == RotationStatus.FAILED ||
                             targetStatus == RotationStatus.CANCELLED;
            default -> false;
        };

        if (!isValid) {
            throw new RotationException("INVALID_STATE_TRANSITION", 
                "不允许从状态[" + currentStatus + "]转换到[" + targetStatus + "]");
        }

        log.debug("状态转换验证通过: {} -> {}", currentStatus, targetStatus);
    }

    public boolean isTerminalStatus(RotationStatus status) {
        return TERMINAL_STATUSES.contains(status);
    }

    public boolean canCancel(RotationStatus status) {
        return !isTerminalStatus(status);
    }

    public boolean canRetry(RotationStatus status) {
        return status == RotationStatus.FAILED || status == RotationStatus.PARTIAL_SUCCESS;
    }
}
