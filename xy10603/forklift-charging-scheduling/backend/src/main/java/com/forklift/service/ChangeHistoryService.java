package com.forklift.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.forklift.entity.ChangeHistory;
import com.forklift.mapper.ChangeHistoryMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ChangeHistoryService {

    @Autowired
    private ChangeHistoryMapper changeHistoryMapper;

    @Transactional
    public void recordChange(String entityType, Long entityId, String fieldName, 
                             Object oldValue, Object newValue, String operation, 
                             String operator, String remarks) {
        ChangeHistory history = new ChangeHistory();
        history.setEntityType(entityType);
        history.setEntityId(entityId);
        history.setFieldName(fieldName);
        history.setOldValue(oldValue != null ? oldValue.toString() : null);
        history.setNewValue(newValue != null ? newValue.toString() : null);
        history.setOperation(operation);
        history.setOperator(operator);
        history.setRemarks(remarks);
        history.setCreatedAt(LocalDateTime.now());
        changeHistoryMapper.insert(history);
    }

    public List<ChangeHistory> getHistoryByEntity(String entityType, Long entityId) {
        QueryWrapper<ChangeHistory> wrapper = new QueryWrapper<>();
        wrapper.eq("entity_type", entityType)
               .eq("entity_id", entityId)
               .orderByDesc("created_at");
        return changeHistoryMapper.selectList(wrapper);
    }

    public List<ChangeHistory> getHistoryByOperator(String operator) {
        QueryWrapper<ChangeHistory> wrapper = new QueryWrapper<>();
        wrapper.eq("operator", operator)
               .orderByDesc("created_at");
        return changeHistoryMapper.selectList(wrapper);
    }

    public List<ChangeHistory> getHistoryByTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        QueryWrapper<ChangeHistory> wrapper = new QueryWrapper<>();
        wrapper.between("created_at", startTime, endTime)
               .orderByDesc("created_at");
        return changeHistoryMapper.selectList(wrapper);
    }
}
