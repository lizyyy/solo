package com.agri.dronespray.repository;

import com.agri.dronespray.entity.ProcessingRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessingRecordRepository extends JpaRepository<ProcessingRecord, Long> {

    List<ProcessingRecord> findByPermissionIdOrderByProcessedAtDesc(Long permissionId);
}
