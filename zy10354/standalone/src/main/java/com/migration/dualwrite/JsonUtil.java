package com.migration.dualwrite;

import java.io.*;
import java.util.*;

/**
 * 零依赖 JSON 工具类
 * 手动实现简单的 JSON 序列化/反序列化
 */
public class JsonUtil {

    public static String toJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (!first) {
                sb.append(",");
            }
            first = false;
            sb.append("\"").append(escapeJson(entry.getKey())).append("\":");
            sb.append(valueToJson(entry.getValue()));
        }
        sb.append("}");
        return sb.toString();
    }

    private static String valueToJson(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof String) {
            return "\"" + escapeJson((String) value) + "\"";
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value.toString();
        }
        if (value instanceof List) {
            return listToJson((List<?>) value);
        }
        if (value instanceof Map) {
            return toJson((Map<String, Object>) value);
        }
        return "\"" + escapeJson(value.toString()) + "\"";
    }

    private static String listToJson(List<?> list) {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(valueToJson(list.get(i)));
        }
        sb.append("]");
        return sb.toString();
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    public static Map<String, Object> parseJson(String json) {
        return parseObject(new JsonReader(json));
    }

    private static Map<String, Object> parseObject(JsonReader reader) {
        Map<String, Object> map = new LinkedHashMap<>();
        reader.expect('{');
        reader.skipWhitespace();
        while (reader.peek() != '}') {
            String key = reader.readString();
            reader.skipWhitespace();
            reader.expect(':');
            reader.skipWhitespace();
            Object value = reader.readValue();
            map.put(key, value);
            reader.skipWhitespace();
            if (reader.peek() == ',') {
                reader.next();
                reader.skipWhitespace();
            }
        }
        reader.expect('}');
        return map;
    }

    private static class JsonReader {
        private final String json;
        private int pos = 0;

        public JsonReader(String json) {
            this.json = json;
        }

        public char peek() {
            while (pos < json.length() && Character.isWhitespace(json.charAt(pos))) {
                pos++;
            }
            return pos < json.length() ? json.charAt(pos) : '\0';
        }

        public void skipWhitespace() {
            while (pos < json.length() && Character.isWhitespace(json.charAt(pos))) {
                pos++;
            }
        }

        public void expect(char c) {
            skipWhitespace();
            if (pos >= json.length() || json.charAt(pos) != c) {
                throw new RuntimeException("Expected '" + c + "' at position " + pos);
            }
            pos++;
        }

        public void next() {
            pos++;
        }

        public String readString() {
            expect('"');
            StringBuilder sb = new StringBuilder();
            while (pos < json.length() && json.charAt(pos) != '"') {
                if (json.charAt(pos) == '\\') {
                    pos++;
                    if (pos >= json.length()) break;
                }
                sb.append(json.charAt(pos));
                pos++;
            }
            expect('"');
            return sb.toString();
        }

        public Object readValue() {
            char c = peek();
            if (c == '"') {
                return readString();
            }
            if (c == '{') {
                return parseObject(this);
            }
            if (c == '[') {
                return readArray();
            }
            if (c == 't' || c == 'f') {
                return readBoolean();
            }
            if (c == 'n') {
                return readNull();
            }
            return readNumber();
        }

        private List<Object> readArray() {
            List<Object> list = new ArrayList<>();
            expect('[');
            skipWhitespace();
            while (peek() != ']') {
                list.add(readValue());
                skipWhitespace();
                if (peek() == ',') {
                    next();
                    skipWhitespace();
                }
            }
            expect(']');
            return list;
        }

        private Boolean readBoolean() {
            if (json.startsWith("true", pos)) {
                pos += 4;
                return true;
            }
            if (json.startsWith("false", pos)) {
                pos += 5;
                return false;
            }
            throw new RuntimeException("Invalid boolean at position " + pos);
        }

        private Object readNull() {
            if (json.startsWith("null", pos)) {
                pos += 4;
                return null;
            }
            throw new RuntimeException("Invalid null at position " + pos);
        }

        private Number readNumber() {
            int start = pos;
            while (pos < json.length() && (Character.isDigit(json.charAt(pos)) || json.charAt(pos) == '.' || json.charAt(pos) == '-')) {
                pos++;
            }
            String numStr = json.substring(start, pos);
            if (numStr.contains(".")) {
                return Double.parseDouble(numStr);
            }
            return Long.parseLong(numStr);
        }
    }
}
