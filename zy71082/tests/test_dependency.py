import pytest

from gradle_dep_replace.models.dependency import DependencyCoordinate, DependencyType


class TestDependencyCoordinate:
    def test_parse_simple_coordinate(self):
        dep = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")
        assert dep.group == "com.squareup.okhttp3"
        assert dep.name == "okhttp"
        assert dep.version == "4.12.0"

    def test_parse_coordinate_without_version(self):
        dep = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp")
        assert dep.group == "com.squareup.okhttp3"
        assert dep.name == "okhttp"
        assert dep.version is None

    def test_parse_plugin_coordinate(self):
        dep = DependencyCoordinate.parse("com.android.application")
        assert dep.group is None
        assert dep.name == "com.android.application"
        assert dep.version is None

    def test_dynamic_version_detection(self):
        dep1 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.+")
        assert dep1.is_dynamic is True

        dep2 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:[4.0,5.0)")
        assert dep2.is_dynamic is True

        dep3 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")
        assert dep3.is_dynamic is False

    def test_canonical_name(self):
        dep = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")
        assert dep.canonical_name == "com.squareup.okhttp3:okhttp"

    def test_full_coordinate(self):
        dep = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")
        assert dep.full_coordinate == "com.squareup.okhttp3:okhttp:4.12.0"

    def test_equality(self):
        dep1 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")
        dep2 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")
        dep3 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.11.0")

        assert dep1 == dep2
        assert dep1 != dep3

    def test_hash(self):
        dep1 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")
        dep2 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")

        assert hash(dep1) == hash(dep2)

        dep_set = {dep1, dep2}
        assert len(dep_set) == 1

    def test_to_dict(self):
        dep = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")
        dep.type = DependencyType.LIBRARY
        dep.configuration = "implementation"

        data = dep.to_dict()
        assert data["group"] == "com.squareup.okhttp3"
        assert data["name"] == "okhttp"
        assert data["version"] == "4.12.0"
        assert data["type"] == "library"
        assert data["configuration"] == "implementation"
        assert data["canonical_name"] == "com.squareup.okhttp3:okhttp"
        assert data["full_coordinate"] == "com.squareup.okhttp3:okhttp:4.12.0"
