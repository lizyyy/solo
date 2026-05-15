package com.crossborder.approval.repository;

import com.crossborder.approval.model.entity.AccessToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AccessTokenRepository extends JpaRepository<AccessToken, Long> {

    Optional<AccessToken> findByToken(String token);

    Optional<AccessToken> findByApplicationId(Long applicationId);

    boolean existsByApplicationId(Long applicationId);
}
