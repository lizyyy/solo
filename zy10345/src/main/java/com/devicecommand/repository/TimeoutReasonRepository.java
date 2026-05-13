package com.devicecommand.repository;

import com.devicecommand.entity.TimeoutReason;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TimeoutReasonRepository extends JpaRepository<TimeoutReason, Long> {

    List<TimeoutReason> findByBatchNo(String batchNo);

    List<TimeoutReason> findByDeviceCode(String deviceCode);
}
