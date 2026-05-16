package com.connector.ratelimit.repository;

import com.connector.ratelimit.model.entity.ExceptionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExceptionRecordRepository extends JpaRepository<ExceptionRecord, Long> {
    List<ExceptionRecord> findByConnectorCode(String connectorCode);
    List<ExceptionRecord> findByIsResolvedFalse();
}
