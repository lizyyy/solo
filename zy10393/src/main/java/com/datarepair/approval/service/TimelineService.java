package com.datarepair.approval.service;

import com.datarepair.approval.entity.TimelineRecord;
import com.datarepair.approval.enums.ApprovalAction;
import com.datarepair.approval.enums.ScriptStatus;
import com.datarepair.approval.mapper.TimelineRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TimelineService {

    private final TimelineRecordMapper timelineRecordMapper;

    public void record(Long scriptId, Long batchId, ApprovalAction action,
                       ScriptStatus fromStatus, ScriptStatus toStatus,
                       String operator, String operatorDept, String remark, String detail) {
        TimelineRecord record = new TimelineRecord();
        record.setScriptId(scriptId);
        record.setBatchId(batchId);
        record.setAction(action);
        record.setFromStatus(fromStatus);
        record.setToStatus(toStatus);
        record.setOperator(operator);
        record.setOperatorDept(operatorDept);
        record.setActionTime(LocalDateTime.now());
        record.setRemark(remark);
        record.setDetail(detail);
        timelineRecordMapper.insert(record);
    }

    public List<TimelineRecord> getTimelineByScriptId(Long scriptId) {
        return timelineRecordMapper.selectByScriptIdOrderByTime(scriptId);
    }
}
