package com.identity.verification.repository;

import com.identity.verification.model.ConfirmationRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConfirmationRecordRepository extends JpaRepository<ConfirmationRecord, Long> {

    List<ConfirmationRecord> findByTaskId(Long taskId);
}
