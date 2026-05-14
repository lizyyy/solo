package com.compensation.repository;

import com.compensation.entity.CompensationInstruction;
import com.compensation.enums.InstructionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CompensationInstructionRepository extends JpaRepository<CompensationInstruction, Long> {

    Optional<CompensationInstruction> findByInstructionId(String instructionId);

    List<CompensationInstruction> findByProcessIdOrderByExecutionOrderAsc(String processId);

    List<CompensationInstruction> findByProcessIdAndStatus(String processId, InstructionStatus status);

    List<CompensationInstruction> findByNodeId(String nodeId);

    boolean existsByInstructionId(String instructionId);
}
