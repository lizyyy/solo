package com.feiyong.feecalc.repository;

import com.feiyong.feecalc.entity.ActionTimeline;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ActionTimelineRepository extends JpaRepository<ActionTimeline, Long> {

    List<ActionTimeline> findByRequestNoOrderByActionTimeAsc(String requestNo);

    List<ActionTimeline> findByActionTimeBetweenOrderByActionTimeDesc(LocalDateTime start, LocalDateTime end);
}
