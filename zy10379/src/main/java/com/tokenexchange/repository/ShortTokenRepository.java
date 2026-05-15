package com.tokenexchange.repository;

import com.tokenexchange.entity.ShortToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShortTokenRepository extends JpaRepository<ShortToken, Long> {
    Optional<ShortToken> findByTokenValue(String tokenValue);
    List<ShortToken> findByUserId(String userId);
    List<ShortToken> findByUserIdAndRevokedFalse(String userId);
    List<ShortToken> findBySourceServiceIdAndTargetServiceId(String sourceServiceId, String targetServiceId);
}
