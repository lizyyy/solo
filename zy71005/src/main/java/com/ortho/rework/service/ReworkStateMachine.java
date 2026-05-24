package com.ortho.rework.service;

import com.ortho.rework.enums.ReworkStatus;
import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Component
public class ReworkStateMachine {

    private final Map<ReworkStatus, Set<ReworkStatus>> validTransitions = new HashMap<>();

    public ReworkStateMachine() {
        validTransitions.put(ReworkStatus.PENDING_REVIEW, Set.of(
            ReworkStatus.TECHNICIAN_REVIEW
        ));
        validTransitions.put(ReworkStatus.TECHNICIAN_REVIEW, Set.of(
            ReworkStatus.DOCTOR_CONFIRM,
            ReworkStatus.PENDING_REVIEW
        ));
        validTransitions.put(ReworkStatus.DOCTOR_CONFIRM, Set.of(
            ReworkStatus.READY_TO_SHIP,
            ReworkStatus.TECHNICIAN_REVIEW
        ));
        validTransitions.put(ReworkStatus.READY_TO_SHIP, Set.of(
            ReworkStatus.SHIPPED
        ));
        validTransitions.put(ReworkStatus.SHIPPED, Set.of(
            ReworkStatus.RECEIVED,
            ReworkStatus.LOST
        ));
        validTransitions.put(ReworkStatus.RECEIVED, Set.of(
            ReworkStatus.INSPECTION
        ));
        validTransitions.put(ReworkStatus.INSPECTION, Set.of(
            ReworkStatus.CLOSED
        ));
        validTransitions.put(ReworkStatus.CLOSED, Set.of());
        validTransitions.put(ReworkStatus.LOST, Set.of());
    }

    public boolean canTransition(ReworkStatus from, ReworkStatus to) {
        Set<ReworkStatus> allowedTransitions = validTransitions.get(from);
        return allowedTransitions != null && allowedTransitions.contains(to);
    }

    public Set<ReworkStatus> getValidNextStatuses(ReworkStatus current) {
        return validTransitions.getOrDefault(current, Set.of());
    }
}
