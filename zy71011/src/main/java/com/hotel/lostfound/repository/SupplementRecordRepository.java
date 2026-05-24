package com.hotel.lostfound.repository;

import com.hotel.lostfound.entity.SupplementRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplementRecordRepository extends JpaRepository<SupplementRecord, Long> {

    Optional<SupplementRecord> findByRequestId(String requestId);

    List<SupplementRecord> findByLostItemIdOrderByCreatedAtDesc(Long lostItemId);
}
