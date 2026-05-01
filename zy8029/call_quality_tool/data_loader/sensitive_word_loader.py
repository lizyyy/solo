from typing import List


class SensitiveWordLoader:
    @staticmethod
    def load_words(file_path: str) -> List[str]:
        words = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                word = line.strip()
                if word and not word.startswith('#'):
                    words.append(word)
        return words