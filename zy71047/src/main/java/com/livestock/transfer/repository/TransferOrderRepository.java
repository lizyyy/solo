package com.livestock.transfer.repository;

import com.livestock.transfer.entity.TransferOrder;
import com.livestock.transfer.enums.TransferStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransferOrderRepository extends JpaRepository<TransferOrder, Long> {
    Optional<TransferOrder> findByTransferNo(String transferNo);
    List<TransferOrder> findByStatus(TransferStatus status);
    List<TransferOrder> findBySourceFarmIdOrTargetFarmId(Long sourceFarmId, Long targetFarmId);
}
