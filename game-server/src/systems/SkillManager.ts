import { SkillData } from "../rooms/schema";

export interface SkillConfig {
    name: string;
    baseExperience: number;
    experienceMultiplier: number;
}

export interface SkillProgressEvent {
    skillName: string;
    experienceGained: number;
    newLevel: number;
    leveledUp: boolean;
    currentExperience: number;
    experienceToNext: number;
    progress: number; // 0-1 progress to next level
}

export class SkillManager {
    // Player skills storage (username -> skills)
    private playerSkills: Map<string, Map<string, SkillData>> = new Map();
    
    // Skill configuration
    private skillConfigs: Map<string, SkillConfig> = new Map();
    
    // Experience calculation constants
    private static readonly BASE_XP = 100;
    private static readonly XP_MULTIPLIER = 1.5;

    constructor() {
        this.initializeSkillConfigs();
    }

    private initializeSkillConfigs() {
        const skillNames = [
            'Farming', 'Fitness', 'Crafting', 'Fishing', 
            'Cooking', 'Learning', 'Trading'
        ];

        skillNames.forEach(skillName => {
            this.skillConfigs.set(skillName, {
                name: skillName,
                baseExperience: SkillManager.BASE_XP,
                experienceMultiplier: SkillManager.XP_MULTIPLIER
            });
        });
    }

    /**
     * Initialize skills for a new player
     */
    public initializePlayerSkills(username: string): Map<string, SkillData> {
        console.log(`🏆 [SKILL_MANAGER] Initializing skills for player: ${username}`);
        
        const playerSkillMap = new Map<string, SkillData>();

        this.skillConfigs.forEach((config, skillName) => {
            const skillData = new SkillData();
            skillData.name = skillName;
            skillData.level = 1;
            skillData.experience = 0;
            skillData.experienceToNext = this.calculateExperienceForLevel(2);
            
            playerSkillMap.set(skillName, skillData);
        });

        this.playerSkills.set(username, playerSkillMap);
        console.log(`🏆 [SKILL_MANAGER] Created ${playerSkillMap.size} skills for ${username}`);
        
        return playerSkillMap;
    }

    /**
     * Get all skills for a player
     */
    public getPlayerSkills(username: string): Map<string, SkillData> | null {
        return this.playerSkills.get(username) || null;
    }

    /**
     * Add experience to a player's skill
     */
    public addExperience(username: string, skillName: string, experienceAmount: number): SkillProgressEvent | null {
        const playerSkillMap = this.playerSkills.get(username);
        if (!playerSkillMap) {
            console.warn(`🏆 [SKILL_MANAGER] No skills found for player: ${username}`);
            return null;
        }

        const skill = playerSkillMap.get(skillName);
        if (!skill) {
            console.warn(`🏆 [SKILL_MANAGER] Skill ${skillName} not found for player: ${username}`);
            return null;
        }

        const oldLevel = skill.level;
        skill.experience += experienceAmount;

        // Check for level ups
        let leveledUp = false;
        while (skill.experience >= skill.experienceToNext) {
            skill.level++;
            skill.experience -= skill.experienceToNext;
            skill.experienceToNext = this.calculateExperienceForLevel(skill.level + 1);
            leveledUp = true;
        }

        // Calculate progress to next level
        const progress = this.getSkillProgress(skill);

        const progressEvent: SkillProgressEvent = {
            skillName: skillName,
            experienceGained: experienceAmount,
            newLevel: skill.level,
            leveledUp: leveledUp,
            currentExperience: skill.experience,
            experienceToNext: skill.experienceToNext,
            progress: progress
        };

        console.log(`🏆 [SKILL_MANAGER] ${username}: ${skillName} +${experienceAmount} XP (Level ${skill.level})`);
        if (leveledUp) {
            console.log(`🎉 [SKILL_MANAGER] ${username}: ${skillName} leveled up to ${skill.level}!`);
        }

        return progressEvent;
    }

    /**
     * Get total level for a player
     */
    public getTotalLevel(username: string): number {
        const playerSkillMap = this.playerSkills.get(username);
        if (!playerSkillMap) return 0;

        let totalLevel = 0;
        playerSkillMap.forEach(skill => {
            totalLevel += skill.level;
        });
        
        return totalLevel;
    }

    /**
     * Get skill progress (0-1) to next level
     */
    private getSkillProgress(skill: SkillData): number {
        const currentLevelXp = this.calculateExperienceForLevel(skill.level + 1);
        const previousLevelXp = this.calculateExperienceForLevel(skill.level);
        const neededXp = currentLevelXp - previousLevelXp;
        
        if (neededXp === 0) return 1;
        return skill.experience / neededXp;
    }

    /**
     * Calculate experience required for a given level
     */
    private calculateExperienceForLevel(level: number): number {
        if (level <= 1) return 0;
        return Math.floor(SkillManager.BASE_XP * Math.pow(SkillManager.XP_MULTIPLIER, level - 2));
    }

    /**
     * Get all available skill names
     */
    public getAvailableSkills(): string[] {
        return Array.from(this.skillConfigs.keys());
    }

    /**
     * Reset skills for a player (for testing)
     */
    public resetPlayerSkills(username: string): void {
        console.log(`🏆 [SKILL_MANAGER] Resetting skills for player: ${username}`);
        this.playerSkills.delete(username);
        this.initializePlayerSkills(username);
    }
} 