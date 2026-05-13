package com.apigate.voting.repository;

import com.apigate.voting.model.VoteOpinion;
import com.apigate.voting.model.VoteResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VoteOpinionRepository extends JpaRepository<VoteOpinion, Long> {
    List<VoteOpinion> findByProposalId(Long proposalId);
    List<VoteOpinion> findByProposalIdAndResult(Long proposalId, VoteResult result);
    long countByProposalIdAndResult(Long proposalId, VoteResult result);
    boolean existsByProposalIdAndVoterId(Long proposalId, Long voterId);
}
