package com.hotel.lostfound.repository;

import com.hotel.lostfound.entity.DisposalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DisposalRecordRepository extends JpaRepository<DisposalRecord, Long> {

    Optional<DisposalRecord> findByRequestId(String requestId);

    Optional<DisposalRecord> findByLostItemId(Long lostItemId);

    boolean existsByLostItemId(Long lostItemId);
}
