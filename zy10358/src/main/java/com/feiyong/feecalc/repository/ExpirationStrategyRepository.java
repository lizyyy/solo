package com.feiyong.feecalc.repository;

import com.feiyong.feecalc.entity.ExpirationStrategy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ExpirationStrategyRepository extends JpaRepository<ExpirationStrategy, Long> {

    Optional<ExpirationStrategy> findByStrategyCodeAndEnabledTrue(String strategyCode);
}
