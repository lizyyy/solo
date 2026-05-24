package com.agri.dronespray.repository;

import com.agri.dronespray.entity.AmendmentHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AmendmentHistoryRepository extends JpaRepository<AmendmentHistory, Long> {

    List<AmendmentHistory> findByPermissionIdOrderByAmendedAtDesc(Long permissionId);
}
