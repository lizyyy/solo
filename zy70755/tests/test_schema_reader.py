import pytest
import json
from pathlib import Path
from openapi_fuzz_checker.core.schema_reader import OpenAPISchemaReader


@pytest.fixture
def sample_openapi_path():
    return str(Path(__file__).parent.parent / "examples" / "sample_openapi.yaml")


def test_load_openapi(sample_openapi_path):
    reader = OpenAPISchemaReader(sample_openapi_path)
    assert reader.spec is not None
    assert "components" in reader.spec


def test_get_all_schemas(sample_openapi_path):
    reader = OpenAPISchemaReader(sample_openapi_path)
    schemas = reader.get_all_schemas()
    assert "User" in schemas
    assert "CreateUserRequest" in schemas


def test_get_schema_by_name(sample_openapi_path):
    reader = OpenAPISchemaReader(sample_openapi_path)
    schema = reader.get_schema_by_name("User")
    assert schema is not None
    assert "properties" in schema
    assert "id" in schema["properties"]


def test_extract_example_from_schema(sample_openapi_path):
    reader = OpenAPISchemaReader(sample_openapi_path)
    schema = reader.get_schema_by_name("User")
    example = reader.extract_example_from_schema(schema)
    assert example is not None
    assert "id" in example
    assert "name" in example
    assert "email" in example
    assert "status" in example


def test_list_all_endpoints(sample_openapi_path):
    reader = OpenAPISchemaReader(sample_openapi_path)
    endpoints = reader.list_all_endpoints()
    assert len(endpoints) > 0
    paths = {e["path"] for e in endpoints}
    assert "/users" in paths
    assert "/users/{id}" in paths


def test_get_request_body_schema(sample_openapi_path):
    reader = OpenAPISchemaReader(sample_openapi_path)
    schema = reader.get_request_body_schema("/users", "post")
    assert schema is not None
