package com.api.inspection.repository;

import com.api.inspection.entity.TransactionTemplate;
import com.api.inspection.enums.TransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionTemplateRepository extends JpaRepository<TransactionTemplate, Long> {
    Optional<TransactionTemplate> findByTemplateCode(String templateCode);
    boolean existsByTemplateCode(String templateCode);
    List<TransactionTemplate> findByStatus(TransactionStatus status);
    List<TransactionTemplate> findByCreatedBy(String createdBy);
}
