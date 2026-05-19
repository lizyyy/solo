from typing import List
from ..models.mapping import AttributeMapping, MappingRule, MappingType, ValidationRule
from .base_parser import CsvParser, JsonParser, ParseResult


class AttributeMappingParser(CsvParser[MappingRule]):
    def parse(self) -> ParseResult[AttributeMapping]:
        rows, total_lines = self._read_csv()
        rules: List[MappingRule] = []

        for line_num, row in rows:
            try:
                source_field = row.get("source_field", "")
                target_field = row.get("target_field", "")

                if not target_field:
                    self._add_error(line_num, "missing_target", "缺少目标字段", str(row))
                    continue

                mapping_type_str = row.get("mapping_type", "direct").lower()
                try:
                    mapping_type = MappingType(mapping_type_str)
                except ValueError:
                    mapping_type = MappingType.DIRECT

                validation_rules = []
                if row.get("validation"):
                    for r in row["validation"].split("|"):
                        r = r.strip()
                        try:
                            validation_rules.append(ValidationRule(r))
                        except ValueError:
                            pass

                rule = MappingRule(
                    source_field=source_field,
                    target_field=target_field,
                    mapping_type=mapping_type,
                    transform_expression=row.get("transform"),
                    constant_value=row.get("constant"),
                    validation_rules=validation_rules,
                    pattern=row.get("pattern"),
                    condition=row.get("condition"),
                    source_file=str(self.file_path),
                    line_number=line_num,
                )
                rules.append(rule)
            except Exception as e:
                self._add_error(line_num, "parse_error", f"解析失败: {str(e)}", str(row))

        mapping = AttributeMapping(
            name=self.file_path.stem,
            rules=rules,
            source_file=str(self.file_path),
        )

        return ParseResult(
            items=[mapping],
            errors=self.errors,
            file_path=str(self.file_path),
            total_lines=total_lines,
        )


class AttributeMappingJsonParser(JsonParser[AttributeMapping]):
    def parse(self) -> ParseResult[AttributeMapping]:
        data, total_lines = self._read_json()

        if data is None:
            return ParseResult(items=[], errors=self.errors, file_path=str(self.file_path))

        try:
            rules_data = data.get("rules", []) if isinstance(data, dict) else data
            rules: List[MappingRule] = []

            for line_num, rule_data in enumerate(rules_data, start=1):
                mapping_type_str = rule_data.get("mapping_type", "direct").lower()
                try:
                    mapping_type = MappingType(mapping_type_str)
                except ValueError:
                    mapping_type = MappingType.DIRECT

                validation_rules = []
                if rule_data.get("validation_rules"):
                    for r in rule_data["validation_rules"]:
                        try:
                            validation_rules.append(ValidationRule(r))
                        except ValueError:
                            pass

                rule = MappingRule(
                    source_field=rule_data.get("source_field", ""),
                    target_field=rule_data.get("target_field", ""),
                    mapping_type=mapping_type,
                    transform_expression=rule_data.get("transform_expression"),
                    constant_value=rule_data.get("constant_value"),
                    validation_rules=validation_rules,
                    pattern=rule_data.get("pattern"),
                    condition=rule_data.get("condition"),
                    source_file=str(self.file_path),
                    line_number=line_num,
                )
                rules.append(rule)

            mapping = AttributeMapping(
                name=data.get("name", self.file_path.stem) if isinstance(data, dict) else self.file_path.stem,
                rules=rules,
                source_file=str(self.file_path),
                description=data.get("description") if isinstance(data, dict) else None,
            )

            return ParseResult(
                items=[mapping],
                errors=self.errors,
                file_path=str(self.file_path),
                total_lines=total_lines,
            )
        except Exception as e:
            self._add_error(0, "parse_error", f"解析失败: {str(e)}")
            return ParseResult(items=[], errors=self.errors, file_path=str(self.file_path))
