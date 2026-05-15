package com.compensation.repository;

import com.compensation.entity.ExecutedAction;
import com.compensation.enums.ActionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExecutedActionRepository extends JpaRepository<ExecutedAction, Long> {
    
    Optional<ExecutedAction> findByActionId(String actionId);
    
    boolean existsByActionId(String actionId);
    
    List<ExecutedAction> findByUndoRequestIdOrderByActionOrderAsc(Long requestId);
    
    List<ExecutedAction> findByUndoRequestRequestIdOrderByActionOrderAsc(String requestId);
    
    List<ExecutedAction> findByUndoRequestIdAndStatus(Long requestId, ActionStatus status);
    
    List<ExecutedAction> findByStatus(ActionStatus status);
}
