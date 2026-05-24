package com.hotel.lostfound.repository;

import com.hotel.lostfound.entity.MailRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MailRecordRepository extends JpaRepository<MailRecord, Long> {

    Optional<MailRecord> findByRequestId(String requestId);

    Optional<MailRecord> findByTrackingNumber(String trackingNumber);

    List<MailRecord> findByLostItemIdOrderByCreatedAtDesc(Long lostItemId);

    List<MailRecord> findBySignedReceivedFalse();
}
