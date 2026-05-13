package com.lineage.repository;

import com.lineage.entity.LineageHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LineageHistoryRepository extends JpaRepository<LineageHistory, Long> {

    List<LineageHistory> findByLineageIdOrderByCreatedAtDesc(Long lineageId);

    List<LineageHistory> findByOperatorOrderByCreatedAtDesc(String operator);
}
