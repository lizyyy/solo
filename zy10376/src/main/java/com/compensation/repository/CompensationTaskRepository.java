package com.compensation.repository;

import com.compensation.entity.CompensationTask;
import com.compensation.enums.CompensationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CompensationTaskRepository extends JpaRepository<CompensationTask, Long> {
    
    Optional<CompensationTask> findByTaskId(String taskId);
    
    boolean existsByTaskId(String taskId);
    
    List<CompensationTask> findByUndoRequestIdOrderByTaskOrderAsc(Long requestId);
    
    List<CompensationTask> findByUndoRequestRequestIdOrderByTaskOrderAsc(String requestId);
    
    List<CompensationTask> findByUndoRequestIdAndStatus(Long requestId, CompensationStatus status);
    
    List<CompensationTask> findByStatus(CompensationStatus status);
    
    @Query("SELECT t FROM CompensationTask t WHERE t.status = :status AND t.nextRetryTime <= :now")
    List<CompensationTask> findRetryableTasks(
            @Param("status") CompensationStatus status,
            @Param("now") LocalDateTime now
    );
}
