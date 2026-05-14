package com.featureflag.audit.repository;

import com.featureflag.audit.entity.Experiment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ExperimentRepository extends JpaRepository<Experiment, Long> {
    Optional<Experiment> findByExperimentKey(String experimentKey);
    boolean existsByExperimentKey(String experimentKey);
}
