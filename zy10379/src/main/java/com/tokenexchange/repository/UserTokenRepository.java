package com.tokenexchange.repository;

import com.tokenexchange.entity.UserToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserTokenRepository extends JpaRepository<UserToken, Long> {
    Optional<UserToken> findByTokenValue(String tokenValue);
    List<UserToken> findByUserId(String userId);
    List<UserToken> findByUserIdAndRevokedFalse(String userId);
}
