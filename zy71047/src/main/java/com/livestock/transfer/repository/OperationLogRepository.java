package com.livestock.transfer.repository;

import com.livestock.transfer.entity.OperationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OperationLogRepository extends JpaRepository<OperationLog, Long> {
    List<OperationLog> findByTransferIdOrderByCreatedAtDesc(Long transferId);
}
