import pytest
from pathlib import Path
from openapi_fuzz_checker.core.schema_reader import OpenAPISchemaReader
from openapi_fuzz_checker.core.mutator import ExampleMutator, MutationType


@pytest.fixture
def user_schema():
    openapi_path = str(Path(__file__).parent.parent / "examples" / "sample_openapi.yaml")
    reader = OpenAPISchemaReader(openapi_path)
    return reader.get_schema_by_name("User")


@pytest.fixture
def normal_example():
    return {
        "id": 1,
        "name": "张三",
        "email": "zhangsan@example.com",
        "age": 25,
        "status": "active",
        "tags": ["admin", "developer"],
        "createdAt": "2024-01-01T12:00:00Z"
    }


def test_mutator_initialization(user_schema):
    mutator = ExampleMutator(user_schema)
    assert mutator.schema == user_schema
    assert "id" in mutator.required_fields


def test_generate_mutations(user_schema, normal_example):
    mutator = ExampleMutator(user_schema)
    mutations = mutator.generate_all_mutations(normal_example)
    assert len(mutations) > 0


def test_mutation_types_covered(user_schema, normal_example):
    mutator = ExampleMutator(user_schema)
    mutations = mutator.generate_all_mutations(normal_example)
    mutation_types = {m.mutation_type for m in mutations}

    assert MutationType.NULL_VALUE in mutation_types
    assert MutationType.EMPTY_STRING in mutation_types
    assert MutationType.REMOVE_REQUIRED_FIELD in mutation_types
    assert MutationType.BOUNDARY_VALUE in mutation_types
    assert MutationType.DIRTY_DATA in mutation_types


def test_remove_required_field_mutation(user_schema, normal_example):
    mutator = ExampleMutator(user_schema)
    mutations = mutator.generate_all_mutations(normal_example)

    remove_mutations = [
        m for m in mutations
        if m.mutation_type == MutationType.REMOVE_REQUIRED_FIELD
    ]
    assert len(remove_mutations) > 0

    for mutation in remove_mutations:
        field_name = mutation.path.split(".")[-1]
        assert field_name in user_schema["required"]
        assert field_name not in mutation.mutated


def test_null_value_mutation(user_schema, normal_example):
    mutator = ExampleMutator(user_schema)
    mutations = mutator.generate_all_mutations(normal_example)

    null_mutations = [
        m for m in mutations
        if m.mutation_type == MutationType.NULL_VALUE
    ]
    assert len(null_mutations) > 0


def test_boundary_value_mutation(user_schema, normal_example):
    mutator = ExampleMutator(user_schema)
    mutations = mutator.generate_all_mutations(normal_example)

    boundary_mutations = [
        m for m in mutations
        if m.mutation_type == MutationType.BOUNDARY_VALUE
    ]
    assert len(boundary_mutations) > 0


def test_dirty_data_mutation(user_schema, normal_example):
    mutator = ExampleMutator(user_schema)
    mutations = mutator.generate_all_mutations(normal_example)

    dirty_mutations = [
        m for m in mutations
        if m.mutation_type == MutationType.DIRTY_DATA
    ]
    assert len(dirty_mutations) > 0


def test_array_reorder_mutation(user_schema, normal_example):
    mutator = ExampleMutator(user_schema)
    mutations = mutator.generate_all_mutations(normal_example)

    reorder_mutations = [
        m for m in mutations
        if m.mutation_type == MutationType.ARRAY_REORDER
    ]
    assert len(reorder_mutations) > 0


def test_mutation_preserves_other_fields(user_schema, normal_example):
    mutator = ExampleMutator(user_schema)
    mutations = mutator.generate_all_mutations(normal_example)

    for mutation in mutations:
        other_fields = set(normal_example.keys()) - {mutation.path.split(".")[-1]}
        for field in other_fields:
            if field in mutation.mutated and field in normal_example:
                if not isinstance(normal_example[field], list):
                    assert mutation.mutated.get(field) == normal_example[field]
