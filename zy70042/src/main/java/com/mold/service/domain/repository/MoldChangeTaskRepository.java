package com.mold.service.domain.repository;

import com.mold.service.domain.entity.MoldChangeTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MoldChangeTaskRepository extends JpaRepository<MoldChangeTask, Long> {
    
    Optional<MoldChangeTask> findByTaskNo(String taskNo);
    
    List<MoldChangeTask> findByMoldIdOrderByCreatedAtDesc(Long moldId);
    
    List<MoldChangeTask> findByStatusIn(List<MoldChangeTask.TaskStatus> statuses);
    
    List<MoldChangeTask> findByProductionLineAndStatusIn(String productionLine, List<MoldChangeTask.TaskStatus> statuses);
    
    @Query("SELECT t FROM MoldChangeTask t WHERE t.moldId = :moldId AND t.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')")
    List<MoldChangeTask> findActiveTasksByMoldId(Long moldId);
    
    @Query("SELECT COUNT(t) FROM MoldChangeTask t WHERE t.status = 'PENDING'")
    Long countPendingTasks();
    
    @Query("SELECT t FROM MoldChangeTask t WHERE t.taskType = 'LIFE_EXPIRED' AND t.status = 'PENDING'")
    List<MoldChangeTask> findExpiredMoldTasks();
}
