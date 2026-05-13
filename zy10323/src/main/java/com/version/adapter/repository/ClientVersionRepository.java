package com.version.adapter.repository;

import com.version.adapter.entity.ClientVersion;
import com.version.adapter.entity.enums.VersionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClientVersionRepository extends JpaRepository<ClientVersion, Long> {

    Optional<ClientVersion> findByVersionNumber(String versionNumber);

    List<ClientVersion> findByClientType(String clientType);

    List<ClientVersion> findByStatus(VersionStatus status);

    List<ClientVersion> findByIsDeprecatedTrue();

    boolean existsByVersionNumber(String versionNumber);
}
