from candle_simulator.models import Ingredient, Recipe, RecipeIngredient
from candle_simulator.parsers import parse_ingredients, parse_recipe
from candle_simulator.validators import validate_ingredient, validate_recipe
from candle_simulator.calculator import calculate_costs, calculate_load_ratio
from candle_simulator.volatilization import simulate_volatilization
from candle_simulator.risk_detector import detect_risks
from candle_simulator.reporter import generate_markdown_report, generate_html_report

__version__ = "1.0.0"
