export const STORAGE_KEYS = {
  GAME_HISTORY: 'gate_inspection_history',
  BEST_SCORES: 'gate_inspection_best_scores',
  UNLOCKED_LEVELS: 'gate_inspection_unlocked_levels',
};

export const CONTAINER_NO_LENGTH = 11;
export const LICENSE_PLATE_LENGTH = 7;

export const SIMILAR_CHARACTERS: Record<string, string[]> = {
  '0': ['O', 'Q'],
  'O': ['0', 'Q'],
  'Q': ['0', 'O'],
  '1': ['I', 'L'],
  'I': ['1', 'L'],
  'L': ['1', 'I'],
  '2': ['Z'],
  'Z': ['2'],
  '5': ['S'],
  'S': ['5'],
  '8': ['B'],
  'B': ['8'],
};
