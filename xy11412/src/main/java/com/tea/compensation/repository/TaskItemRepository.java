package com.tea.compensation.repository;

import com.tea.compensation.entity.TaskItem;
import com.tea.compensation.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskItemRepository extends JpaRepository<TaskItem, Long> {

    List<TaskItem> findByTaskId(Long taskId);

    List<TaskItem> findByBatchNo(String batchNo);

    List<TaskItem> findByTaskIdAndStatus(Long taskId, TaskStatus status);

    List<TaskItem> findByBatchNoAndStatus(String batchNo, TaskStatus status);

    @Query("SELECT COUNT(i) FROM TaskItem i WHERE i.taskId = :taskId AND i.status = :status")
    long countByTaskIdAndStatus(@Param("taskId") Long taskId, @Param("status") TaskStatus status);

    @Modifying
    @Query("UPDATE TaskItem i SET i.status = :status, i.failReason = :failReason WHERE i.id = :id")
    int updateStatus(@Param("id") Long id, @Param("status") TaskStatus status, @Param("failReason") String failReason);

    @Modifying
    @Query("UPDATE TaskItem i SET i.status = :status WHERE i.taskId = :taskId")
    int updateStatusByTaskId(@Param("taskId") Long taskId, @Param("status") TaskStatus status);

    void deleteByTaskId(Long taskId);
}
