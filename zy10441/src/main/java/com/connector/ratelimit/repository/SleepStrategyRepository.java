package com.connector.ratelimit.repository;

import com.connector.ratelimit.model.entity.SleepStrategy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SleepStrategyRepository extends JpaRepository<SleepStrategy, Long> {
    Optional<SleepStrategy> findByStrategyCode(String strategyCode);
    Optional<SleepStrategy> findBySleepLevel(Integer sleepLevel);
    List<SleepStrategy> findByEnabledTrue();
}
