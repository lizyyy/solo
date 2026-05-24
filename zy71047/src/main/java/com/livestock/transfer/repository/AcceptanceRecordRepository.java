package com.livestock.transfer.repository;

import com.livestock.transfer.entity.AcceptanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AcceptanceRecordRepository extends JpaRepository<AcceptanceRecord, Long> {
    Optional<AcceptanceRecord> findByAcceptanceNo(String acceptanceNo);
    List<AcceptanceRecord> findByTransferId(Long transferId);
}
