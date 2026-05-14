package com.compensation.repository;

import com.compensation.entity.CompensationExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CompensationExecutionRepository extends JpaRepository<CompensationExecution, Long> {

    Optional<CompensationExecution> findByExecutionId(String executionId);

    List<CompensationExecution> findByInstructionId(String instructionId);

    boolean existsByExecutionId(String executionId);
}
