package com.connector.ratelimit.repository;

import com.connector.ratelimit.model.entity.RateLimitWindow;
import com.connector.ratelimit.model.enums.RateLimitType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RateLimitWindowRepository extends JpaRepository<RateLimitWindow, Long> {
    List<RateLimitWindow> findByConnectorCode(String connectorCode);
    Optional<RateLimitWindow> findByConnectorCodeAndLimitTypeAndWindowStartLessThanEqualAndWindowEndGreaterThanEqual(
            String connectorCode, RateLimitType limitType, LocalDateTime time1, LocalDateTime time2);
    List<RateLimitWindow> findByConnectorCodeAndIsBreachedTrue(String connectorCode);
}
