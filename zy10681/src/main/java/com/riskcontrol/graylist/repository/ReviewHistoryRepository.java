package com.riskcontrol.graylist.repository;

import com.riskcontrol.graylist.entity.ReviewHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReviewHistoryRepository extends JpaRepository<ReviewHistory, Long> {

    List<ReviewHistory> findByRecordIdOrderByReviewTimeDesc(Long recordId);

    List<ReviewHistory> findByReviewer(String reviewer);
}
