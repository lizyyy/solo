package com.compensation.repository;

import com.compensation.entity.FailureReason;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FailureReasonRepository extends JpaRepository<FailureReason, Long> {
    
    Optional<FailureReason> findByFailureId(String failureId);
    
    boolean existsByFailureId(String failureId);
    
    Optional<FailureReason> findByExecutedActionId(Long actionId);
    
    Optional<FailureReason> findByCompensationTaskId(Long taskId);
    
    List<FailureReason> findByErrorCode(String errorCode);
}
