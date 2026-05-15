package com.sensitive.operation.repository;

import com.sensitive.operation.enums.OperationStatus;
import com.sensitive.operation.model.SensitiveOperation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SensitiveOperationRepository extends JpaRepository<SensitiveOperation, String> {

    List<SensitiveOperation> findByStatus(OperationStatus status);

    List<SensitiveOperation> findByRequesterId(String requesterId);

    List<SensitiveOperation> findByExpireTimeBeforeAndStatusIn(LocalDateTime time, List<OperationStatus> statuses);

    boolean existsById(String id);
}
