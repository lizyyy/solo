package com.datarepair.approval.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datarepair.approval.entity.DryRunResult;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DryRunResultMapper extends BaseMapper<DryRunResult> {

    List<DryRunResult> selectByScriptId(@Param("scriptId") Long scriptId);

    DryRunResult selectLatestByScriptId(@Param("scriptId") Long scriptId);
}
