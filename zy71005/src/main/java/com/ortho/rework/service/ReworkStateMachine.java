package com.ortho.rework.service;

import com.ortho.rework.enums.ReworkStatus;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@Component
public class ReworkStateMachine {

    private static final Map<ReworkStatus, Set<ReworkStatus>> TRANSITIONS = Map.of(
        ReworkStatus.CREATED, EnumSet.of(ReworkStatus.RECEIVED, ReworkStatus.CANCELLED),
        ReworkStatus.RECEIVED, EnumSet.of(ReworkStatus.INSPECTED, ReworkStatus.CANCELLED),
        ReworkStatus.INSPECTED, EnumSet.of(ReworkStatus.PROCESSING, ReworkStatus.CANCELLED),
        ReworkStatus.PROCESSING, EnumSet.of(ReworkStatus.DOCTOR_CONFIRMED, ReworkStatus.REVIEWED, ReworkStatus.CANCELLED),
        ReworkStatus.DOCTOR_CONFIRMED, EnumSet.of(ReworkStatus.REVIEWED, ReworkStatus.CANCELLED),
        ReworkStatus.REVIEWED, EnumSet.of(ReworkStatus.SHIPPED, ReworkStatus.PROCESSING, ReworkStatus.CANCELLED),
        ReworkStatus.SHIPPED, EnumSet.of(ReworkStatus.CLOSED, ReworkStatus.LOST),
        ReworkStatus.LOST, EnumSet.of(ReworkStatus.CLOSED, ReworkStatus.CANCELLED),
        ReworkStatus.CLOSED, EnumSet.noneOf(ReworkStatus.class),
        ReworkStatus.CANCELLED, EnumSet.noneOf(ReworkStatus.class)
    );

    public boolean canTransition(ReworkStatus from, ReworkStatus to) {
        Set<ReworkStatus> allowedTransitions = TRANSITIONS.get(from);
        return allowedTransitions != null && allowedTransitions.contains(to);
    }

    public String getTransitionError(ReworkStatus from, ReworkStatus to) {
        return String.format("状态转换不允许: %s -> %s", from.getDescription(), to.getDescription());
    }

    public boolean isTerminalStatus(ReworkStatus status) {
        return status == ReworkStatus.CLOSED || status == ReworkStatus.CANCELLED;
    }
}
