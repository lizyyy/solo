package com.devicecommand.repository;

import com.devicecommand.entity.CommandStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommandStatusHistoryRepository extends JpaRepository<CommandStatusHistory, Long> {

    List<CommandStatusHistory> findByBatchNoOrderByCreateTimeAsc(String batchNo);

    List<CommandStatusHistory> findByBatchIdOrderByCreateTimeAsc(Long batchId);
}
