package com.livestock.transfer.repository;

import com.livestock.transfer.entity.TransferValidation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransferValidationRepository extends JpaRepository<TransferValidation, Long> {
    List<TransferValidation> findByTransferId(Long transferId);
    List<TransferValidation> findByTransferIdAndIsResolved(Long transferId, Boolean isResolved);
    void deleteByTransferId(Long transferId);
}
