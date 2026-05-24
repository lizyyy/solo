package com.port.reefer.repository;

import com.port.reefer.entity.PluginReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PluginReportRepository extends JpaRepository<PluginReport, Long> {
    Optional<PluginReport> findByReportNumber(String reportNumber);

    List<PluginReport> findByContainerIdOrderByPluginTimeDesc(Long containerId);

    List<PluginReport> findByPluginTimeBetweenOrderByPluginTimeDesc(
            LocalDateTime start, LocalDateTime end);

    List<PluginReport> findBySocketIdOrderByPluginTimeDesc(Long socketId);
}
