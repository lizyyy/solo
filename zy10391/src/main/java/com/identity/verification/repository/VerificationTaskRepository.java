package com.identity.verification.repository;

import com.identity.verification.model.VerificationTask;
import com.identity.verification.model.enums.VerificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VerificationTaskRepository extends JpaRepository<VerificationTask, Long> {

    Optional<VerificationTask> findByRequestId(String requestId);

    boolean existsByRequestId(String requestId);

    List<VerificationTask> findByStatus(VerificationStatus status);

    List<VerificationTask> findByCreatedBy(String createdBy);
}
