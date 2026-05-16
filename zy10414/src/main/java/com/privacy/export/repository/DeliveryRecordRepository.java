package com.privacy.export.repository;

import com.privacy.export.entity.DeliveryRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DeliveryRecordRepository extends JpaRepository<DeliveryRecord, Long> {

    Optional<DeliveryRecord> findByExportRequestId(Long exportRequestId);

    Optional<DeliveryRecord> findByDeliveryId(String deliveryId);

    boolean existsByExportRequestId(Long exportRequestId);
}
