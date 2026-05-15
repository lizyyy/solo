package com.datarepair.approval.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.datarepair.approval.entity.TargetScope;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TargetScopeMapper extends BaseMapper<TargetScope> {

    List<TargetScope> selectByScriptId(@Param("scriptId") Long scriptId);

    int deleteByScriptId(@Param("scriptId") Long scriptId);
}
