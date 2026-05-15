package com.resource.tag.repository;

import com.resource.tag.model.InheritanceTask;
import com.resource.tag.model.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InheritanceTaskRepository extends JpaRepository<InheritanceTask, Long> {
    Optional<InheritanceTask> findByTaskId(String taskId);
    Optional<InheritanceTask> findByRequestId(String requestId);
    List<InheritanceTask> findByStatusIn(List<TaskStatus> statuses);
    List<InheritanceTask> findByTargetNodeId(String targetNodeId);
    boolean existsByRequestId(String requestId);
}
