package com.floodrelief.repository;

import com.floodrelief.entity.AllocationEvidence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AllocationEvidenceRepository extends JpaRepository<AllocationEvidence, Long> {
    List<AllocationEvidence> findByAllocationIdOrderByCreatedAtDesc(Long allocationId);
}
