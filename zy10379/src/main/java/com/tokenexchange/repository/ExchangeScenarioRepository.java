package com.tokenexchange.repository;

import com.tokenexchange.entity.ExchangeScenario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ExchangeScenarioRepository extends JpaRepository<ExchangeScenario, Long> {
    Optional<ExchangeScenario> findByScenarioCode(String scenarioCode);
    Optional<ExchangeScenario> findByScenarioCodeAndEnabledTrue(String scenarioCode);
    Optional<ExchangeScenario> findBySourceServiceIdAndTargetServiceIdAndEnabledTrue(String sourceServiceId, String targetServiceId);
}
