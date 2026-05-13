package com.apigate.voting.repository;

import com.apigate.voting.model.ImpactItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ImpactItemRepository extends JpaRepository<ImpactItem, Long> {
    List<ImpactItem> findByProposalId(Long proposalId);
    List<ImpactItem> findByProposalIdAndIsNotifiedFalse(Long proposalId);
}
