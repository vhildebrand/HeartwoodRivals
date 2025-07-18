# Testing the Unified Thought Processing System

## 🎯 **What's New**

The unified thought processing system allows NPCs to make **natural, holistic decisions** about information they receive. Instead of artificially separating "immediate" vs "scheduled" thoughts, NPCs now:

1. **Evaluate relevance** - Is this information important to me?
2. **Compare priorities** - Is this more important than my current task?
3. **Choose timing** - Should I act now, later, or never?
4. **Plan multiple actions** - I can do something now AND schedule something for later

---

## 🧪 **Test Cases**

### **Test 1: Natural Priority Comparison**
```bash
# Test Thomas (tavern keeper) with social opportunity
curl -X POST "http://localhost:3000/thought/process" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "thomas_tavern_keeper",
    "eventType": "social_opportunity",
    "eventData": {
      "message": "DJ Nova is performing at the stage right now and everyone is gathering to listen!"
    }
  }'
```

**Expected NPC Decision Process**:
- **Relevance**: 7/10 (Thomas likes social events)
- **Current Task Priority**: 4/10 (cleaning glasses is routine)
- **Decision**: "I can finish cleaning this glass quickly and then go enjoy the music"
- **Actions**: 
  - `scheduled_activity` with `timing: "later_today"` - go to DJ performance
  - Priority based on his personality (social vs. work-focused)

---

### **Test 2: Professional vs. Personal Conflict**
```bash
# Test Dr. Helena with competing priorities
curl -X POST "http://localhost:3000/thought/process" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "dr_helena",
    "eventType": "mixed_priorities",
    "eventData": {
      "message": "There is a medical emergency at the docks, but also your sister just arrived in town and wants to have dinner tonight."
    }
  }'
```

