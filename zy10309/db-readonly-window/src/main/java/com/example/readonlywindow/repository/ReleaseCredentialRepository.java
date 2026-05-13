package com.example.readonlywindow.repository;

import com.example.readonlywindow.entity.ReleaseCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReleaseCredentialRepository extends JpaRepository<ReleaseCredential, Long> {
    Optional<ReleaseCredential> findByCredentialCode(String credentialCode);
    List<ReleaseCredential> findByFreezeWindowId(Long windowId);
    List<ReleaseCredential> findByIssuedTo(String issuedTo);
    List<ReleaseCredential> findByFreezeWindowIdAndUsedFalse(Long windowId);
    boolean existsByCredentialCode(String credentialCode);
}
