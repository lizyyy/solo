package com.privacy.export.repository;

import com.privacy.export.entity.ExportRequest;
import com.privacy.export.enums.ExportRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExportRequestRepository extends JpaRepository<ExportRequest, Long> {

    Optional<ExportRequest> findByRequestNo(String requestNo);

    List<ExportRequest> findByUserId(String userId);

    List<ExportRequest> findByStatus(ExportRequestStatus status);

    List<ExportRequest> findByStatusIn(List<ExportRequestStatus> statuses);

    @Query("SELECT e FROM ExportRequest e WHERE e.assignedTo = :assignedTo AND e.status NOT IN :terminalStatuses")
    List<ExportRequest> findAssignedPendingRequests(String assignedTo, List<ExportRequestStatus> terminalStatuses);

    boolean existsByRequestNo(String requestNo);

    @Query("SELECT COUNT(e) FROM ExportRequest e WHERE e.status = :status")
    long countByStatus(ExportRequestStatus status);
}
