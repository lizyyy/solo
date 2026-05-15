package com.virusscan.repository;

import com.virusscan.entity.ScanTask;
import com.virusscan.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ScanTaskRepository extends JpaRepository<ScanTask, Long> {
    Optional<ScanTask> findByTaskId(String taskId);
    Optional<ScanTask> findByRequestId(String requestId);
    List<ScanTask> findByFileId(String fileId);
    List<ScanTask> findByStatus(TaskStatus status);
    List<ScanTask> findByStatusIn(List<TaskStatus> statuses);
    List<ScanTask> findByCreateTimeBetween(LocalDateTime start, LocalDateTime end);
    List<ScanTask> findByFileIdAndStatusIn(String fileId, List<TaskStatus> statuses);
    boolean existsByTaskId(String taskId);
    boolean existsByRequestId(String requestId);
    boolean existsByFileIdAndStatusIn(String fileId, List<TaskStatus> statuses);
}