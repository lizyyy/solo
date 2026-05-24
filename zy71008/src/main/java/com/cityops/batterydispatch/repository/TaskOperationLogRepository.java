package com.cityops.batterydispatch.repository;

import com.cityops.batterydispatch.entity.TaskOperationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskOperationLogRepository extends JpaRepository<TaskOperationLog, Long> {
    List<TaskOperationLog> findByTaskNoOrderByOperationTimeAsc(String taskNo);

    List<TaskOperationLog> findByTaskNoOrderByCreatedAtDesc(String taskNo);
}
