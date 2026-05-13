package com.apigate.voting.repository;

import com.apigate.voting.model.BlockReason;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BlockReasonRepository extends JpaRepository<BlockReason, Long> {
    List<BlockReason> findByProposalId(Long proposalId);
    List<BlockReason> findByProposalIdAndIsResolvedFalse(Long proposalId);
    long countByProposalIdAndIsResolvedFalse(Long proposalId);
}
