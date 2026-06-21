import sys
sys.path.insert(0, '.')
import json
from track_prediction_patch.models import CandidateRecord
from track_prediction_patch.core import PatchWorkflow


def print_sep(title="", char="=", width=80):
    print()
    if title:
        prefix = " " + char * 2 + " " + title + " "
        suffix = char * max(0, width - len(prefix))
        print(prefix + suffix)
    else:
        print(char * width)


def print_section(title, num=None):
    print()
    print("=" * 80)
    if num is not None:
        print("  第" + str(num) + "步：" + title)
    else:
        print("  " + title)
    print("=" * 80)


def print_kv(label, value, indent=2):
    print(" " * indent + "- " + label + ": " + str(value))


def find_track_detail(track_details, track_id):
    for detail in track_details:
        if detail["track_id"] == track_id:
            return detail
    return None


verification_results = {}


def record_verification(name, passed, detail=""):
    verification_results[name] = {
        "passed": passed,
        "detail": detail,
    }
