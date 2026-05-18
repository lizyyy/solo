package com.riskcontrol.graylist.repository;

import com.riskcontrol.graylist.entity.ImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ImportBatchRepository extends JpaRepository<ImportBatch, Long> {

    Optional<ImportBatch> findByBatchNo(String batchNo);

    boolean existsByBatchNo(String batchNo);
}
