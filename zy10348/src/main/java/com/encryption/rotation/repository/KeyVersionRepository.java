package com.encryption.rotation.repository;

import com.encryption.rotation.model.entity.KeyVersion;
import com.encryption.rotation.model.enums.KeyStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KeyVersionRepository extends JpaRepository<KeyVersion, String> {
    List<KeyVersion> findByTenantIdOrderByVersionDesc(String tenantId);
    Optional<KeyVersion> findByTenantIdAndVersion(String tenantId, Integer version);
    Optional<KeyVersion> findByTenantIdAndStatus(String tenantId, KeyStatus status);
    boolean existsByTenantIdAndVersion(String tenantId, Integer version);
}
