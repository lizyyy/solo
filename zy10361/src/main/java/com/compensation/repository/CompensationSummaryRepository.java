package com.compensation.repository;

import com.compensation.entity.CompensationSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CompensationSummaryRepository extends JpaRepository<CompensationSummary, Long> {

    Optional<CompensationSummary> findByProcessId(String processId);

    boolean existsByProcessId(String processId);
}
