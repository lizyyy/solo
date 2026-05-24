package com.agri.dronespray.repository;

import com.agri.dronespray.entity.CheckRecord;
import com.agri.dronespray.entity.CheckType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CheckRecordRepository extends JpaRepository<CheckRecord, Long> {

    List<CheckRecord> findByPermissionId(Long permissionId);

    List<CheckRecord> findByPermissionIdAndCheckType(Long permissionId, CheckType checkType);
}
