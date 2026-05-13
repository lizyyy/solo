package com.devicecommand.repository;

import com.devicecommand.entity.CommandBatch;
import com.devicecommand.enums.CommandStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CommandBatchRepository extends JpaRepository<CommandBatch, Long> {

    Optional<CommandBatch> findByBatchNo(String batchNo);

    boolean existsByBatchNo(String batchNo);

    List<CommandBatch> findByDeviceCode(String deviceCode);

    List<CommandBatch> findByStatus(CommandStatus status);

    @Query("SELECT c FROM CommandBatch c WHERE c.status IN ('CONFIRMING', 'RETRYING') AND c.expectedConfirmTime < :now")
    List<CommandBatch> findTimeoutCommands(LocalDateTime now);

    List<CommandBatch> findByStatusIn(List<CommandStatus> statuses);
}
