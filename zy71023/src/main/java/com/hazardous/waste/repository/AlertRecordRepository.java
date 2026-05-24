package com.hazardous.waste.repository;

import com.hazardous.waste.entity.AlertRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertRecordRepository extends JpaRepository<AlertRecord, Long> {

    List<AlertRecord> findByIsHandled(Boolean isHandled);

    List<AlertRecord> findByAlertType(String alertType);

    List<AlertRecord> findByRelatedRecordNo(String relatedRecordNo);

    List<AlertRecord> findByIsRead(Boolean isRead);

    long countByIsHandled(Boolean isHandled);
}
