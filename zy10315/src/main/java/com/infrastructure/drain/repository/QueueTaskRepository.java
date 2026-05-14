package com.infrastructure.drain.repository;

import com.infrastructure.drain.model.QueueTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QueueTaskRepository extends JpaRepository<QueueTask, Long> {
    
    List<QueueTask> findByInstanceId(String instanceId);
    
    List<QueueTask> findByInstanceIdAndStatus(String instanceId, String status);
}
