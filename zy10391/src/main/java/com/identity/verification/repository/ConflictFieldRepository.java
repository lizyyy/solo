package com.identity.verification.repository;

import com.identity.verification.model.ConflictField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConflictFieldRepository extends JpaRepository<ConflictField, Long> {

    List<ConflictField> findByTaskId(Long taskId);

    List<ConflictField> findByTaskIdAndResolved(Long taskId, Boolean resolved);
}
