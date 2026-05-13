package com.devicecommand.repository;

import com.devicecommand.entity.ExecutionConfirm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExecutionConfirmRepository extends JpaRepository<ExecutionConfirm, Long> {

    Optional<ExecutionConfirm> findByConfirmNo(String confirmNo);

    List<ExecutionConfirm> findByBatchNo(String batchNo);

    List<ExecutionConfirm> findByDeviceCode(String deviceCode);

    boolean existsByConfirmNo(String confirmNo);
}
