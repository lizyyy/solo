package com.hotel.lostfound.repository;

import com.hotel.lostfound.entity.IdempotentRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IdempotentRecordRepository extends JpaRepository<IdempotentRecord, Long> {

    Optional<IdempotentRecord> findByRequestId(String requestId);

    boolean existsByRequestId(String requestId);
}
