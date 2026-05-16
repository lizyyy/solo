package com.statuspage.repository;

import com.statuspage.model.ExceptionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExceptionLogRepository extends JpaRepository<ExceptionLog, Long> {
    List<ExceptionLog> findByIncidentNumberOrderByCreatedAtDesc(String incidentNumber);
    List<ExceptionLog> findByResolvedFalseOrderByCreatedAtDesc();
    List<ExceptionLog> findAllByOrderByCreatedAtDesc();
}