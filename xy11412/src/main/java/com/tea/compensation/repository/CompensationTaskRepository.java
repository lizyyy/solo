package com.tea.compensation.repository;

import com.tea.compensation.entity.CompensationTask;
import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.enums.TaskType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CompensationTaskRepository extends JpaRepository<CompensationTask, Long> {

    Optional<CompensationTask> findByBatchNo(String batchNo);

    boolean existsByBatchNo(String batchNo);

    Page<CompensationTask> findByStoreId(String storeId, Pageable pageable);

    Page<CompensationTask> findByStatus(TaskStatus status, Pageable pageable);

    Page<CompensationTask> findByTaskType(TaskType taskType, Pageable pageable);

    Page<CompensationTask> findByStatusIn(List<TaskStatus> statuses, Pageable pageable);

    @Query("SELECT t FROM CompensationTask t WHERE t.status = :status AND t.nextRetryTime <= :now ORDER BY t.nextRetryTime ASC")
    List<CompensationTask> findRetryableTasks(@Param("status") TaskStatus status, @Param("now") LocalDateTime now);

    @Query("SELECT t FROM CompensationTask t WHERE t.status IN ('FAILED', 'PARTIAL_FAILED', 'RETRYING') " +
           "AND t.retryCount < t.maxRetryCount AND t.nextRetryTime <= :now ORDER BY t.nextRetryTime ASC")
    List<CompensationTask> findAllRetryableTasks(@Param("now") LocalDateTime now);

    @Query("SELECT t FROM CompensationTask t WHERE t.status = 'FAILED' " +
           "AND t.retryCount >= t.maxRetryCount AND t.updatedAt <= :deadline")
    List<CompensationTask> findTasksForDeadLetter(@Param("deadline") LocalDateTime deadline);

    List<CompensationTask> findByParentBatchNo(String parentBatchNo);

    @Query("SELECT COUNT(t) FROM CompensationTask t WHERE t.status = :status")
    long countByStatus(@Param("status") TaskStatus status);

    @Query("SELECT t.status, COUNT(t) FROM CompensationTask t GROUP BY t.status")
    List<Object[]> countByStatusGroup();

    @Query("SELECT t.taskType, COUNT(t) FROM CompensationTask t GROUP BY t.taskType")
    List<Object[]> countByTaskTypeGroup();
}
