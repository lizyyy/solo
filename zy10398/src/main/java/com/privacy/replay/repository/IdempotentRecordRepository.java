package com.privacy.replay.repository;

import com.privacy.replay.model.IdempotentRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface IdempotentRecordRepository extends JpaRepository<IdempotentRecord, Long> {

    Optional<IdempotentRecord> findByRequestKey(String requestKey);

    List<IdempotentRecord> findByExpiredAtBefore(LocalDateTime dateTime);

    void deleteByExpiredAtBefore(LocalDateTime dateTime);
}
