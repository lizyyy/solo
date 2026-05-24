package com.agri.dronespray.repository;

import com.agri.dronespray.entity.OperationReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OperationReportRepository extends JpaRepository<OperationReport, Long> {

    Optional<OperationReport> findByReportNo(String reportNo);

    Optional<OperationReport> findByPermissionId(Long permissionId);
}
