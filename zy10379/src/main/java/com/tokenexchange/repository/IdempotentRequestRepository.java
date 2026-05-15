package com.tokenexchange.repository;

import com.tokenexchange.entity.IdempotentRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface IdempotentRequestRepository extends JpaRepository<IdempotentRequest, Long> {
    Optional<IdempotentRequest> findByRequestId(String requestId);
    Optional<IdempotentRequest> findByRequestIdAndOperationType(String requestId, String operationType);
    void deleteByExpiresAtBefore(LocalDateTime dateTime);
}
