package com.connector.ratelimit.repository;

import com.connector.ratelimit.model.entity.RecoveryEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RecoveryEventRepository extends JpaRepository<RecoveryEvent, Long> {
    List<RecoveryEvent> findByConnectorCode(String connectorCode);
    Optional<RecoveryEvent> findByEventId(String eventId);
    Optional<RecoveryEvent> findByIdempotentKey(String idempotentKey);
}
