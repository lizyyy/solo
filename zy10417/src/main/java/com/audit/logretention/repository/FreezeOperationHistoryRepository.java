package com.audit.logretention.repository;

import com.audit.logretention.entity.FreezeOperationHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FreezeOperationHistoryRepository extends JpaRepository<FreezeOperationHistory, Long> {

    List<FreezeOperationHistory> findByFreezeIdOrderByOperatedAtDesc(Long freezeId);

    List<FreezeOperationHistory> findByRequestIdOrderByOperatedAtDesc(String requestId);
}