export const CAMELOT_WHEEL = [
    '1A', '1B',
    '2A', '2B',
    '3A', '3B',
    '4A', '4B',
    '5A', '5B',
    '6A', '6B',
    '7A', '7B',
    '8A', '8B',
    '9A', '9B',
    '10A', '10B',
    '11A', '11B',
    '12A', '12B',
];
export const CAMELOT_TO_MUSICAL = {
    '1A': 'Ab minor', '1B': 'B major',
    '2A': 'Eb minor', '2B': 'F# major',
    '3A': 'Bb minor', '3B': 'Db major',
    '4A': 'F minor', '4B': 'Ab major',
    '5A': 'C minor', '5B': 'Eb major',
    '6A': 'G minor', '6B': 'Bb major',
    '7A': 'D minor', '7B': 'F major',
    '8A': 'A minor', '8B': 'C major',
    '9A': 'E minor', '9B': 'G major',
    '10A': 'B minor', '10B': 'D major',
    '11A': 'F# minor', '11B': 'A major',
    '12A': 'Db minor', '12B': 'E major',
};
export const MUSICAL_TO_CAMELOT = Object.fromEntries(Object.entries(CAMELOT_TO_MUSICAL).map(([k, v]) => [v.toLowerCase(), k]));
export const KEY_ALIASES = {
    'g#m': 'Ab minor', 'g# minor': 'Ab minor',
    'd#m': 'Eb minor', 'd# minor': 'Eb minor',
    'a#m': 'Bb minor', 'a# minor': 'Bb minor',
    'f#m': 'F# minor', 'f# minor': 'F# minor',
    'c#m': 'Db minor', 'c# minor': 'Db minor',
    'gb': 'F# major', 'gb major': 'F# major',
    'db': 'Db major', 'db major': 'Db major',
    'ab': 'Ab major', 'ab major': 'Ab major',
    'eb': 'Eb major', 'eb major': 'Eb major',
    'bb': 'Bb major', 'bb major': 'Bb major',
    'c#': 'Db major', 'c# major': 'Db major',
};
//# sourceMappingURL=models.js.map