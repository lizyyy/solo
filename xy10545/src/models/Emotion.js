const db = require('../database/db');

class Emotion {
  static create({ id, conversation_id, emotion_type, confidence = null, triggered_by = null }) {
    const emotion = {
      id,
      conversation_id,
      emotion_type,
      confidence,
      triggered_by,
      detected_at: db.now()
    };
    db.prepare('emotions').run(emotion);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('emotions').get(e => e.id === id);
  }

  static findByConversation(conversation_id) {
    return db.prepare('emotions')
      .all(e => e.conversation_id === conversation_id)
      .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at));
  }

  static getHighestPriorityEmotion(conversation_id) {
    const emotions = this.findByConversation(conversation_id);
    if (emotions.length === 0) return null;
    
    const priorityOrder = ['angry', 'frustrated', 'anxious', 'confused', 'neutral', 'happy'];
    return emotions.sort((a, b) => 
      priorityOrder.indexOf(a.emotion_type) - priorityOrder.indexOf(b.emotion_type)
    )[0];
  }
}

module.exports = Emotion;
