package com.compensation.repository;

import com.compensation.entity.CompletionProof;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CompletionProofRepository extends JpaRepository<CompletionProof, Long> {
    
    Optional<CompletionProof> findByProofId(String proofId);
    
    boolean existsByProofId(String proofId);
    
    Optional<CompletionProof> findByUndoRequestId(Long requestId);
    
    Optional<CompletionProof> findByUndoRequestRequestId(String requestId);
}
