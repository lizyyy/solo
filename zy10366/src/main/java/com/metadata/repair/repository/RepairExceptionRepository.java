package com.metadata.repair.repository;

import com.metadata.repair.entity.RepairException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RepairExceptionRepository extends JpaRepository<RepairException, Long> {
    List<RepairException> findByBatchNo(String batchNo);
    List<RepairException> findByBatchNoAndResolvedFalse(String batchNo);
    List<RepairException> findByFileId(String fileId);
}
