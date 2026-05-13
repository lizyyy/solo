package com.object.lifecycle.repository;

import com.object.lifecycle.entity.ArchiveTask;
import com.object.lifecycle.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ArchiveTaskRepository extends JpaRepository<ArchiveTask, Long> {

    Optional<ArchiveTask> findByTaskId(String taskId);

    List<ArchiveTask> findByStatus(TaskStatus status);

    List<ArchiveTask> findByRuleId(Long ruleId);

    List<ArchiveTask> findByStatusAndScheduledTimeBefore(TaskStatus status, LocalDateTime time);

    boolean existsByRuleIdAndObjectKeyAndBucketName(Long ruleId, String objectKey, String bucketName);
}
