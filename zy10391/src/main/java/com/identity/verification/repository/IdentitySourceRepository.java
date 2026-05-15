package com.identity.verification.repository;

import com.identity.verification.model.IdentitySource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IdentitySourceRepository extends JpaRepository<IdentitySource, Long> {

    Optional<IdentitySource> findBySourceCode(String sourceCode);

    boolean existsBySourceCode(String sourceCode);
}
