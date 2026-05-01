import json
import os
import tempfile
import unittest
from unittest.mock import patch

import yaml

from crm_migrate.config import MappingConfig, SchemaConfig, load_mapping, load_schema
from crm_migrate.csv_loader import CSVLoader, DataNormalizer
from crm_migrate.dependency_sorter import DependencySorter
from crm_migrate.sql_generator import SQLGenerator
from crm_migrate.validators import (
    DEFAULT_VALIDATORS,
    DuplicateNaturalKeyValidator,
    EmailValidator,
    EnumValidator,
    LengthValidator,
    RequiredFieldValidator,
    Severity,
    TypeValidator,
)


class TestConfigParsing(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        
        self.schema_data = {
            "tables": {
                "accounts": {
                    "columns": {
                        "id": {"type": "string", "required": True},
                        "name": {"type": "string", "required": True},
                        "status": {"type": "string", "enum": ["active", "inactive"]},
                    }
                },
                "contacts": {
                    "columns": {
                        "id": {"type": "string", "required": True},
                        "account_id": {"type": "string", "required": True},
                        "email": {"type": "string", "format": "email"},
                    },
                    "foreign_keys": [
                        {
                            "column": "account_id",
                            "referenced_table": "accounts",
                            "referenced_column": "id",
                        }
                    ],
                },
            }
        }
        
        self.mapping_data = {
            "accounts": {
                "source_file": "accounts.csv",
                "natural_keys": ["id"],
                "fields": {"id": "id", "name": "company_name", "status": "status"},
            },
            "contacts": {
                "source_file": "contacts.csv",
                "natural_keys": ["id"],
                "fields": {"id": "id", "account_id": "account_id", "email": "email"},
            },
        }
    
    def test_load_schema_json(self):
        schema_path = os.path.join(self.temp_dir, "schema.json")
        with open(schema_path, "w") as f:
            json.dump(self.schema_data, f)
        
        schema = load_schema(schema_path)
        self.assertIsInstance(schema, SchemaConfig)
        self.assertEqual(len(schema.get_all_tables()), 2)
        self.assertIn("accounts", schema.get_all_tables())
    
    def test_load_schema_yaml(self):
        schema_path = os.path.join(self.temp_dir, "schema.yaml")
        with open(schema_path, "w") as f:
            yaml.dump(self.schema_data, f)
        
        schema = load_schema(schema_path)
        self.assertIsInstance(schema, SchemaConfig)
        self.assertEqual(schema.get_required_columns("accounts"), ["id", "name"])
    
    def test_load_mapping_json(self):
        mapping_path = os.path.join(self.temp_dir, "mapping.json")
        with open(mapping_path, "w") as f:
            json.dump(self.mapping_data, f)
        
        mapping = load_mapping(mapping_path)
        self.assertIsInstance(mapping, MappingConfig)
        self.assertEqual(mapping.get_source_file("accounts"), "accounts.csv")
    
    def test_schema_foreign_keys(self):
        schema = SchemaConfig(self.schema_data["tables"])
        fks = schema.get_foreign_keys("contacts")
        self.assertEqual(len(fks), 1)
        self.assertEqual(fks[0]["referenced_table"], "accounts")
    
    def test_schema_dependencies(self):
        schema = SchemaConfig(self.schema_data["tables"])
        deps = schema.get_dependencies("contacts")
        self.assertEqual(deps, ["accounts"])


class TestCSVLoader(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        
        csv_content = """ID,Name,Email,Phone,Active
1,Test Company,test@example.com,13800138000,true
2,  Another Co  ,another@EXAMPLE.COM,(010) 8888-8888,false
3,Empty Fields,,,"""
        
        self.csv_path = os.path.join(self.temp_dir, "test.csv")
        with open(self.csv_path, "w") as f:
            f.write(csv_content)
    
    def test_load_csv(self):
        loader = CSVLoader(self.temp_dir)
        headers, rows = loader.load_file("test.csv")
        
        self.assertEqual(len(headers), 5)
        self.assertEqual(len(rows), 3)
    
    def test_normalize_headers(self):
        loader = CSVLoader(self.temp_dir)
        headers, rows = loader.load_file("test.csv")
        
        self.assertIn("id", headers)
        self.assertIn("name", headers)
        self.assertIn("email", headers)
    
    def test_normalize_values(self):
        loader = CSVLoader(self.temp_dir)
        _, rows = loader.load_file("test.csv")
        
        self.assertEqual(rows[1]["name"], "Another Co")
        self.assertEqual(rows[2]["email"], None)
        self.assertEqual(rows[2]["phone"], None)
    
    def test_row_tracking(self):
        loader = CSVLoader(self.temp_dir)
        _, rows = loader.load_file("test.csv")
        
        self.assertEqual(rows[0]["_row_num"], 2)
        self.assertEqual(rows[1]["_row_num"], 3)
        self.assertEqual(rows[2]["_row_num"], 4)


class TestDataNormalizer(unittest.TestCase):
    def test_normalize_email(self):
        self.assertEqual(DataNormalizer.normalize_email("Test@Example.COM"), "test@example.com")
        self.assertEqual(DataNormalizer.normalize_email("  test@example.com  "), "test@example.com")
        self.assertIsNone(DataNormalizer.normalize_email(None))
    
    def test_normalize_phone(self):
        self.assertEqual(DataNormalizer.normalize_phone("(010) 8888-8888"), "01088888888")
        self.assertEqual(DataNormalizer.normalize_phone("+86 138 0013 8000"), "+8613800138000")
        self.assertIsNone(DataNormalizer.normalize_phone(None))
    
    def test_normalize_boolean(self):
        self.assertTrue(DataNormalizer.normalize_boolean("true"))
        self.assertTrue(DataNormalizer.normalize_boolean("yes"))
        self.assertTrue(DataNormalizer.normalize_boolean("1"))
        self.assertFalse(DataNormalizer.normalize_boolean("false"))
        self.assertFalse(DataNormalizer.normalize_boolean("no"))
        self.assertFalse(DataNormalizer.normalize_boolean("0"))
        self.assertIsNone(DataNormalizer.normalize_boolean("invalid"))
    
    def test_normalize_date(self):
        self.assertIsNotNone(DataNormalizer.normalize_date("2023-10-15"))
        self.assertIsNotNone(DataNormalizer.normalize_date("2023/10/15"))
        self.assertIsNotNone(DataNormalizer.normalize_date("15-Oct-2023"))
        self.assertIsNone(DataNormalizer.normalize_date("invalid date"))
    
    def test_normalize_integer(self):
        self.assertEqual(DataNormalizer.normalize_integer("123"), 123)
        self.assertEqual(DataNormalizer.normalize_integer("123.45"), 123)
        self.assertIsNone(DataNormalizer.normalize_integer("abc"))
    
    def test_normalize_float(self):
        self.assertEqual(DataNormalizer.normalize_float("123.45"), 123.45)
        self.assertEqual(DataNormalizer.normalize_float("100"), 100.0)
        self.assertIsNone(DataNormalizer.normalize_float("abc"))


class TestDependencySorter(unittest.TestCase):
    def setUp(self):
        self.schema_data = {
            "accounts": {
                "columns": {"id": {"type": "string"}},
                "foreign_keys": [],
            },
            "contacts": {
                "columns": {"id": {"type": "string"}, "account_id": {"type": "string"}},
                "foreign_keys": [
                    {
                        "column": "account_id",
                        "referenced_table": "accounts",
                        "referenced_column": "id",
                    }
                ],
            },
            "activities": {
                "columns": {
                    "id": {"type": "string"},
                    "account_id": {"type": "string"},
                    "contact_id": {"type": "string"},
                },
                "foreign_keys": [
                    {
                        "column": "account_id",
                        "referenced_table": "accounts",
                        "referenced_column": "id",
                    },
                    {
                        "column": "contact_id",
                        "referenced_table": "contacts",
                        "referenced_column": "id",
                    },
                ],
            },
        }
        self.schema = SchemaConfig(self.schema_data)
        self.sorter = DependencySorter(self.schema)
    
    def test_sort_tables(self):
        tables = ["activities", "accounts", "contacts"]
        sorted_tables = self.sorter.sort_tables(tables)
        
        self.assertEqual(sorted_tables[0], "accounts")
        self.assertEqual(sorted_tables[1], "contacts")
        self.assertEqual(sorted_tables[2], "activities")
    
    def test_sort_for_rollback(self):
        tables = ["activities", "accounts", "contacts"]
        sorted_tables = self.sorter.sort_for_rollback(tables)
        
        self.assertEqual(sorted_tables[0], "activities")
        self.assertEqual(sorted_tables[1], "contacts")
        self.assertEqual(sorted_tables[2], "accounts")


class TestSQLGenerator(unittest.TestCase):
    def setUp(self):
        schema_data = {
            "accounts": {
                "columns": {
                    "id": {"type": "string", "max_length": 50},
                    "name": {"type": "string", "max_length": 200},
                    "status": {"type": "string", "default": "active"},
                    "created_at": {"type": "date"},
                }
            }
        }
        mapping_data = {
            "accounts": {
                "source_file": "accounts.csv",
                "natural_keys": ["id"],
                "fields": {"id": "id", "name": "name", "status": "status"},
            }
        }
        
        self.schema = SchemaConfig(schema_data)
        self.mapping = MappingConfig(mapping_data)
        self.sql_gen = SQLGenerator(self.schema, self.mapping)
    
    def test_escape_string(self):
        self.assertEqual(self.sql_gen.escape_string("O'Neil"), "'O''Neil'")
        self.assertEqual(self.sql_gen.escape_string("test\\value"), "'test\\\\value'")
        self.assertEqual(self.sql_gen.escape_string(None), "NULL")
    
    def test_format_value_string(self):
        col_config = {"type": "string"}
        self.assertEqual(self.sql_gen.format_value("test", col_config), "'test'")
    
    def test_format_value_integer(self):
        col_config = {"type": "integer"}
        self.assertEqual(self.sql_gen.format_value("123", col_config), "123")
    
    def test_format_value_boolean(self):
        col_config = {"type": "boolean"}
        self.assertEqual(self.sql_gen.format_value("true", col_config), "TRUE")
        self.assertEqual(self.sql_gen.format_value("false", col_config), "FALSE")
    
    def test_format_value_with_default(self):
        col_config = {"type": "string", "default": "default_val"}
        self.assertEqual(self.sql_gen.format_value(None, col_config), "'default_val'")
    
    def test_generate_insert(self):
        row = {"id": "ACC001", "name": "Test Company", "status": "active"}
        source_info = {"source_file": "accounts.csv", "row_num": 2}
        
        sql = self.sql_gen.generate_insert("accounts", row, source_info)
        
        self.assertIn("INSERT INTO accounts", sql)
        self.assertIn("'ACC001'", sql)
        self.assertIn("'Test Company'", sql)
        self.assertIn("-- 源文件: accounts.csv", sql)
    
    def test_generate_delete(self):
        row = {"id": "ACC001", "name": "Test Company"}
        
        sql = self.sql_gen.generate_delete("accounts", row)
        
        self.assertIn("DELETE FROM accounts", sql)
        self.assertIn("WHERE id = 'ACC001'", sql)


class TestValidators(unittest.TestCase):
    def setUp(self):
        self.schema_data = {
            "accounts": {
                "columns": {
                    "id": {"type": "string", "required": True, "max_length": 10},
                    "name": {"type": "string", "required": True},
                    "industry": {
                        "type": "string",
                        "enum": ["tech", "finance", "retail"],
                    },
                    "email": {"type": "string", "format": "email"},
                }
            }
        }
        self.mapping_data = {
            "accounts": {
                "source_file": "accounts.csv",
                "natural_keys": ["id"],
                "fields": {"id": "id", "name": "name"},
            }
        }
        
        self.schema = SchemaConfig(self.schema_data)
        self.mapping = MappingConfig(self.mapping_data)
    
    def test_required_field_validator(self):
        validator = RequiredFieldValidator()
        rows = [
            {"id": "1", "name": "Test", "_row_num": 2},
            {"id": "2", "name": None, "_row_num": 3},
            {"id": None, "name": "Test", "_row_num": 4},
        ]
        
        issues = validator.validate(
            "accounts", rows, self.schema, self.mapping, {}
        )
        
        errors = [i for i in issues if i.severity == Severity.ERROR]
        self.assertEqual(len(errors), 2)
    
    def test_length_validator(self):
        validator = LengthValidator()
        rows = [
            {"id": "SHORT", "name": "Test", "_row_num": 2},
            {"id": "THIS_IS_A_VERY_LONG_ID", "name": "Test", "_row_num": 3},
        ]
        
        issues = validator.validate(
            "accounts", rows, self.schema, self.mapping, {}
        )
        
        errors = [i for i in issues if i.severity == Severity.ERROR]
        self.assertEqual(len(errors), 1)
    
    def test_enum_validator(self):
        validator = EnumValidator()
        rows = [
            {"industry": "tech", "_row_num": 2},
            {"industry": "invalid_industry", "_row_num": 3},
        ]
        
        issues = validator.validate(
            "accounts", rows, self.schema, self.mapping, {}
        )
        
        errors = [i for i in issues if i.severity == Severity.ERROR]
        self.assertEqual(len(errors), 1)
    
    def test_email_validator(self):
        validator = EmailValidator()
        rows = [
            {"email": "valid@example.com", "_row_num": 2},
            {"email": "invalid-email", "_row_num": 3},
        ]
        
        issues = validator.validate(
            "accounts", rows, self.schema, self.mapping, {}
        )
        
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        self.assertEqual(len(warnings), 1)
    
    def test_duplicate_natural_key_validator(self):
        validator = DuplicateNaturalKeyValidator()
        rows = [
            {"id": "1", "name": "Test1", "_row_num": 2, "_source_file": "test.csv"},
            {"id": "2", "name": "Test2", "_row_num": 3, "_source_file": "test.csv"},
            {"id": "1", "name": "Test1 Duplicate", "_row_num": 4, "_source_file": "test.csv"},
        ]
        
        issues = validator.validate(
            "accounts", rows, self.schema, self.mapping, {}
        )
        
        errors = [i for i in issues if i.severity == Severity.ERROR]
        self.assertEqual(len(errors), 2)
    
    def test_type_validator_integer(self):
        schema_data = {
            "test_table": {
                "columns": {
                    "num": {"type": "integer"},
                }
            }
        }
        schema = SchemaConfig(schema_data)
        
        validator = TypeValidator()
        rows = [
            {"num": "123", "_row_num": 2},
            {"num": "abc", "_row_num": 3},
        ]
        
        issues = validator.validate(
            "test_table", rows, schema, self.mapping, {}
        )
        
        errors = [i for i in issues if i.severity == Severity.ERROR]
        self.assertEqual(len(errors), 1)
    
    def test_type_validator_boolean(self):
        schema_data = {
            "test_table": {
                "columns": {
                    "active": {"type": "boolean"},
                }
            }
        }
        schema = SchemaConfig(schema_data)
        
        validator = TypeValidator()
        rows = [
            {"active": "true", "_row_num": 2},
            {"active": "yes", "_row_num": 3},
            {"active": "not_a_bool", "_row_num": 4},
        ]
        
        issues = validator.validate(
            "test_table", rows, schema, self.mapping, {}
        )
        
        errors = [i for i in issues if i.severity == Severity.ERROR]
        self.assertEqual(len(errors), 1)


if __name__ == "__main__":
    unittest.main()
