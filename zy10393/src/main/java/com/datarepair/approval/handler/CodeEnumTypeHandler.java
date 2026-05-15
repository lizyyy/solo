package com.datarepair.approval.handler;

import com.baomidou.mybatisplus.annotation.EnumValue;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.lang.reflect.Field;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class CodeEnumTypeHandler<E extends Enum<E>> extends BaseTypeHandler<E> {

    private final Class<E> type;
    private final E[] enums;
    private Field codeField;

    public CodeEnumTypeHandler(Class<E> type) {
        if (type == null) {
            throw new IllegalArgumentException("Type argument cannot be null");
        }
        this.type = type;
        this.enums = type.getEnumConstants();
        if (this.enums == null) {
            throw new IllegalArgumentException(type.getSimpleName() + " does not represent an enum type.");
        }
        initCodeField();
    }

    private void initCodeField() {
        for (Field field : type.getDeclaredFields()) {
            if (field.isAnnotationPresent(EnumValue.class)) {
                field.setAccessible(true);
                this.codeField = field;
                return;
            }
        }
        for (Field field : type.getDeclaredFields()) {
            if ("code".equals(field.getName()) && (field.getType() == Integer.class || field.getType() == int.class)) {
                field.setAccessible(true);
                this.codeField = field;
                return;
            }
        }
    }

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, E parameter, JdbcType jdbcType) throws SQLException {
        try {
            Object code = codeField.get(parameter);
            if (jdbcType == null) {
                ps.setObject(i, code);
            } else {
                ps.setObject(i, code, jdbcType.TYPE_CODE);
            }
        } catch (IllegalAccessException e) {
            throw new SQLException("Failed to get enum code value", e);
        }
    }

    @Override
    public E getNullableResult(ResultSet rs, String columnName) throws SQLException {
        Object code = rs.getObject(columnName);
        if (rs.wasNull()) {
            return null;
        }
        return toEnum(code);
    }

    @Override
    public E getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        Object code = rs.getObject(columnIndex);
        if (rs.wasNull()) {
            return null;
        }
        return toEnum(code);
    }

    @Override
    public E getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        Object code = cs.getObject(columnIndex);
        if (cs.wasNull()) {
            return null;
        }
        return toEnum(code);
    }

    private E toEnum(Object code) throws SQLException {
        if (code == null) {
            return null;
        }
        try {
            for (E e : enums) {
                Object enumCode = codeField.get(e);
                if (code.equals(enumCode) || String.valueOf(code).equals(String.valueOf(enumCode))) {
                    return e;
                }
            }
            throw new SQLException("Cannot convert " + code + " to " + type.getSimpleName());
        } catch (IllegalAccessException e) {
            throw new SQLException("Failed to convert code to enum", e);
        }
    }
}
