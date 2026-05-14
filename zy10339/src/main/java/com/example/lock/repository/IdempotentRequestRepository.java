package com.example.lock.repository;

import com.example.lock.entity.IdempotentRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface IdempotentRequestRepository extends JpaRepository<IdempotentRequest, Long> {

    Optional<IdempotentRequest> findByRequestId(String requestId);

    boolean existsByRequestId(String requestId);

    void deleteByCreatedAtBefore(LocalDateTime dateTime);
}
