import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

export async function loadAgents(pool: Pool): Promise<void> {
  try {
    console.log('Loading agents from JSON files...');
    
    const agentsDir = path.join(__dirname, '..', '..', 'agents');
    if (!fs.existsSync(agentsDir)) {
      console.log('No agents directory found, skipping agent loading');
      return;
    }
    
    const agentFiles = fs.readdirSync(agentsDir).filter(file => file.endsWith('.json'));
    
    for (const file of agentFiles) {
      const agentPath = path.join(agentsDir, file);
      const agentData = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
      
      console.log(`Loading agent: ${agentData.name} (${agentData.id})`);
      
      // Insert into agents table
      const agentQuery = `
        INSERT INTO agents (
          id, name, constitution, current_location, current_activity,
          energy_level, mood, primary_goal, secondary_goals,
          personality_traits, likes, dislikes, background,
          schedule, current_plans
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          constitution = EXCLUDED.constitution,
          current_location = EXCLUDED.current_location,
          current_activity = EXCLUDED.current_activity,
          energy_level = EXCLUDED.energy_level,
          mood = EXCLUDED.mood,
          primary_goal = EXCLUDED.primary_goal,
          secondary_goals = EXCLUDED.secondary_goals,
          personality_traits = EXCLUDED.personality_traits,
          likes = EXCLUDED.likes,
          dislikes = EXCLUDED.dislikes,
          background = EXCLUDED.background,
          schedule = EXCLUDED.schedule,
          current_plans = EXCLUDED.current_plans,
          updated_at = now()
      `;
      
      await pool.query(agentQuery, [
        agentData.id,
        agentData.name,
        agentData.constitution,
        agentData.current_location,
        agentData.current_activity,
        agentData.energy_level,
        agentData.mood,
        agentData.primary_goal,
        agentData.secondary_goals,
        agentData.personality_traits,
        agentData.likes,
        agentData.dislikes,
        agentData.background,
        JSON.stringify(agentData.schedule),
        agentData.current_plans
      ]);
      
      // Insert into agent_states table
      const stateQuery = `
        INSERT INTO agent_states (
          agent_id, current_x, current_y, current_action,
          action_start_time, emotional_state, physical_state
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (agent_id) DO UPDATE SET
          current_x = EXCLUDED.current_x,
          current_y = EXCLUDED.current_y,
          current_action = EXCLUDED.current_action,
          action_start_time = EXCLUDED.action_start_time,
          emotional_state = EXCLUDED.emotional_state,
          physical_state = EXCLUDED.physical_state,
          updated_at = now()
      `;
      
      await pool.query(stateQuery, [
        agentData.id,
        agentData.current_x,
        agentData.current_y,
        agentData.current_activity,
        new Date(),
        JSON.stringify({ mood: agentData.mood }),
        JSON.stringify({ energy: agentData.energy_level })
      ]);
      
      console.log(`✅ Loaded agent: ${agentData.name}`);
    }
    
    console.log(`🎉 Successfully loaded ${agentFiles.length} agents!`);
    
  } catch (error) {
    console.error('Error loading agents:', error);
  }
} 