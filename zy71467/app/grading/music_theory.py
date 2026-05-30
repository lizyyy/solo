from typing import Dict, Tuple, Optional


NOTE_SEMITONE_MAP: Dict[str, int] = {
    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
}

SEMITONE_NOTE_MAP: Dict[int, str] = {
    0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B'
}

ACCIDENTAL_MODIFIER: Dict[str, int] = {
    'bb': -2, 'b': -1, '': 0, '#': 1, '##': 2,
    '𝄫': -2, '♭': -1, '♮': 0, '♯': 1, '𝄪': 2
}

INTERVAL_QUALITY_MAP: Dict[int, Dict[int, str]] = {
    0: {0: 'perfect'},
    1: {0: 'diminished', 1: 'minor', 2: 'major', 3: 'augmented'},
    2: {0: 'diminished', 1: 'minor', 2: 'major', 3: 'augmented'},
    3: {0: 'diminished', 1: 'minor', 2: 'major', 3: 'augmented'},
    4: {0: 'diminished', 1: 'minor', 2: 'major', 3: 'augmented'},
    5: {0: 'diminished', 1: 'perfect', 2: 'augmented'},
    6: {0: 'diminished', 1: 'perfect', 2: 'augmented'},
    7: {0: 'diminished', 1: 'perfect', 2: 'augmented'},
}

CHORD_TYPES: Dict[str, Tuple[int, ...]] = {
    'major': (4, 7),
    'minor': (3, 7),
    'diminished': (3, 6),
    'augmented': (4, 8),
    'major_seventh': (4, 7, 11),
    'minor_seventh': (3, 7, 10),
    'dominant_seventh': (4, 7, 10),
    'diminished_seventh': (3, 6, 9),
    'half_diminished_seventh': (3, 6, 10),
    'augmented_seventh': (4, 8, 10),
}

KEY_SIGNATURES: Dict[str, Dict[str, int]] = {
    'C_major': {'sharps': 0, 'flats': 0},
    'G_major': {'sharps': 1, 'flats': 0},
    'D_major': {'sharps': 2, 'flats': 0},
    'A_major': {'sharps': 3, 'flats': 0},
    'E_major': {'sharps': 4, 'flats': 0},
    'B_major': {'sharps': 5, 'flats': 0},
    'F#_major': {'sharps': 6, 'flats': 0},
    'C#_major': {'sharps': 7, 'flats': 0},
    'F_major': {'sharps': 0, 'flats': 1},
    'Bb_major': {'sharps': 0, 'flats': 2},
    'Eb_major': {'sharps': 0, 'flats': 3},
    'Ab_major': {'sharps': 0, 'flats': 4},
    'Db_major': {'sharps': 0, 'flats': 5},
    'Gb_major': {'sharps': 0, 'flats': 6},
    'Cb_major': {'sharps': 0, 'flats': 7},
    'A_minor': {'sharps': 0, 'flats': 0},
    'E_minor': {'sharps': 1, 'flats': 0},
    'B_minor': {'sharps': 2, 'flats': 0},
    'F#_minor': {'sharps': 3, 'flats': 0},
    'C#_minor': {'sharps': 4, 'flats': 0},
    'G#_minor': {'sharps': 5, 'flats': 0},
    'D#_minor': {'sharps': 6, 'flats': 0},
    'A#_minor': {'sharps': 7, 'flats': 0},
    'D_minor': {'sharps': 0, 'flats': 1},
    'G_minor': {'sharps': 0, 'flats': 2},
    'C_minor': {'sharps': 0, 'flats': 3},
    'F_minor': {'sharps': 0, 'flats': 4},
    'Bb_minor': {'sharps': 0, 'flats': 5},
    'Eb_minor': {'sharps': 0, 'flats': 6},
    'Ab_minor': {'sharps': 0, 'flats': 7},
}


def parse_note(note_str: str) -> Tuple[str, str, int]:
    note_str = note_str.strip()
    if not note_str:
        raise ValueError("音符不能为空")

    letter = note_str[0].upper()
    if letter not in NOTE_SEMITONE_MAP:
        raise ValueError(f"无效的音名: {letter}")

    accidental = note_str[1:] if len(note_str) > 1 else ''
    accidental = accidental.replace('♭', 'b').replace('♯', '#').replace('♮', '').replace('𝄫', 'bb').replace('𝄪', '##')

    if accidental and accidental not in ACCIDENTAL_MODIFIER:
        raise ValueError(f"无效的变音记号: {accidental}")

    semitone = NOTE_SEMITONE_MAP[letter] + ACCIDENTAL_MODIFIER.get(accidental, 0)
    semitone = semitone % 12

    return letter, accidental, semitone


def calculate_interval_semitones(lower_note: str, upper_note: str) -> int:
    _, _, lower_semi = parse_note(lower_note)
    _, _, upper_semi = parse_note(upper_note)
    return (upper_semi - lower_semi) % 12


def calculate_interval_number(lower_note: str, upper_note: str) -> int:
    lower_letter, _, _ = parse_note(lower_note)
    upper_letter, _, _ = parse_note(upper_note)
    letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    lower_idx = letters.index(lower_letter)
    upper_idx = letters.index(upper_letter)
    return (upper_idx - lower_idx) % 7 + 1


def is_enharmonic(note1: str, note2: str) -> bool:
    try:
        _, _, semi1 = parse_note(note1)
        _, _, semi2 = parse_note(note2)
        return semi1 == semi2 and note1 != note2
    except ValueError:
        return False


def identify_chord(notes: list) -> Optional[str]:
    if len(notes) < 3:
        return None

    semitones = []
    for note in notes:
        _, _, semi = parse_note(note)
        semitones.append(semi)

    semitones.sort()
    base_semi = semitones[0]
    intervals = tuple((s - base_semi) % 12 for s in semitones[1:])

    for chord_name, chord_intervals in CHORD_TYPES.items():
        if intervals == chord_intervals:
            return chord_name

    return None


def normalize_interval_name(number: int, semitones: int) -> str:
    simple_number = ((number - 1) % 7) + 1
    simple_semitones = semitones % 12

    perfect_intervals = {1: 0, 4: 5, 5: 7}
    major_minor_intervals = {2: 2, 3: 4, 6: 9, 7: 11}

    if simple_number in perfect_intervals:
        diff = simple_semitones - perfect_intervals[simple_number]
        if diff == 0:
            quality = '纯'
        elif diff == 1:
            quality = '增'
        elif diff == -1:
            quality = '减'
        elif diff == 2:
            quality = '倍增'
        elif diff == -2:
            quality = '倍减'
        else:
            quality = '未知'
    elif simple_number in major_minor_intervals:
        diff = simple_semitones - major_minor_intervals[simple_number]
        if diff == 0:
            quality = '大'
        elif diff == 1:
            quality = '增'
        elif diff == -1:
            quality = '小'
        elif diff == -2:
            quality = '减'
        elif diff == 2:
            quality = '倍增'
        elif diff == -3:
            quality = '倍减'
        else:
            quality = '未知'
    else:
        quality = '未知'

    octaves = (number - 1) // 7
    if octaves > 0:
        number_text = f"{octaves + 1}个八度内的"
    else:
        number_text = ""

    return f"{quality}{number_text}{simple_number}度"
