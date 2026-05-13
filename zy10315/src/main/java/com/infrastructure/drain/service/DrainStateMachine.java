package com.infrastructure.drain.service;

import com.infrastructure.drain.exception.DrainException;
import com.infrastructure.drain.model.DrainStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class DrainStateMachine {
    
    private final Map<DrainStatus, Set<DrainStatus>> allowedTransitions;
    
    public DrainStateMachine() {
        allowedTransitions = new EnumMap<>(DrainStatus.class);
        
        addTransition(DrainStatus.INIT, DrainStatus.VALIDATING, DrainStatus.CANCELLED);
        addTransition(DrainStatus.VALIDATING, DrainStatus.VALIDATED, DrainStatus.FAILED, DrainStatus.CANCELLED);
        addTransition(DrainStatus.VALIDATED, DrainStatus.TRAFFIC_OFFLOADING, DrainStatus.CANCELLED);
        addTransition(DrainStatus.TRAFFIC_OFFLOADING, DrainStatus.TRAFFIC_OFFLOADED, DrainStatus.FAILED, DrainStatus.CANCELLED);
        addTransition(DrainStatus.TRAFFIC_OFFLOADED, DrainStatus.CONNECTION_OBSERVING, DrainStatus.CANCELLED);
        addTransition(DrainStatus.CONNECTION_OBSERVING, DrainStatus.CONNECTIONS_EMPTY, DrainStatus.FAILED, DrainStatus.CANCELLED);
        addTransition(DrainStatus.CONNECTIONS_EMPTY, DrainStatus.TASK_MIGRATING, DrainStatus.CANCELLED);
        addTransition(DrainStatus.TASK_MIGRATING, DrainStatus.TASKS_MIGRATED, DrainStatus.FAILED, DrainStatus.CANCELLED);
        addTransition(DrainStatus.TASKS_MIGRATED, DrainStatus.DRAINING, DrainStatus.CANCELLED);
        addTransition(DrainStatus.DRAINING, DrainStatus.DRAINED, DrainStatus.FAILED, DrainStatus.CANCELLED);
        addTransition(DrainStatus.DRAINED, DrainStatus.COMPLETED);
        
        addTransition(DrainStatus.FAILED, DrainStatus.RECOVERING, DrainStatus.CANCELLED);
        addTransition(DrainStatus.RECOVERING, DrainStatus.RECOVERED, DrainStatus.FAILED);
        addTransition(DrainStatus.RECOVERED, DrainStatus.VALIDATING);
    }
    
    private void addTransition(DrainStatus from, DrainStatus... toStatuses) {
        Set<DrainStatus> toSet = EnumSet.noneOf(DrainStatus.class);
        Collections.addAll(toSet, toStatuses);
        allowedTransitions.put(from, toSet);
    }
    
    public boolean canTransition(DrainStatus current, DrainStatus target) {
        Set<DrainStatus> allowed = allowedTransitions.get(current);
        return allowed != null && allowed.contains(target);
    }
    
    public void validateTransition(String batchId, DrainStatus current, DrainStatus target) {
        if (!canTransition(current, target)) {
            throw DrainException.invalidStatusTransition(batchId, current, target);
        }
        log.debug("批次[{}]状态跳转验证通过: {} -> {}", batchId, current, target);
    }
    
    public boolean isFinalStatus(DrainStatus status) {
        return status == DrainStatus.COMPLETED || 
               status == DrainStatus.CANCELLED || 
               status == DrainStatus.RECOVERED;
    }
    
    public List<DrainStatus> getNextStatuses(DrainStatus current) {
        Set<DrainStatus> next = allowedTransitions.get(current);
        return next != null ? new ArrayList<>(next) : Collections.emptyList();
    }
}
