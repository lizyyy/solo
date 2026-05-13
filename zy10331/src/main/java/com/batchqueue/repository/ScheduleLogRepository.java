package com.batchqueue.repository;

import com.batchqueue.model.entity.ScheduleLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScheduleLogRepository extends JpaRepository<ScheduleLog, Long> {
    List<ScheduleLog> findByTaskIdOrderByCreatedAtDesc(Long taskId);
    List<ScheduleLog> findAllByOrderByCreatedAtDesc();
}
