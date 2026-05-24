package com.hospital.oxygen.repository;

import com.hospital.oxygen.entity.TransferRequest;
import com.hospital.oxygen.enums.TransferStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransferRequestRepository extends JpaRepository<TransferRequest, Long> {
    Optional<TransferRequest> findByTransferNumber(String transferNumber);
    List<TransferRequest> findByPatientId(String patientId);
    List<TransferRequest> findByFromWard(String ward);
    List<TransferRequest> findByToWard(String ward);
    List<TransferRequest> findByStatus(TransferStatus status);

    @Query("SELECT tr FROM TransferRequest tr WHERE tr.status = 'COMPLETED' AND tr.resourcesReleased = false")
    List<TransferRequest> findCompletedTransfersWithUnreleasedResources();

    @Query("SELECT tr FROM TransferRequest tr WHERE tr.patientId = :patientId AND tr.status IN :statuses")
    List<TransferRequest> findActiveTransfersByPatient(@Param("patientId") String patientId, @Param("statuses") List<TransferStatus> statuses);

    @Query("SELECT COUNT(tr) FROM TransferRequest tr WHERE tr.patientId = :patientId AND tr.status = 'COMPLETED' AND tr.resourcesReleased = false")
    long countUnreleasedTransfers(@Param("patientId") String patientId);
}
