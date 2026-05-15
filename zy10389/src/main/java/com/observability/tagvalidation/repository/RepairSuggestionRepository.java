package com.observability.tagvalidation.repository;

import com.observability.tagvalidation.entity.RepairSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RepairSuggestionRepository extends JpaRepository<RepairSuggestion, Long> {
    List<RepairSuggestion> findByViolationId(Long violationId);
    List<RepairSuggestion> findByApplied(Boolean applied);
}
