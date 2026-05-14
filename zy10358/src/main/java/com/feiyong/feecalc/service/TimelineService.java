package com.feiyong.feecalc.service;

import com.alibaba.fastjson.JSON;
import com.feiyong.feecalc.entity.ActionTimeline;
import com.feiyong.feecalc.repository.ActionTimelineRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TimelineService {

    @Autowired
    private ActionTimelineRepository timelineRepository;

    @Transactional
    public void recordAction(String requestNo, String action, String actionDesc, Object beforeData, Object afterData, String operator) {
        ActionTimeline timeline = new ActionTimeline();
        timeline.setRequestNo(requestNo);
        timeline.setAction(action);
        timeline.setActionDesc(actionDesc);
        timeline.setBeforeData(beforeData != null ? abbreviate(JSON.toJSONString(beforeData), 2000) : null);
        timeline.setAfterData(afterData != null ? abbreviate(JSON.toJSONString(afterData), 2000) : null);
        timeline.setOperator(operator);
        timeline.setActionTime(LocalDateTime.now());
        timelineRepository.save(timeline);
    }

    private String abbreviate(String str, int maxLength) {
        if (str == null || str.length() <= maxLength) {
            return str;
        }
        return str.substring(0, maxLength - 3) + "...";
    }

    public List<ActionTimeline> getTimelineByRequestNo(String requestNo) {
        return timelineRepository.findByRequestNoOrderByActionTimeAsc(requestNo);
    }
}
