package com.datarepair.approval.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datarepair.approval.entity.RollbackRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface RollbackRecordMapper extends BaseMapper<RollbackRecord> {

    List<RollbackRecord> selectByScriptId(@Param("scriptId") Long scriptId);

    RollbackRecord selectByExecutionBatchId(@Param("executionBatchId") Long executionBatchId);
}
