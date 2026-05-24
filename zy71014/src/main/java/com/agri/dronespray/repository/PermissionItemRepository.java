package com.agri.dronespray.repository;

import com.agri.dronespray.entity.PermissionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PermissionItemRepository extends JpaRepository<PermissionItem, Long> {

    List<PermissionItem> findByPermissionId(Long permissionId);
}
