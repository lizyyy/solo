package com.hotel.lostfound.repository;

import com.hotel.lostfound.entity.StatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StatusHistoryRepository extends JpaRepository<StatusHistory, Long> {

    List<StatusHistory> findByLostItemIdOrderByOperateTimeDesc(Long lostItemId);
}
