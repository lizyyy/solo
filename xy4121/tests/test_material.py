import unittest
import math

from bend_checker.models.material import Material, MaterialLibrary


class TestMaterial(unittest.TestCase):
    
    def setUp(self):
        self.spcc_1p5 = Material(
            name="冷轧钢板",
            grade="SPCC",
            thickness=1.5,
            tensile_strength=270.0,
            k_factor=0.35,
            min_bend_radius=1.0,
            description="测试用材料"
        )
    
    def test_k_factor_for_radius_small(self):
        k = self.spcc_1p5.get_k_factor_for_radius(0.5)
        self.assertLessEqual(k, 0.33)
    
    def test_k_factor_for_radius_medium(self):
        k = self.spcc_1p5.get_k_factor_for_radius(2.0)
        self.assertLessEqual(k, 0.38)
    
    def test_k_factor_for_radius_large(self):
        k = self.spcc_1p5.get_k_factor_for_radius(5.0)
        self.assertEqual(k, self.spcc_1p5.k_factor)
    
    def test_calculate_bend_deduction_90deg(self):
        bd = self.spcc_1p5.calculate_bend_deduction(90.0, 1.5)
        
        angle_rad = math.radians(90.0)
        expected_isb = (1.5 + 1.5) * math.tan(angle_rad / 2)
        expected_nal = math.pi * (1.5 + 0.35 * 1.5) * 90 / 180
        expected_bd = 2 * expected_isb - expected_nal
        
        self.assertAlmostEqual(bd, round(expected_bd, 3), places=3)


class TestMaterialLibrary(unittest.TestCase):
    
    def test_create_default_library(self):
        library = MaterialLibrary.create_default_library()
        self.assertGreater(len(library.materials), 0)
    
    def test_get_material_existing(self):
        library = MaterialLibrary.create_default_library()
        material = library.get_material("SPCC", 1.5)
        self.assertIsNotNone(material)
        self.assertEqual(material.grade, "SPCC")
        self.assertEqual(material.thickness, 1.5)
    
    def test_get_material_non_existing(self):
        library = MaterialLibrary.create_default_library()
        material = library.get_material("NONEXIST", 99.0)
        self.assertIsNone(material)
    
    def test_get_materials_by_grade(self):
        library = MaterialLibrary.create_default_library()
        materials = library.get_materials_by_grade("SPCC")
        self.assertGreater(len(materials), 0)
        for m in materials:
            self.assertEqual(m.grade, "SPCC")
    
    def test_add_material(self):
        library = MaterialLibrary()
        material = Material(
            name="测试材料",
            grade="TEST",
            thickness=2.0,
            tensile_strength=400.0,
            k_factor=0.35,
            min_bend_radius=1.5
        )
        library.add_material(material)
        
        retrieved = library.get_material("TEST", 2.0)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.name, "测试材料")
    
    def test_get_all_grades(self):
        library = MaterialLibrary.create_default_library()
        grades = library.get_all_grades()
        self.assertIn("SPCC", grades)
        self.assertIn("SUS304", grades)
    
    def test_get_all_thicknesses(self):
        library = MaterialLibrary.create_default_library()
        thicknesses = library.get_all_thicknesses()
        self.assertIn(1.5, thicknesses)
        self.assertIn(2.0, thicknesses)


if __name__ == '__main__':
    unittest.main()
