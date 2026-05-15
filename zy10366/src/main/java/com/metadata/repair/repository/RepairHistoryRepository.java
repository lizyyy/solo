package com.metadata.repair.repository;

import com.metadata.repair.entity.RepairHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RepairHistoryRepository extends JpaRepository<RepairHistory, Long> {
    List<RepairHistory> findByBatchNoOrderByCreatedAtDesc(String batchNo);
    List<RepairHistory> findByOperator(String operator);
}
