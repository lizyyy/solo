package com.devicecommand.repository;

import com.devicecommand.entity.RetryRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RetryRecordRepository extends JpaRepository<RetryRecord, Long> {

    Optional<RetryRecord> findByRetryNo(String retryNo);

    List<RetryRecord> findByBatchNo(String batchNo);

    List<RetryRecord> findByDeviceCode(String deviceCode);

    boolean existsByRetryNo(String retryNo);
}
