package com.crossborder.approval.repository;

import com.crossborder.approval.model.entity.EvidenceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EvidenceRecordRepository extends JpaRepository<EvidenceRecord, Long> {

    List<EvidenceRecord> findByApplicationIdOrderByCollectedAtDesc(Long applicationId);

    List<EvidenceRecord> findByAccessTokenIdOrderByCollectedAtDesc(Long tokenId);
}
