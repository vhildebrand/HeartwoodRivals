// LocationInteractionSystem.ts
export interface LocationActivity {
    name: string;
    skill: string;
    experiencePerAction: number;
    activityDuration: number; // milliseconds
    description: string;
}

export interface LocationDefinition {
    name: string;
    activities: LocationActivity[];
}

export class LocationInteractionSystem {
    private locationsData: any = null;
    private locationActivities: Map<string, LocationDefinition> = new Map();

    constructor() {
        this.setupLocationActivities();
    }

    public loadLocationsData(locationsData: any): void {
        this.locationsData = locationsData;
    }

    private setupLocationActivities(): void {
        // Agricultural locations
        this.locationActivities.set('crop_fields', {
            name: 'Crop Fields',
            activities: [
                {
                    name: 'Farm',
                    skill: 'Farming',
                    experiencePerAction: 10,
                    activityDuration: 3000,
                    description: 'Tend to the crops and improve your farming skills'
                }
            ]
        });

        this.locationActivities.set('orchard', {
            name: 'Orchard',
            activities: [
                {
                    name: 'Harvest Fruit',
                    skill: 'Farming',
                    experiencePerAction: 8,
                    activityDuration: 2500,
                    description: 'Pick fresh fruit from the trees'
                }
            ]
        });

        this.locationActivities.set('barn', {
            name: 'Barn',
            activities: [
                {
                    name: 'Tend Animals',
                    skill: 'Farming',
                    experiencePerAction: 12,
                    activityDuration: 3500,
                    description: 'Care for the livestock'
                }
            ]
        });

        // Fitness locations
        this.locationActivities.set('gym', {
            name: 'Gym',
            activities: [
                {
                    name: 'Workout',
                    skill: 'Fitness',
                    experiencePerAction: 15,
                    activityDuration: 4000,
                    description: 'Build your strength and endurance'
                }
            ]
        });

        this.locationActivities.set('rec_center', {
            name: 'Recreation Center',
            activities: [
                {
                    name: 'Exercise',
                    skill: 'Fitness',
                    experiencePerAction: 12,
                    activityDuration: 3000,
                    description: 'Stay active and healthy'
                }
            ]
        });

        this.locationActivities.set('playground', {
            name: 'Playground',
            activities: [
                {
                    name: 'Play',
                    skill: 'Fitness',
                    experiencePerAction: 8,
                    activityDuration: 2000,
                    description: 'Have fun while staying active'
                }
            ]
        });

        // Crafting locations
        this.locationActivities.set('blacksmith_shop', {
            name: 'Blacksmith Shop',
            activities: [
                {
                    name: 'Forge',
                    skill: 'Crafting',
                    experiencePerAction: 18,
                    activityDuration: 5000,
                    description: 'Work the forge and improve metalworking skills'
                }
            ]
        });

        this.locationActivities.set('woodworker_shop', {
            name: 'Woodworker Shop',
            activities: [
                {
                    name: 'Woodwork',
                    skill: 'Crafting',
                    experiencePerAction: 14,
                    activityDuration: 4000,
                    description: 'Craft with wood and improve carpentry skills'
                }
            ]
        });

        // Fishing locations
        this.locationActivities.set('fishing_dock_1', {
            name: 'Fishing Dock',
            activities: [
                {
                    name: 'Fish',
                    skill: 'Fishing',
                    experiencePerAction: 10,
                    activityDuration: 6000,
                    description: 'Cast your line and wait for the catch'
                }
            ]
        });

        this.locationActivities.set('fishing_dock_2', {
            name: 'Fishing Dock',
            activities: [
                {
                    name: 'Fish',
                    skill: 'Fishing',
                    experiencePerAction: 10,
                    activityDuration: 6000,
                    description: 'Cast your line and wait for the catch'
                }
            ]
        });

        this.locationActivities.set('fishing_dock_3', {
            name: 'Fishing Dock',
            activities: [
                {
                    name: 'Fish',
                    skill: 'Fishing',
                    experiencePerAction: 10,
                    activityDuration: 6000,
                    description: 'Cast your line and wait for the catch'
                }
            ]
        });

        this.locationActivities.set('beach', {
            name: 'Beach',
            activities: [
                {
                    name: 'Fish',
                    skill: 'Fishing',
                    experiencePerAction: 8,
                    activityDuration: 5000,
                    description: 'Fish from the shoreline'
                }
            ]
        });

        // Cooking locations
        this.locationActivities.set('bakery', {
            name: 'Bakery',
            activities: [
                {
                    name: 'Bake',
                    skill: 'Cooking',
                    experiencePerAction: 12,
                    activityDuration: 4500,
                    description: 'Learn the art of baking'
                }
            ]
        });

        this.locationActivities.set('cafe', {
            name: 'Cafe',
            activities: [
                {
                    name: 'Cook',
                    skill: 'Cooking',
                    experiencePerAction: 10,
                    activityDuration: 3500,
                    description: 'Prepare delicious meals'
                }
            ]
        });

        // Learning locations
        this.locationActivities.set('library', {
            name: 'Library',
            activities: [
                {
                    name: 'Study',
                    skill: 'Learning',
                    experiencePerAction: 12,
                    activityDuration: 4000,
                    description: 'Expand your knowledge and wisdom'
                }
            ]
        });

        this.locationActivities.set('school', {
            name: 'School',
            activities: [
                {
                    name: 'Learn',
                    skill: 'Learning',
                    experiencePerAction: 15,
                    activityDuration: 4500,
                    description: 'Attend classes and gain knowledge'
                }
            ]
        });

        // Trading locations
        this.locationActivities.set('general_store', {
            name: 'General Store',
            activities: [
                {
                    name: 'Trade',
                    skill: 'Trading',
                    experiencePerAction: 10,
                    activityDuration: 3000,
                    description: 'Practice negotiation and business skills'
                }
            ]
        });

        this.locationActivities.set('farmers_market', {
            name: 'Farmers Market',
            activities: [
                {
                    name: 'Trade',
                    skill: 'Trading',
                    experiencePerAction: 8,
                    activityDuration: 2500,
                    description: 'Learn the art of buying and selling'
                }
            ]
        });
    }

    public getPlayerLocation(playerX: number, playerY: number): string | null {
        if (!this.locationsData) {
            return null;
        }

        // Convert pixel coordinates to tile coordinates
        const tileX = Math.floor(playerX / 16);
        const tileY = Math.floor(playerY / 16);

        // Find the location that contains these coordinates
        for (const [locationKey, locationData] of Object.entries(this.locationsData)) {
            if (locationKey === 'water_areas') continue;
            
            const location = locationData as any;
            if (location.x !== undefined && location.y !== undefined && 
                location.width !== undefined && location.height !== undefined) {
                
                // Check if coordinates are within this location's bounds
                if (tileX >= location.x && tileX <= location.x + location.width &&
                    tileY >= location.y && tileY <= location.y + location.height) {
                    return locationKey;
                }
            }
        }

        return null;
    }

    public getLocationActivities(locationKey: string): LocationDefinition | null {
        return this.locationActivities.get(locationKey) || null;
    }

    public getAllSkills(): string[] {
        const skills = new Set<string>();
        for (const location of this.locationActivities.values()) {
            for (const activity of location.activities) {
                skills.add(activity.skill);
            }
        }
        return Array.from(skills);
    }
} 