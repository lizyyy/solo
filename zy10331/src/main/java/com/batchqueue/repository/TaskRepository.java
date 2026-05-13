package com.batchqueue.repository;

import com.batchqueue.model.entity.Task;
import com.batchqueue.model.enums.TaskPriority;
import com.batchqueue.model.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    Optional<Task> findByTaskId(String taskId);
    boolean existsByTaskId(String taskId);
    List<Task> findByStatusOrderByPriorityAscCreatedAtAsc(TaskStatus status);
    List<Task> findByStatus(TaskStatus status);
    List<Task> findByStatusInOrderByPriorityAscCreatedAtAsc(List<TaskStatus> statuses);
    
    @Query("SELECT t FROM Task t WHERE t.status = 'WAITING' ORDER BY t.priority ASC, t.createdAt ASC")
    List<Task> findWaitingTasksOrderedByPriority();
    
    @Query("SELECT t FROM Task t WHERE t.status = 'RUNNING' ORDER BY t.priority DESC")
    List<Task> findRunningTasksOrderedByPriorityDesc();
    
    List<Task> findByPriority(TaskPriority priority);
    
    @Query("SELECT COUNT(t) FROM Task t WHERE t.status = 'RUNNING'")
    long countRunningTasks();
    
    @Query("SELECT AVG(t.waitDurationSeconds) FROM Task t WHERE t.status = 'COMPLETED'")
    Double calculateAverageWaitTime();
}
