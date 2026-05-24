package com.cityops.batterydispatch.service;

import com.cityops.batterydispatch.enums.DispatchStatus;
import com.cityops.batterydispatch.enums.ErrorCode;
import com.cityops.batterydispatch.exception.BusinessException;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Component
public class DispatchStateMachine {
    private final Map<DispatchStatus, Set<DispatchStatus>> validTransitions = new HashMap<>();

    public DispatchStateMachine() {
        validTransitions.put(DispatchStatus.PENDING, EnumSet.of(
            DispatchStatus.DISPATCHED,
            DispatchStatus.FORBIDDEN_LOCATION,
            DispatchStatus.LOW_BATTERY_SKIP,
            DispatchStatus.CONFIRM_REQUIRED,
            DispatchStatus.CANCELLED
        ));

        validTransitions.put(DispatchStatus.DISPATCHED, EnumSet.of(
            DispatchStatus.ARRIVED,
            DispatchStatus.CANCELLED,
            DispatchStatus.CONFIRM_REQUIRED
        ));

        validTransitions.put(DispatchStatus.ARRIVED, EnumSet.of(
            DispatchStatus.PHOTO_MISSING,
            DispatchStatus.COMPLETED,
            DispatchStatus.CONFIRM_REQUIRED,
            DispatchStatus.CANCELLED
        ));

        validTransitions.put(DispatchStatus.FORBIDDEN_LOCATION, EnumSet.of(
            DispatchStatus.CONFIRM_REQUIRED,
            DispatchStatus.CANCELLED,
            DispatchStatus.DISPATCHED
        ));

        validTransitions.put(DispatchStatus.LOW_BATTERY_SKIP, EnumSet.of(
            DispatchStatus.CONFIRM_REQUIRED,
            DispatchStatus.CANCELLED,
            DispatchStatus.DISPATCHED
        ));

        validTransitions.put(DispatchStatus.PHOTO_MISSING, EnumSet.of(
            DispatchStatus.COMPLETED,
            DispatchStatus.CONFIRM_REQUIRED,
            DispatchStatus.CANCELLED
        ));

        validTransitions.put(DispatchStatus.CONFIRM_REQUIRED, EnumSet.of(
            DispatchStatus.DISPATCHED,
            DispatchStatus.COMPLETED,
            DispatchStatus.CANCELLED,
            DispatchStatus.PENDING
        ));

        validTransitions.put(DispatchStatus.COMPLETED, EnumSet.noneOf(DispatchStatus.class));
        validTransitions.put(DispatchStatus.CANCELLED, EnumSet.noneOf(DispatchStatus.class));
    }

    public boolean canTransition(DispatchStatus from, DispatchStatus to) {
        Set<DispatchStatus> allowed = validTransitions.get(from);
        return allowed != null && allowed.contains(to);
    }

    public void validateTransition(DispatchStatus from, DispatchStatus to) {
        if (!canTransition(from, to)) {
            throw new BusinessException(ErrorCode.INVALID_STATUS,
                String.format("无法从状态 %s 转换到 %s", from.getDescription(), to.getDescription()));
        }
    }

    public boolean isFinalStatus(DispatchStatus status) {
        return status == DispatchStatus.COMPLETED || status == DispatchStatus.CANCELLED;
    }

    public boolean canBeModified(DispatchStatus status) {
        return !isFinalStatus(status);
    }
}
