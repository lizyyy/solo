import csv
import json
from pathlib import Path
from typing import Dict, List

from freeze_gate.models import (
    CheckSeverity,
    ForbiddenRule,
    LengthBudget,
    ProjectConfig,
)


class SampleGenerator:
    def __init__(self, output_dir: Path, config: ProjectConfig):
        self.output_dir = output_dir
        self.config = config
    
    def generate_all(self):
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._generate_source_json()
        self._generate_translations_csv()
        self._generate_sample_config()
        self._generate_icu_samples()
        self._generate_bad_samples()
    
    def _generate_source_json(self) -> Path:
        data = {
            "ui": {
                "welcome": "欢迎来到 {game_name}！",
                "start": "开始游戏",
                "settings": "设置",
                "quit": "退出",
                "player_name": "玩家名称: {name}",
                "level": "第 {level_num} 关",
                "score": "得分: {score}",
                "items_count": "你有 {count, plural, =0 {没有物品} one {1个物品} other {{count}个物品}}",
                "time_remaining": "剩余时间: {time} 秒",
                "notification": "[system] 新消息",
                "dialog": "%1$s 对 %2$s 说: %3$s",
            },
            "character": {
                "hero": "英雄",
                "enemy": "敌人",
                "npc": "NPC",
                "greeting": "你好，旅行者！",
                "quest": "任务: {quest_name}",
                "reward": "奖励: {gold} 金币",
            },
            "combat": {
                "attack": "攻击",
                "defend": "防御",
                "skill": "技能",
                "damage_dealt": "造成 {damage} 点伤害",
                "heal_amount": "恢复 {amount} 点生命",
            },
            "error": {
                "connection_failed": "连接失败，请重试",
                "server_timeout": "服务器超时",
                "invalid_input": "无效输入",
            },
            "long_text": {
                "story_intro": "在遥远的东方大陆上，有一个古老的王国正在遭受黑暗势力的侵袭。勇敢的冒险者们，拿起你们的武器，踏上拯救世界的旅程吧！",
                "tutorial": "点击屏幕上的按钮来移动角色，使用技能击败敌人，收集金币购买装备，完成任务获得经验值升级。",
            },
        }
        
        file_path = self.output_dir / "source.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return file_path
    
    def _generate_translations_csv(self) -> Path:
        rows = [
            {
                "key": "ui.welcome",
                "context": "游戏启动画面标题",
                "zh-CN": "欢迎来到 {game_name}！",
                "en-US": "Welcome to {game_name}!",
                "ja-JP": "{game_name}へようこそ！",
                "ko-KR": "{game_name}에 오신 것을 환영합니다!",
            },
            {
                "key": "ui.start",
                "context": "主菜单按钮",
                "zh-CN": "开始游戏",
                "en-US": "Start Game",
                "ja-JP": "ゲームを開始",
                "ko-KR": "게임 시작",
            },
            {
                "key": "ui.settings",
                "context": "主菜单按钮",
                "zh-CN": "设置",
                "en-US": "Settings",
                "ja-JP": "設定",
                "ko-KR": "설정",
            },
            {
                "key": "ui.quit",
                "context": "主菜单按钮",
                "zh-CN": "退出",
                "en-US": "Quit",
                "ja-JP": "終了",
                "ko-KR": "종료",
            },
            {
                "key": "ui.player_name",
                "context": "玩家信息显示",
                "zh-CN": "玩家名称: {name}",
                "en-US": "Player Name: {name}",
                "ja-JP": "プレイヤー名: {name}",
                "ko-KR": "플레이어 이름: {name}",
            },
            {
                "key": "ui.level",
                "context": "关卡显示",
                "zh-CN": "第 {level_num} 关",
                "en-US": "Level {level_num}",
                "ja-JP": "第 {level_num} 関",
                "ko-KR": "{level_num} 레벨",
            },
            {
                "key": "ui.score",
                "context": "分数显示",
                "zh-CN": "得分: {score}",
                "en-US": "Score: {score}",
                "ja-JP": "スコア: {score}",
                "ko-KR": "점수: {score}",
            },
            {
                "key": "ui.items_count",
                "context": "物品数量显示 (ICU plural)",
                "zh-CN": "你有 {count, plural, =0 {没有物品} one {1个物品} other {{count}个物品}}",
                "en-US": "You have {count, plural, =0 {no items} one {1 item} other {{count} items}}",
                "ja-JP": "アイテムを {count, plural, =0 {持っていません} one {1つ持っています} other {{count}つ持っています}}",
                "ko-KR": "아이템이 {count, plural, =0 {없습니다} one {1개 있습니다} other {{count}개 있습니다}}",
            },
            {
                "key": "ui.time_remaining",
                "context": "倒计时显示",
                "zh-CN": "剩余时间: {time} 秒",
                "en-US": "Time Remaining: {time} sec",
                "ja-JP": "残り時間: {time} 秒",
                "ko-KR": "남은 시간: {time} 초",
            },
            {
                "key": "ui.notification",
                "context": "系统通知前缀",
                "zh-CN": "[system] 新消息",
                "en-US": "[system] New Message",
                "ja-JP": "[system] 新着メッセージ",
                "ko-KR": "[system] 새 메시지",
            },
            {
                "key": "ui.dialog",
                "context": "对话格式 (printf-style)",
                "zh-CN": "%1$s 对 %2$s 说: %3$s",
                "en-US": "%1$s says to %2$s: %3$s",
                "ja-JP": "%1$s が %2$s に言う: %3$s",
                "ko-KR": "%1$s가 %2$s에게 말함: %3$s",
            },
            {
                "key": "character.hero",
                "context": "角色类型",
                "zh-CN": "英雄",
                "en-US": "Hero",
                "ja-JP": "ヒーロー",
                "ko-KR": "영웅",
            },
            {
                "key": "character.enemy",
                "context": "角色类型",
                "zh-CN": "敌人",
                "en-US": "Enemy",
                "ja-JP": "敵",
                "ko-KR": "적",
            },
            {
                "key": "character.npc",
                "context": "角色类型",
                "zh-CN": "NPC",
                "en-US": "NPC",
                "ja-JP": "NPC",
                "ko-KR": "NPC",
            },
            {
                "key": "character.greeting",
                "context": "NPC对话",
                "zh-CN": "你好，旅行者！",
                "en-US": "Hello, traveler!",
                "ja-JP": "こんにちは、冒険者！",
                "ko-KR": "안녕하세요, 모험가님!",
            },
            {
                "key": "character.quest",
                "context": "任务显示",
                "zh-CN": "任务: {quest_name}",
                "en-US": "Quest: {quest_name}",
                "ja-JP": "クエスト: {quest_name}",
                "ko-KR": "퀘스트: {quest_name}",
            },
            {
                "key": "character.reward",
                "context": "奖励显示",
                "zh-CN": "奖励: {gold} 金币",
                "en-US": "Reward: {gold} gold",
                "ja-JP": "報酬: {gold} ゴールド",
                "ko-KR": "보상: {gold} 골드",
            },
            {
                "key": "combat.attack",
                "context": "战斗按钮",
                "zh-CN": "攻击",
                "en-US": "Attack",
                "ja-JP": "攻撃",
                "ko-KR": "공격",
            },
            {
                "key": "combat.defend",
                "context": "战斗按钮",
                "zh-CN": "防御",
                "en-US": "Defend",
                "ja-JP": "防御",
                "ko-KR": "방어",
            },
            {
                "key": "combat.skill",
                "context": "战斗按钮",
                "zh-CN": "技能",
                "en-US": "Skill",
                "ja-JP": "スキル",
                "ko-KR": "스킬",
            },
            {
                "key": "combat.damage_dealt",
                "context": "伤害显示",
                "zh-CN": "造成 {damage} 点伤害",
                "en-US": "Dealt {damage} damage",
                "ja-JP": "{damage} ダメージを与えた",
                "ko-KR": "{damage} 데미지 입힘",
            },
            {
                "key": "combat.heal_amount",
                "context": "治疗显示",
                "zh-CN": "恢复 {amount} 点生命",
                "en-US": "Healed {amount} HP",
                "ja-JP": "HP を {amount} 回復した",
                "ko-KR": "HP {amount} 회복",
            },
            {
                "key": "error.connection_failed",
                "context": "错误提示",
                "zh-CN": "连接失败，请重试",
                "en-US": "Connection failed, please retry",
                "ja-JP": "接続に失敗しました。再試行してください。",
                "ko-KR": "연결 실패, 다시 시도해 주세요",
            },
            {
                "key": "error.server_timeout",
                "context": "错误提示",
                "zh-CN": "服务器超时",
                "en-US": "Server timeout",
                "ja-JP": "サーバータイムアウト",
                "ko-KR": "서버 타임아웃",
            },
            {
                "key": "error.invalid_input",
                "context": "错误提示",
                "zh-CN": "无效输入",
                "en-US": "Invalid input",
                "ja-JP": "無効な入力",
                "ko-KR": "잘못된 입력",
            },
            {
                "key": "long_text.story_intro",
                "context": "故事开场",
                "zh-CN": "在遥远的东方大陆上，有一个古老的王国正在遭受黑暗势力的侵袭。勇敢的冒险者们，拿起你们的武器，踏上拯救世界的旅程吧！",
                "en-US": "In the distant Eastern Continent, an ancient kingdom is under attack by dark forces. Brave adventurers, take up your weapons and embark on a journey to save the world!",
                "ja-JP": "遥か東の大陸で、古代の王国が暗黒勢力の攻撃を受けています。勇敢な冒険者たちよ、武器を取って世界を救う旅に出ましょう！",
                "ko-KR": "먼 동양 대륙에서 고대 왕국이 어둠의 세력에게 공격받고 있습니다. 용감한 모험가들이여, 무기를 들고 세계를 구하는 여정에 떠나세요!",
            },
            {
                "key": "long_text.tutorial",
                "context": "教程文本",
                "zh-CN": "点击屏幕上的按钮来移动角色，使用技能击败敌人，收集金币购买装备，完成任务获得经验值升级。",
                "en-US": "Tap buttons on the screen to move your character, use skills to defeat enemies, collect gold to buy equipment, complete quests to gain XP and level up.",
                "ja-JP": "画面のボタンをタップしてキャラクターを移動させ、スキルを使って敵を倒し、ゴールドを集めて装備を購入し、クエストを完成させて経験値を獲得しレベルアップします。",
                "ko-KR": "화면의 버튼을 탭하여 캐릭터를 이동시키고, 스킬을 사용하여 적을 물리치고, 골드를 모아 장비를 구매하고, 퀘스트를 완료하여 경험치를 얻어 레벨업하세요.",
            },
        ]
        
        bad_translations = self._generate_bad_translation_samples()
        rows.extend(bad_translations)
        
        file_path = self.output_dir / "translations.csv"
        fieldnames = ["key", "context", "zh-CN", "en-US", "ja-JP", "ko-KR"]
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return file_path
    
    def _generate_bad_translation_samples(self) -> List[Dict]:
        return [
            {
                "key": "bad.missing_placeholder",
                "context": "测试：缺失占位符",
                "zh-CN": "你好，{player_name}！",
                "en-US": "Hello there!",
                "ja-JP": "こんにちは、{player_name}！",
                "ko-KR": "안녕하세요, {player_name}!",
            },
            {
                "key": "bad.extra_placeholder",
                "context": "测试：多余占位符",
                "zh-CN": "得分: {score}",
                "en-US": "Score: {score} - {bonus} bonus",
                "ja-JP": "スコア: {score}",
                "ko-KR": "점수: {score}",
            },
            {
                "key": "bad.wrong_placeholder",
                "context": "测试：占位符名称错误",
                "zh-CN": "关卡: {level_num}",
                "en-US": "Level: {level_number}",
                "ja-JP": "レベル: {level_num}",
                "ko-KR": "레벨: {level_num}",
            },
            {
                "key": "bad.empty_translation",
                "context": "测试：空翻译",
                "zh-CN": "这个文本应该被翻译",
                "en-US": "",
                "ja-JP": "このテキストは翻訳されるべきです",
                "ko-KR": "이 텍스트는 번역되어야 합니다",
            },
            {
                "key": "bad.icu_plural_missing",
                "context": "测试：ICU plural 缺少形式",
                "zh-CN": "你有 {count, plural, =0 {没有} one {1个} other {{count}个}}",
                "en-US": "You have {count, plural, one {1 item} other {{count} items}}",
                "ja-JP": "{count, plural, =0 {なし} one {1つ} other {{count}つ}}",
                "ko-KR": "{count, plural, =0 {없음} one {1개} other {{count}개}}",
            },
            {
                "key": "bad.icu_plural_extra",
                "context": "测试：ICU plural 多余形式",
                "zh-CN": "你有 {count, plural, one {1个} other {{count}个}}",
                "en-US": "You have {count, plural, =0 {none} one {1 item} two {2 items} other {{count} items}}",
                "ja-JP": "{count, plural, one {1つ} other {{count}つ}}",
                "ko-KR": "{count, plural, one {1개} other {{count}개}}",
            },
            {
                "key": "bad.forbidden_word_test",
                "context": "测试：禁用词检测",
                "zh-CN": "这是一个测试",
                "en-US": "This is a damn test",
                "ja-JP": "これはテストです",
                "ko-KR": "이것은 테스트입니다",
            },
            {
                "key": "bad.long_translation",
                "context": "测试：超长翻译",
                "zh-CN": "短文本",
                "en-US": "This is an extremely long translation that will definitely exceed the expected length budget and cause UI overflow issues when displayed on the screen",
                "ja-JP": "短いテキスト",
                "ko-KR": "짧은 텍스트",
            },
            {
                "key": "bad.placeholder_order",
                "context": "测试：占位符顺序",
                "zh-CN": "%1$s 击败了 %2$s",
                "en-US": "%2$s was defeated by %1$s",
                "ja-JP": "%1$s が %2$s を倒した",
                "ko-KR": "%1$s가 %2$s를 물리쳤습니다",
            },
            {
                "key": "bad.bracket_placeholder",
                "context": "测试：方括号占位符",
                "zh-CN": "获得 [item_name] x[count]",
                "en-US": "Obtained [item] x[count]",
                "ja-JP": "[item_name] x[count] を獲得",
                "ko-KR": "[item_name] x[count] 획득",
            },
        ]
    
    def _generate_sample_config(self) -> Path:
        config = {
            "name": "Sample Game Localization",
            "version": "1.0.0",
            "source_language": "zh-CN",
            "target_languages": ["en-US", "ja-JP", "ko-KR"],
            "output_directory": "./output",
            "placeholder_rules": [
                {
                    "pattern": "\\{(\\w+)\\}",
                    "description": "大括号变量占位符",
                    "example": "{player_name}",
                    "allow_any_order": False,
                    "preserve_case": True
                },
                {
                    "pattern": "\\[(\\w+)\\]",
                    "description": "方括号变量占位符",
                    "example": "[item_name]",
                    "allow_any_order": False,
                    "preserve_case": True
                },
                {
                    "pattern": "%(\\d+\\$)?[sd]",
                    "description": "printf 风格占位符",
                    "example": "%1$s",
                    "allow_any_order": True,
                    "preserve_case": True
                }
            ],
            "length_budgets": {
                "en-US": {
                    "max_length": 50,
                    "max_characters": 50,
                    "ratio_to_source": 1.3,
                    "description": "英语最大50字符，建议不超过原文的1.3倍"
                },
                "ja-JP": {
                    "max_length": 40,
                    "max_characters": 40,
                    "ratio_to_source": 1.0,
                    "description": "日语最大40字符"
                },
                "ko-KR": {
                    "max_length": 40,
                    "max_characters": 40,
                    "ratio_to_source": 1.0,
                    "description": "韩语最大40字符"
                }
            },
            "forbidden_words": [
                {
                    "word": "damn",
                    "languages": ["en-US"],
                    "severity": "WARNING",
                    "reason": "口语化表达，不适合游戏文本"
                },
                {
                    "word": "hell",
                    "languages": ["en-US"],
                    "severity": "WARNING",
                    "reason": "宗教相关词汇，可能引起不适"
                },
                {
                    "word": "fuck",
                    "languages": [],
                    "severity": "CRITICAL",
                    "reason": "脏话，绝对禁止使用"
                }
            ],
            "resource_paths": {}
        }
        
        file_path = self.output_dir / "freeze-gate.yaml"
        
        import yaml
        with open(file_path, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        
        return file_path
    
    def _generate_icu_samples(self) -> Path:
        samples = {
            "simple_plural": {
                "zh-CN": "你有 {count, plural, =0 {没有苹果} one {1个苹果} other {{count}个苹果}}",
                "en-US": "You have {count, plural, =0 {no apples} one {1 apple} other {{count} apples}}",
                "note": "标准 plural 形式，包含 =0, one, other"
            },
            "with_offset": {
                "zh-CN": "还需要 {count, plural, offset:1 =0 {最后一个} =1 {再1个} other {再#个}}",
                "en-US": "Need {count, plural, offset:1 =0 {last one} =1 {1 more} other {# more}}",
                "note": "使用 offset 的复数形式"
            },
            "select_ordinal": {
                "zh-CN": "这是你的 {num, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} 次尝试",
                "en-US": "This is your {num, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} attempt",
                "note": "序数词形式 (selectordinal)"
            },
        }
        
        file_path = self.output_dir / "icu_samples.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(samples, f, ensure_ascii=False, indent=2)
        
        return file_path
    
    def _generate_bad_samples(self) -> Path:
        bad_cases = {
            "missing_translations": {
                "description": "部分语言缺失翻译的测试用例",
                "keys": [
                    {
                        "key": "test.untranslated",
                        "zh-CN": "这个没有被翻译",
                        "en-US": "",
                        "ja-JP": "",
                        "ko-KR": "이것은 번역되지 않았습니다"
                    }
                ]
            },
            "placeholder_issues": {
                "description": "占位符相关问题的测试用例",
                "keys": [
                    {
                        "key": "test.missing_var",
                        "zh-CN": "欢迎 {user_name}",
                        "en-US": "Welcome guest",
                        "ja-JP": "{user_name} へようこそ",
                        "ko-KR": "{user_name}님 환영합니다"
                    },
                    {
                        "key": "test.extra_var",
                        "zh-CN": "得分: {score}",
                        "en-US": "Score: {score} (Bonus: {bonus})",
                        "ja-JP": "スコア: {score}",
                        "ko-KR": "점수: {score}"
                    }
                ]
            },
            "length_issues": {
                "description": "长度超出预算的测试用例",
                "keys": [
                    {
                        "key": "test.ui_button",
                        "zh-CN": "确认",
                        "en-US": "This is a very long button text that will definitely overflow",
                        "ja-JP": "確認",
                        "ko-KR": "확인"
                    }
                ]
            },
        }
        
        file_path = self.output_dir / "bad_cases.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(bad_cases, f, ensure_ascii=False, indent=2)
        
        return file_path
