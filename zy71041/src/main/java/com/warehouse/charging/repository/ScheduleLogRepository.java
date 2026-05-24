package com.warehouse.charging.repository;

import com.warehouse.charging.model.ScheduleLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ScheduleLogRepository extends JpaRepository<ScheduleLog, Long> {
    List<ScheduleLog> findByRequestIdOrderByCreatedAtDesc(String requestId);
    List<ScheduleLog> findByReservationIdOrderByCreatedAtDesc(Long reservationId);
    List<ScheduleLog> findByRobotCodeOrderByCreatedAtDesc(String robotCode);
}