**Expected NPC Decision Process**:
- **Relevance**: 10/10 (both are personally important)
- **Current Task Priority**: Variable (depends on what she's doing)
- **Decision**: Professional duty vs. personal relationships
- **Actions**:
  - `immediate_activity` with `timing: "now"` - respond to medical emergency
  - `scheduled_activity` with `timing: "later_today"` - dinner with sister

---

### **Test 3: Irrelevant "Urgent" Information**
```bash
# Test Elara (blacksmith) with bakery emergency
curl -X POST "http://localhost:3000/thought/process" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "elara_blacksmith",
    "eventType": "bakery_emergency",
    "eventData": {
      "message": "URGENT: The bakery ovens are malfunctioning and Isabella needs help fixing them immediately!"
    }
  }'
```

**Expected NPC Decision Process**:
- **Relevance**: 2/10 (not her expertise)
- **Current Task Priority**: 7/10 (metalworking is important to her)
- **Decision**: "I'm not qualified to help with bakery equipment, and I have important work to finish"
- **Actions**: `none` - continue current activities

---

### **Test 4: Multiple Action Decision**
```bash
# Test Maya (teacher) with educational opportunity
curl -X POST "http://localhost:3000/thought/process" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "maya_teacher",
    "eventType": "educational_opportunity",
    "eventData": {
      "message": "There are amazing tide pools at the beach right now with unique marine life. This would be perfect for your coastal ecosystem lessons, and you could bring students tomorrow."
    }
  }'
```

**Expected NPC Decision Process**:
- **Relevance**: 9/10 (directly related to her teaching)
- **Current Task Priority**: Variable (depends on current activity)
- **Decision**: "This is perfect for my lessons! I should check it out and plan a field trip"
- **Actions**:
  - `immediate_activity` or `scheduled_activity` with `timing: "later_today"` - visit tide pools
  - `scheduled_activity` with `timing: "tomorrow"` - plan student field trip

---

### **Test 5: Time-Sensitive vs. Current Priority**
```bash
# Test William (shipwright) with urgent boat repair
curl -X POST "http://localhost:3000/thought/process" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "william_shipwright",
    "eventType": "urgent_repair",
    "eventData": {
      "message": "Captain Finn has a boat with serious hull damage that needs repair before the evening tide, or it might sink."
    }
  }'
```

**Expected NPC Decision Process**:
- **Relevance**: 10/10 (professional emergency)
- **Current Task Priority**: Variable (depends on current work)
- **Decision**: Compare urgency of current work vs. emergency
- **Actions**:
  - If current work is routine: `immediate_activity` with `timing: "now"`
  - If current work is critical: `scheduled_activity` with `timing: "later_today"`

---

## 🔍 **What to Look For**

### **✅ Realistic Decision Making**
```json
{
  "decision": "This is interesting but not urgent. I'll check it out when I finish my current task.",
  "relevance": 6,
  "current_task_priority": 8,
  "actions": [
    {
      "type": "scheduled_activity",
      "timing": "later_today",
      "details": {
        "activity": "visit_tide_pools",
        "location": "beach",
        "reason": "Educational opportunity for my lessons"
      }
    }
  ],
  "reasoning": "While this is relevant to my teaching, I'm in the middle of preparing important lesson plans. I can visit the tide pools later today when I'm done."
}
```

### **✅ Multiple Actions**
```json
{
  "actions": [
    {
      "type": "immediate_activity",
      "timing": "now",
      "details": { "activity": "emergency_response", "reason": "Medical emergency" }
    },
    {
      "type": "scheduled_activity", 
      "timing": "later_today",
      "details": { "activity": "dinner_with_sister", "reason": "Family time" }
    }
  ]
}
```

### **✅ Proper Irrelevance Handling**
```json
{
  "decision": "This doesn't concern me - I'm not qualified to help with bakery equipment.",
  "relevance": 2,
  "current_task_priority": 7,
  "actions": [
    {
      "type": "none",
      "timing": "never",
      "details": {}
    }
  ]
}
```

### **❌ Signs of Poor Calibration**
- **Everything gets high relevance** regardless of NPC's role
- **No consideration of current task priority**
- **Generic timing decisions** (everything is "now" or "later")
- **No personality-based reasoning**

---

## 🎭 **Advanced Test Scenarios**

### **Test: Personality-Based Responses**
```bash
# Test social NPC vs. introverted NPC with same social event
curl -X POST "http://localhost:3000/thought/process" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "thomas_tavern_keeper",
    "eventType": "social_event",
    "eventData": {
      "message": "There is a big community celebration at the town square with music, food, and dancing!"
    }
  }'

# Then test with introverted NPC
curl -X POST "http://localhost:3000/thought/process" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "elara_blacksmith",
    "eventType": "social_event", 
    "eventData": {
      "message": "There is a big community celebration at the town square with music, food, and dancing!"
    }
  }'
```

**Expected**: 
- **Thomas**: High relevance, likely to attend
- **Elara**: Low relevance, likely to continue working

---

## 🏆 **Benefits of the Unified System**

### **1. Natural Decision Making**
NPCs think like humans: "What is this? Is it relevant to me? When should I deal with it?"

### **2. Priority Comparison**
NPCs compare new information against their current activities, not arbitrary categories.

### **3. Flexible Timing**
NPCs can choose realistic timing: "now", "after I finish this", "later today", "when convenient".

### **4. Multiple Actions** 
NPCs can decide on multiple actions: emergency response now, follow-up later.

### **5. Personality Integration**
Decisions reflect individual personalities, not generic responses.

This unified system creates much more realistic and engaging NPC behavior!

---

## 📊 **Monitoring the System**

```bash
# Check unified thought status
curl -s "http://localhost:3000/thought/status/elara_blacksmith" | jq '.recentThoughts[] | select(.thought_type == "unified_thought")'

# Check scheduled activities
curl -s "http://localhost:3000/thought/status/elara_blacksmith" | jq '.conversationIntentions'
```

The unified system represents a major improvement in NPC cognitive realism! 