package com.privacy.export.repository;

import com.privacy.export.entity.ConsentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ConsentVersionRepository extends JpaRepository<ConsentVersion, Long> {

    Optional<ConsentVersion> findByVersionCode(String versionCode);

    @Query("SELECT c FROM ConsentVersion c WHERE c.isActive = true AND c.effectiveDate <= :now AND (c.expiryDate IS NULL OR c.expiryDate > :now)")
    List<ConsentVersion> findActiveValidVersions(LocalDateTime now);

    default List<ConsentVersion> findActiveValidVersions() {
        return findActiveValidVersions(LocalDateTime.now());
    }

    List<ConsentVersion> findByIsActiveTrue();

    boolean existsByVersionCode(String versionCode);
}
