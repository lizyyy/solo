package com.connector.ratelimit.repository;

import com.connector.ratelimit.model.entity.RunSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RunSummaryRepository extends JpaRepository<RunSummary, Long> {
    List<RunSummary> findByConnectorCode(String connectorCode);
    Optional<RunSummary> findByConnectorCodeAndSummaryDate(String connectorCode, String summaryDate);
    List<RunSummary> findBySummaryDateBetween(String startDate, String endDate);
}
