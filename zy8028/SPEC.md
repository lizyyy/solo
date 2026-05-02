# 急诊分诊夜班 (Emergency Triage Night Shift)

## Project Overview
- **Type**: Local browser puzzle/strategy game
- **Core Functionality**: Players triage incoming patient cards to Red/Yellow/Green/Observe queues within time limit
- **Target Users**: Casual gamers interested in medical simulation

## Game Mechanics

### Patient Card Data Structure
```json
{
  "id": "P001",
  "name": "张三",
  "age": 45,
  "gender": "M",
  "vitalSigns": {
    "hr": 90,      // heart rate
    "bp": "120/80", // blood pressure
    "spo2": 98,    // oxygen saturation
    "temp": 37.2,  // temperature °C
    "respRate": 18 // respiratory rate
  },
  "chiefComplaint": "胸痛伴大汗30分钟",
  "allergies": ["青霉素"],
  "waitTime": 5,   // minutes already waited
  "medicalHistory": ["高血压病史"]
}
```

### Triage Levels (ESI)
- **Red (1级)**: Immediate life-threatening, requires immediate doctor
- **Yellow (2级)**: Emergency, can wait 10-30 minutes
- **Green (3级)**: Non-emergency, can wait 1-2 hours
- **Observe (4级)**: Need observation, uncertain prognosis

### Scoring System
- Correct triage: +100 points base
- Combo multiplier: consecutive correct triages increase multiplier (1.0→1.5→2.0→2.5→3.0)
- Wrong triage: -50 points, combo reset
- Time pressure: faster triage = bonus points
- Edge case handling: missing info or contradictions affect scoring

### Time Limit
- Each level has 3-5 minutes depending on patient count
- Timer displayed prominently

## Module Architecture

### 1. Level Loading (`levelLoader.js`)
- Load level JSON via fetch
- Validate required fields
- Support level progression

### 2. Triage Rules Engine (`triageRules.js`)
- ESI-based triage logic
- Handle edge cases:
  - Missing information: apply conservative triage (higher priority)
  - Contradictory symptoms: use worst-case assumption
- Return: correct triage level, reasoning, penalty info

### 3. Game State Machine (`gameState.js`)
- States: MENU → PLAYING → PAUSED → LEVEL_COMPLETE → GAME_OVER
- Transitions managed by state machine
- Track: score, combo, timer, current patient, history

### 4. UI Rendering (`uiRenderer.js`)
- Patient card with drag-and-drop
- Four queue zones (Red/Yellow/Green/Observe)
- Score display, timer, combo indicator
- Pause/Undo/Restart buttons
- Level complete summary

### 5. Save/Load (`storage.js`)
- localStorage for game state
- Auto-save on pause/level complete
- Leaderboard: top 10 scores per level

### 6. Test Data (`testData.js`)
- Sample level JSON
- Unit tests for triage rules

## UI Design

### Color Scheme
- Red Queue: #DC3545
- Yellow Queue: #FFC107
- Green Queue: #28A745
- Observe Queue: #6C757D
- Background: #1A1A2E
- Card Background: #16213E
- Text: #EAEAEA

### Layout
```
+------------------------------------------+
|  SCORE: 1250   COMBO: x2.5   TIME: 2:30  |
+------------------------------------------+
|                                          |
|  +------------+  +------------+          |
|  |  PATIENT   |  |  PATIENT   |  ...    |
|  |   CARD     |  |   CARD     |          |
|  +------------+  +------------+          |
|                                          |
+------------------------------------------+
|  RED  | YELLOW | GREEN  | OBSERVE        |
|  (1级) |  (2级) |  (3级)  |  (留观)       |
+------------------------------------------+
```

## Edge Case Handling

### Missing Information
- If vital signs missing: assume worst case, assign higher triage priority
- If chief complaint vague: prompt with "信息不足，默认分配至较高优先级"

### Contradictory Symptoms
- Example: High fever but stable vitals → prioritize chief complaint severity
- Log contradiction for transparency

## Acceptance Criteria
1. Game loads and displays sample level immediately
2. Patient cards can be dragged to queues
3. Correct/incorrect feedback shown immediately
4. Combo system works correctly
5. Pause freezes game state
6. Undo reverts last triage decision
7. Level complete shows summary
8. Score persists in localStorage
9. Leaderboard displays top 10 scores
10. Handles missing info and contradictory symptoms gracefully
