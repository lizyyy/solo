package com.livestock.transfer.repository;

import com.livestock.transfer.entity.TransferReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransferReportRepository extends JpaRepository<TransferReport, Long> {
    Optional<TransferReport> findByReportNo(String reportNo);
    List<TransferReport> findByTransferId(Long transferId);
}
