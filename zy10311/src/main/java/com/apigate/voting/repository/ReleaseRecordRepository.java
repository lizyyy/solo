package com.apigate.voting.repository;

import com.apigate.voting.model.ReleaseRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReleaseRecordRepository extends JpaRepository<ReleaseRecord, Long> {
    List<ReleaseRecord> findByProposalId(Long proposalId);
}
