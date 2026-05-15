package com.datarepair.approval.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datarepair.approval.entity.TimelineRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TimelineRecordMapper extends BaseMapper<TimelineRecord> {

    List<TimelineRecord> selectByScriptId(@Param("scriptId") Long scriptId);

    List<TimelineRecord> selectByScriptIdOrderByTime(@Param("scriptId") Long scriptId);
}
