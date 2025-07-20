// SkillSystem.ts
export interface SkillData {
    name: string;
    level: number;
    experience: number;
    experienceToNext: number;
    totalExperienceForLevel: number;
}

export interface SkillProgressEvent {
    skillName: string;
    experienceGained: number;
    newLevel: number;
    leveledUp: boolean;
    currentExperience: number;
    experienceToNext: number;
}

export class SkillSystem {
    private skills: Map<string, SkillData> = new Map();
    private progressCallbacks: Array<(event: SkillProgressEvent) => void> = [];
    
    // Experience required for each level (exponential growth)
    private static readonly BASE_XP = 100;
    private static readonly XP_MULTIPLIER = 1.5;

    constructor(skillNames: string[]) {
        console.log(`🏆 [SKILL_SYSTEM] Initializing with skills:`, skillNames);
        // Initialize all skills at level 1 with 0 experience
        for (const skillName of skillNames) {
            this.skills.set(skillName, {
                name: skillName,
                level: 1,
                experience: 0,
                experienceToNext: this.calculateExperienceForLevel(2),
                totalExperienceForLevel: 0
            });
            console.log(`🏆 [SKILL_SYSTEM] Created skill: ${skillName}`);
        }
        console.log(`🏆 [SKILL_SYSTEM] Total skills created: ${this.skills.size}`);
    }

    public addExperience(skillName: string, amount: number): SkillProgressEvent | null {
        const skill = this.skills.get(skillName);
        if (!skill) {
            console.warn(`Skill ${skillName} not found`);
            return null;
        }

        const oldLevel = skill.level;
        skill.experience += amount;

        // Check for level ups
        let leveledUp = false;
        while (skill.experience >= skill.totalExperienceForLevel + skill.experienceToNext) {
            skill.level++;
            skill.experience -= skill.experienceToNext;
            skill.totalExperienceForLevel += skill.experienceToNext;
            skill.experienceToNext = this.calculateExperienceForLevel(skill.level + 1);
            leveledUp = true;
        }

        // Update experience to next level
        skill.experienceToNext = this.calculateExperienceForLevel(skill.level + 1) - skill.experience;

        const progressEvent: SkillProgressEvent = {
            skillName: skillName,
            experienceGained: amount,
            newLevel: skill.level,
            leveledUp: leveledUp,
            currentExperience: skill.experience,
            experienceToNext: skill.experienceToNext
        };

        // Notify callbacks
        this.progressCallbacks.forEach(callback => callback(progressEvent));

        return progressEvent;
    }

    public getSkill(skillName: string): SkillData | null {
        return this.skills.get(skillName) || null;
    }

    public getAllSkills(): Map<string, SkillData> {
        return new Map(this.skills);
    }

    public getTotalLevel(): number {
        let total = 0;
        for (const skill of this.skills.values()) {
            total += skill.level;
        }
        return total;
    }

    public getSkillNames(): string[] {
        return Array.from(this.skills.keys());
    }

    public onProgress(callback: (event: SkillProgressEvent) => void): void {
        this.progressCallbacks.push(callback);
    }

    public removeProgressCallback(callback: (event: SkillProgressEvent) => void): void {
        const index = this.progressCallbacks.indexOf(callback);
        if (index > -1) {
            this.progressCallbacks.splice(index, 1);
        }
    }

    private calculateExperienceForLevel(level: number): number {
        if (level <= 1) return 0;
        return Math.floor(SkillSystem.BASE_XP * Math.pow(SkillSystem.XP_MULTIPLIER, level - 2));
    }

    // Get the progress percentage for a skill (0-1)
    public getSkillProgress(skillName: string): number {
        const skill = this.skills.get(skillName);
        if (!skill) return 0;

        const currentLevelXp = this.calculateExperienceForLevel(skill.level + 1);
        const previousLevelXp = this.calculateExperienceForLevel(skill.level);
        const neededXp = currentLevelXp - previousLevelXp;
        
        if (neededXp === 0) return 1;
        return skill.experience / neededXp;
    }

    // Debug method to get skill info as string
    public getSkillDisplayInfo(skillName: string): string {
        const skill = this.skills.get(skillName);
        if (!skill) return `${skillName}: Not found`;

        const progress = Math.floor(this.getSkillProgress(skillName) * 100);
        return `${skillName}: Level ${skill.level} (${progress}% to next)`;
    }

    // Reset all skills (for testing or new sessions)
    public resetAllSkills(): void {
        for (const skill of this.skills.values()) {
            skill.level = 1;
            skill.experience = 0;
            skill.experienceToNext = this.calculateExperienceForLevel(2);
            skill.totalExperienceForLevel = 0;
        }
    }
} 