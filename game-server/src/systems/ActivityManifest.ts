/**
 * Activity Manifest System
 * Defines the properties and behavior of all possible activities
 * Maps text activity descriptions to concrete action specifications
 */

import { WorldLocationRegistry } from './WorldLocationRegistry';

export enum ActivityType {
  STATIONARY = 'STATIONARY',           // Move to location, then perform action in place
  ROUTINE_MOVEMENT = 'ROUTINE_MOVEMENT', // Follow a movement pattern
  GOTO_LOCATION = 'GOTO_LOCATION',     // Simple one-off movement
  SOCIAL_INTERACTION = 'SOCIAL_INTERACTION', // Interact with other agents
  CRAFTING = 'CRAFTING',               // Work-related activities with specific tools
  EXPLORATION = 'EXPLORATION',         // Wandering/exploring activities
  MAINTENANCE = 'MAINTENANCE',         // Equipment/facility maintenance
  OBSERVATION = 'OBSERVATION',         // Watching/monitoring activities
  ADMINISTRATION = 'ADMINISTRATION'     // Paperwork/administrative tasks
}

export enum MovementPattern {
  PATROL = 'PATROL',         // Follow a specific path repeatedly
  WANDER = 'WANDER',         // Random movement within an area
  PACE = 'PACE',             // Back and forth movement
  CIRCLE = 'CIRCLE',         // Circular movement pattern
  STATIC = 'STATIC',         // No movement
  LAPS = 'LAPS',             // Running/walking laps around an area
  ZIGZAG = 'ZIGZAG',         // Zigzag pattern for thorough coverage
  PERIMETER = 'PERIMETER'    // Follow the perimeter of an area
}

export enum Duration {
  SCHEDULED = 'SCHEDULED',           // Duration determined by schedule
  UNTIL_ARRIVAL = 'UNTIL_ARRIVAL',  // Until agent reaches destination
  UNTIL_INTERRUPTED = 'UNTIL_INTERRUPTED' // Until interrupted by higher priority
}

export interface ActivityParameters {
  description?: string;        // Custom display text
  location?: string;          // Specific location ID
  locationTags?: string[];    // Alternative location tags
  movementPattern?: MovementPattern; // For movement activities
  workType?: string;          // Type of work (smithing, baking, etc.)
  mealType?: string;          // Type of meal (breakfast, lunch, dinner)
  exerciseType?: string;      // Type of exercise (run, walk, training)
  socialType?: string;        // Type of social interaction
  patrolRoute?: string;       // Specific patrol route
  emergencyType?: string;     // Type of emergency response
  specificLocation?: string; // For activities that require a very specific location
  [key: string]: any;         // Additional parameters
}

export interface ActivityManifestEntry {
  activityType: ActivityType;
  locationTags?: string[];           // Default tags to find appropriate locations
  targetLocationId?: string;         // Default specific location ID
  movementPattern?: MovementPattern; // Default movement pattern
  animation?: string;                // Animation key to play
  duration: Duration | string;       // How long the activity lasts
  priority?: number;                 // 1-10 scale, higher = more important
  interruptible?: boolean;           // Can this activity be interrupted?
  requiredEnergy?: number;           // Energy cost (1-100)
  moodImpact?: { [mood: string]: number }; // How this affects agent mood
  stateTransitions?: string[];       // What states this activity can transition to
  description?: string;              // Default human-readable description
  acceptsParameters?: boolean;       // Whether this activity accepts parameters
  requiredParameters?: string[];     // Required parameter names
}

export class ActivityManifest {
  private static instance: ActivityManifest;
  private activities: Map<string, ActivityManifestEntry> = new Map();
  private aliases: Map<string, string> = new Map(); // Maps old activity names to new ones

  private constructor() {
    this.loadActivities();
    this.loadAliases();
  }

  public static getInstance(): ActivityManifest {
    if (!ActivityManifest.instance) {
      ActivityManifest.instance = new ActivityManifest();
    }
    return ActivityManifest.instance;
  }

  /**
   * Load consolidated activity definitions
   */
  private loadActivities(): void {
    // === CORE EATING ACTIVITY ===
    this.addActivity('eat', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['food', 'eating'],
      duration: Duration.SCHEDULED,
      priority: 8,
      description: 'Eating a meal',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE WORK ACTIVITY ===
    this.addActivity('work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['work', 'business'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Working',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE SLEEP ACTIVITY ===
    this.addActivity('sleep', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['home', 'rest'],
      duration: Duration.SCHEDULED,
      priority: 9,
      description: 'Sleeping',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE EXERCISE ACTIVITY ===
    this.addActivity('exercise', {
      activityType: ActivityType.ROUTINE_MOVEMENT,
      movementPattern: MovementPattern.LAPS,
      locationTags: ['outdoor', 'fitness'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Exercising',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE TRAVEL ACTIVITY ===
    this.addActivity('travel', {
      activityType: ActivityType.GOTO_LOCATION,
      duration: Duration.UNTIL_ARRIVAL,
      priority: 5,
      description: 'Traveling to destination',
      acceptsParameters: true,
      requiredParameters: ['location']
    });

    // === CORE SOCIAL ACTIVITY ===
    this.addActivity('socialize', {
      activityType: ActivityType.SOCIAL_INTERACTION,
      locationTags: ['social', 'meeting'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Socializing',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE MAINTENANCE ACTIVITY ===
    this.addActivity('maintain', {
      activityType: ActivityType.MAINTENANCE,
      locationTags: ['work', 'equipment'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Performing maintenance',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE OBSERVATION ACTIVITY ===
    this.addActivity('observe', {
      activityType: ActivityType.OBSERVATION,
      locationTags: ['watchtower', 'lighthouse'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Observing surroundings',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE STUDY ACTIVITY ===
    this.addActivity('study', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['library', 'quiet'],
      duration: Duration.SCHEDULED,
      priority: 4,
      description: 'Studying or reading',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE WORSHIP ACTIVITY ===
    this.addActivity('worship', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['church', 'spiritual'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Worshipping or praying',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE PATROL ACTIVITY ===
    this.addActivity('patrol', {
      activityType: ActivityType.ROUTINE_MOVEMENT,
      movementPattern: MovementPattern.PATROL,
      locationTags: ['public', 'security'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Patrolling area',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE EMERGENCY ACTIVITY ===
    this.addActivity('emergency', {
      activityType: ActivityType.GOTO_LOCATION,
      duration: Duration.UNTIL_INTERRUPTED,
      priority: 10,
      interruptible: false,
      description: 'Emergency response',
      acceptsParameters: true,
      requiredParameters: ['location', 'emergencyType']
    });

    // === CORE REST ACTIVITY ===
    this.addActivity('rest', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['home', 'rest'],
      duration: Duration.SCHEDULED,
      priority: 4,
      description: 'Resting',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE ADMINISTRATION ACTIVITY ===
    this.addActivity('admin', {
      activityType: ActivityType.ADMINISTRATION,
      locationTags: ['office', 'business'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Administrative tasks',
      acceptsParameters: true,
      requiredParameters: []
    });

    // === CORE PERSONAL ACTIVITY ===
    this.addActivity('personal', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['home', 'private'],
      duration: Duration.SCHEDULED,
      priority: 3,
      description: 'Personal activities',
      acceptsParameters: true,
      requiredParameters: []
    });

    console.log(`🎭 [ACTIVITY MANIFEST] Loaded ${this.activities.size} consolidated activities`);
  }

  /**
   * Load aliases to map old activity names to new consolidated ones
   */
  private loadAliases(): void {
    // Eating aliases
    this.aliases.set('breakfast', 'eat');
    this.aliases.set('lunch', 'eat');
    this.aliases.set('dinner', 'eat');
    this.aliases.set('lunch_at_tavern', 'eat');
    this.aliases.set('dinner_at_tavern', 'eat');

    // Work aliases
    this.aliases.set('smithing', 'work');
    this.aliases.set('baking', 'work');
    this.aliases.set('woodworking', 'work');
    this.aliases.set('sewing', 'work');
    this.aliases.set('teaching', 'work');
    this.aliases.set('medical_work', 'work');
    this.aliases.set('library_work', 'work');
    this.aliases.set('farming', 'work');
    this.aliases.set('farm_work', 'work');
    this.aliases.set('gardening', 'work');
    this.aliases.set('fishing', 'work');
    this.aliases.set('dj_work', 'work');
    this.aliases.set('lighthouse_keeping', 'work');
    this.aliases.set('boat_work', 'work');
    this.aliases.set('apothecary_work', 'work');
    this.aliases.set('tavern_work', 'work');
    this.aliases.set('store_work', 'work');
    this.aliases.set('crafting', 'work');
    this.aliases.set('business', 'work');
    this.aliases.set('sailing', 'work');
    this.aliases.set('legal_work', 'work');
    this.aliases.set('general_work', 'work');
    this.aliases.set('music_work', 'work');

    // Exercise aliases
    this.aliases.set('morning_walk', 'exercise');
    this.aliases.set('sunrise_beach_run', 'exercise');
    this.aliases.set('beach_walk', 'exercise');
    this.aliases.set('evening_stroll', 'exercise');
    this.aliases.set('training', 'exercise');
    this.aliases.set('fire_training', 'exercise');
    this.aliases.set('maritime_training', 'exercise');
    this.aliases.set('crew_training', 'exercise');

    // Travel aliases
    this.aliases.set('walk_to_harbor', 'travel');
    this.aliases.set('go_to_town_square', 'travel');
    this.aliases.set('delivery', 'travel');
    this.aliases.set('visit_store', 'travel');
    this.aliases.set('visit', 'travel');

    // Social aliases
    this.aliases.set('socializing', 'socialize');
    this.aliases.set('community_meeting', 'socialize');
    this.aliases.set('meeting', 'socialize');
    this.aliases.set('meetings', 'socialize');
    this.aliases.set('consultation', 'socialize');
    this.aliases.set('collaboration', 'socialize');
    this.aliases.set('counseling', 'socialize');
    this.aliases.set('social', 'socialize');
    this.aliases.set('performance', 'socialize');

    // Maintenance aliases
    this.aliases.set('equipment_maintenance', 'maintain');
    this.aliases.set('forge_maintenance', 'maintain');
    this.aliases.set('tool_maintenance', 'maintain');
    this.aliases.set('shop_cleaning', 'maintain');
    this.aliases.set('equipment_check', 'maintain');
    this.aliases.set('organize', 'maintain');

    // Observation aliases
    this.aliases.set('weather_observation', 'observe');
    this.aliases.set('sea_monitoring', 'observe');
    this.aliases.set('watch_duty', 'observe');

    // Study aliases
    this.aliases.set('reading', 'study');
    this.aliases.set('research', 'study');
    this.aliases.set('music_practice', 'study');

    // Worship aliases
    this.aliases.set('morning_prayers', 'worship');
    this.aliases.set('morning_meditation', 'worship');
    this.aliases.set('religious_service', 'worship');

    // Patrol aliases
    this.aliases.set('town_patrol', 'patrol');
    this.aliases.set('harbor_patrol', 'patrol');
    this.aliases.set('fire_safety_inspection', 'patrol');

    // Emergency aliases
    this.aliases.set('emergency_response', 'emergency');
    this.aliases.set('fire_response', 'emergency');
    this.aliases.set('police_response', 'emergency');

    // Rest aliases
    this.aliases.set('wake_up', 'rest');
    this.aliases.set('prepare_for_bed', 'rest');
    this.aliases.set('personal_time', 'personal');
    this.aliases.set('relaxation', 'rest');
    this.aliases.set('break', 'rest');

    // Administration aliases
    this.aliases.set('administration', 'admin');
    this.aliases.set('planning', 'admin');
    this.aliases.set('review', 'admin');
    this.aliases.set('check', 'admin');
    this.aliases.set('prepare', 'admin');
    this.aliases.set('documentation', 'admin');

    // Entertainment aliases
    this.aliases.set('entertainment', 'socialize');

    console.log(`🔄 [ACTIVITY MANIFEST] Loaded ${this.aliases.size} activity aliases`);
  }

  /**
   * Add an activity to the manifest
   */
  private addActivity(key: string, entry: ActivityManifestEntry): void {
    this.activities.set(key, entry);
  }

  /**
   * Get activity definition by name, checking aliases first
   */
  public getActivity(activityName: string): ActivityManifestEntry | null {
    const originalName = activityName.trim();
    const normalizedName = this.normalizeActivityName(activityName);
    
    // Check direct match first
    if (this.activities.has(originalName)) {
      return this.activities.get(originalName)!;
    }
    
    // Check aliases
    if (this.aliases.has(originalName)) {
      const aliasTarget = this.aliases.get(originalName)!;
      return this.activities.get(aliasTarget)!;
    }
    
    if (this.aliases.has(normalizedName)) {
      const aliasTarget = this.aliases.get(normalizedName)!;
      return this.activities.get(aliasTarget)!;
    }
    
    // Check direct match with normalized name
    if (this.activities.has(normalizedName)) {
      return this.activities.get(normalizedName)!;
    }
    
    // Try fuzzy matching as last resort
    const fuzzyMatch = this.findFuzzyMatch(normalizedName);
    if (fuzzyMatch) {
      return this.activities.get(fuzzyMatch)!;
    }
    
    return null;
  }

  /**
   * Resolve activity name through aliases
   */
  public resolveActivityName(activityName: string): string {
    const originalName = activityName.trim();
    const normalizedName = this.normalizeActivityName(activityName);
    
    // Check direct match first
    if (this.activities.has(originalName)) {
      return originalName;
    }
    
    // Check aliases
    if (this.aliases.has(originalName)) {
      return this.aliases.get(originalName)!;
    }
    
    if (this.aliases.has(normalizedName)) {
      return this.aliases.get(normalizedName)!;
    }
    
    // Check direct match with normalized name
    if (this.activities.has(normalizedName)) {
      return normalizedName;
    }
    
    // Try fuzzy matching as last resort
    const fuzzyMatch = this.findFuzzyMatch(normalizedName);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }
    
    return originalName; // Return original if no match found
  }

  /**
   * Create activity parameters from legacy activity name
   */
  public createParametersFromLegacyName(originalName: string, resolvedName: string): ActivityParameters {
    const parameters: ActivityParameters = {};
    
    // Extract parameters based on original name patterns
    const lowerOriginal = originalName.toLowerCase();
    
    // Meal type extraction
    if (lowerOriginal.includes('breakfast')) {
      parameters.mealType = 'breakfast';
      parameters.description = 'Having breakfast';
    } else if (lowerOriginal.includes('lunch')) {
      parameters.mealType = 'lunch';
      parameters.description = 'Having lunch';
    } else if (lowerOriginal.includes('dinner')) {
      parameters.mealType = 'dinner';
      parameters.description = 'Having dinner';
    }
    
    // Location extraction
    if (lowerOriginal.includes('tavern')) {
      parameters.locationTags = ['tavern', 'food'];
      parameters.description = parameters.description ? parameters.description + ' at the tavern' : 'At the tavern';
    } else if (lowerOriginal.includes('beach')) {
      parameters.locationTags = ['beach', 'outdoor'];
      parameters.description = parameters.description ? parameters.description + ' at the beach' : 'At the beach';
    } else if (lowerOriginal.includes('harbor')) {
      parameters.locationTags = ['harbor', 'maritime'];
      parameters.description = parameters.description ? parameters.description + ' at the harbor' : 'At the harbor';
    }
    
    // Exercise type extraction
    if (lowerOriginal.includes('run')) {
      parameters.exerciseType = 'run';
      parameters.movementPattern = MovementPattern.LAPS;
      parameters.description = 'Going for a run';
    } else if (lowerOriginal.includes('walk')) {
      parameters.exerciseType = 'walk';
      parameters.movementPattern = MovementPattern.WANDER;
      parameters.description = 'Going for a walk';
    } else if (lowerOriginal.includes('stroll')) {
      parameters.exerciseType = 'stroll';
      parameters.movementPattern = MovementPattern.WANDER;
      parameters.description = 'Going for a stroll';
    }
    
    // Work type extraction
    if (lowerOriginal.includes('smithing') || lowerOriginal.includes('forge')) {
      parameters.workType = 'smithing';
      parameters.locationTags = ['forge', 'blacksmith'];
      parameters.description = 'Working at the forge';
    } else if (lowerOriginal.includes('baking') || lowerOriginal.includes('bakery')) {
      parameters.workType = 'baking';
      parameters.locationTags = ['bakery', 'cooking'];
      parameters.description = 'Baking bread and pastries';
    } else if (lowerOriginal.includes('teaching') || lowerOriginal.includes('school')) {
      parameters.workType = 'teaching';
      parameters.locationTags = ['school', 'education'];
      parameters.description = 'Teaching students';
    } else if (lowerOriginal.includes('medical') || lowerOriginal.includes('hospital')) {
      parameters.workType = 'medical';
      parameters.locationTags = ['hospital', 'medical'];
      parameters.description = 'Providing medical care';
    }
    
    // Time-based descriptions
    if (lowerOriginal.includes('morning')) {
      parameters.description = parameters.description ? 'Morning ' + parameters.description.toLowerCase() : 'Morning activities';
    } else if (lowerOriginal.includes('evening')) {
      parameters.description = parameters.description ? 'Evening ' + parameters.description.toLowerCase() : 'Evening activities';
    } else if (lowerOriginal.includes('sunrise')) {
      parameters.description = parameters.description ? 'Sunrise ' + parameters.description.toLowerCase() : 'Sunrise activities';
    }
    
    return parameters;
  }

  /**
   * Extract specific location from schedule description
   * This provides much more precise location constraints than generic tags
   */
  public extractLocationFromDescription(description: string): ActivityParameters {
    const parameters: ActivityParameters = {};
    const lowerDesc = description.toLowerCase();
    
    // Location keyword mappings to specific location IDs
    const locationKeywords: { [key: string]: string } = {
      // Specific buildings/locations
      'gym': 'gym',
      'bakery': 'bakery',
      'lighthouse': 'lighthouse',
      'forge': 'blacksmith_shop',
      'blacksmith': 'blacksmith_shop',
      'tavern': 'tavern',
      'hospital': 'hospital',
      'school': 'school',
      'library': 'library',
      'church': 'church',
      'town hall': 'town_hall',
      'dock': 'fishing_dock',
      'shipyard': 'shipyard',
      'farm': 'farm',
      'lighthouse keeper': 'lighthouse',
      'apothecary': 'apothecary',
      'tailor': 'tailor_shop',
      'woodworker': 'woodworker_shop',
      'merchant': 'merchant_stand',
      
      // Areas
      'beach': 'beach',
      'harbor': 'harbor',
      'town square': 'town_square',
      'market': 'market',
      'park': 'park',
      'forest': 'forest',
      'coastline': 'coastline',
      'pier': 'pier',
      
      // Equipment/activity specific
      'ovens': 'bakery',
      'anvil': 'blacksmith_shop',
      'altar': 'church',
      'books': 'library',
      'patients': 'hospital',
      'students': 'school',
      'stage': 'performance_stage',
      'training': 'gym',
      'workout': 'gym',
      'fitness': 'gym',
      
      // Activity-specific mappings
      'bread': 'bakery',
      'baking': 'bakery',
      'pastries': 'bakery',
      'laboratory': 'hospital',
      'experiments': 'hospital',
      'patient': 'hospital',
      'rounds': 'hospital',
      'care': 'hospital',
      'watch': 'lighthouse',
      'shipping': 'shipyard',
      'boats': 'shipyard',
      'vessels': 'shipyard',
      'prayer': 'church',
      'prayers': 'church',
      'service': 'church',
      'worship': 'church',
      'sermon': 'church'
    };
    
    // Multi-word location phrases (check these first)
    const multiWordPhrases = [
      'town hall',
      'town square',
      'fishing dock',
      'lighthouse keeper',
      'tailor shop',
      'woodworker shop',
      'merchant stand',
      'performance stage',
      'blacksmith shop'
    ];
    
    // Check for multi-word phrases first
    for (const phrase of multiWordPhrases) {
      if (lowerDesc.includes(phrase)) {
        const locationId = locationKeywords[phrase];
        if (locationId) {
          parameters.specificLocation = locationId;
          parameters.description = description; // Keep original description
          break;
        }
      }
    }
    
    // If no multi-word phrase found, check single words
    if (!parameters.specificLocation) {
      for (const [keyword, locationId] of Object.entries(locationKeywords)) {
        if (lowerDesc.includes(keyword)) {
          if (locationId) {
            parameters.specificLocation = locationId;
            parameters.description = description; // Keep original description
            break;
          }
        }
      }
    }
    
    // Special context-based location detection
    if (!parameters.specificLocation) {
      // Equipment maintenance could be location-specific based on context
      if (lowerDesc.includes('equipment')) {
        if (lowerDesc.includes('gym')) {
          parameters.specificLocation = 'gym';
        } else if (lowerDesc.includes('ship') || lowerDesc.includes('boat')) {
          parameters.specificLocation = 'shipyard';
        } else if (lowerDesc.includes('forge')) {
          parameters.specificLocation = 'blacksmith_shop';
        } else if (lowerDesc.includes('lighthouse')) {
          parameters.specificLocation = 'lighthouse';
        }
      }
      
      // Serving/opening/closing patterns
      if (lowerDesc.includes('open') || lowerDesc.includes('serve') || lowerDesc.includes('close')) {
        if (lowerDesc.includes('bakery')) {
          parameters.specificLocation = 'bakery';
        } else if (lowerDesc.includes('gym')) {
          parameters.specificLocation = 'gym';
        } else if (lowerDesc.includes('tavern')) {
          parameters.specificLocation = 'tavern';
        } else if (lowerDesc.includes('shop')) {
          // Try to determine which shop
          if (lowerDesc.includes('tailor')) {
            parameters.specificLocation = 'tailor_shop';
          } else if (lowerDesc.includes('blacksmith')) {
            parameters.specificLocation = 'blacksmith_shop';
          } else if (lowerDesc.includes('woodworker')) {
            parameters.specificLocation = 'woodworker_shop';
          }
        }
      }
      
      // Work preparation patterns
      if (lowerDesc.includes('prepare') || lowerDesc.includes('setup') || lowerDesc.includes('set up')) {
        if (lowerDesc.includes('lighthouse')) {
          parameters.specificLocation = 'lighthouse';
        } else if (lowerDesc.includes('gym')) {
          parameters.specificLocation = 'gym';
        } else if (lowerDesc.includes('forge')) {
          parameters.specificLocation = 'blacksmith_shop';
        } else if (lowerDesc.includes('ovens')) {
          parameters.specificLocation = 'bakery';
        }
      }
    }
    
    // Add fallback location tags if no specific location found
    if (!parameters.specificLocation) {
      // Work-related fallbacks
      if (lowerDesc.includes('maintenance') || lowerDesc.includes('repair') || lowerDesc.includes('clean')) {
        parameters.locationTags = ['work', 'maintenance'];
      } else if (lowerDesc.includes('serve') || lowerDesc.includes('customer')) {
        parameters.locationTags = ['business', 'service'];
      } else if (lowerDesc.includes('prepare') || lowerDesc.includes('setup')) {
        parameters.locationTags = ['work', 'preparation'];
      }
    }
    
    return parameters;
  }

  /**
   * Normalize activity name for lookup
   */
  private normalizeActivityName(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
  }

  /**
   * Find fuzzy matches for activity names
   */
  private findFuzzyMatch(normalizedName: string): string | null {
    const words = normalizedName.split('_');
    
    // Only use fuzzy matching for single meaningful words to avoid incorrect matches
    if (words.length > 3) {
      return null; // Too complex for fuzzy matching
    }
    
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    for (const [activityKey, _] of this.activities) {
      const activityWords = activityKey.split('_');
      
      // Calculate match score based on word overlap
      let matchScore = 0;
      let totalWords = Math.max(words.length, activityWords.length);
      
      for (const word of words) {
        if (word.length < 3) continue; // Skip very short words
        
        for (const actWord of activityWords) {
          if (actWord.includes(word) || word.includes(actWord)) {
            matchScore += 1;
          }
        }
      }
      
      // Only consider it a match if at least 50% of words match
      const scoreRatio = matchScore / totalWords;
      if (scoreRatio > 0.5 && matchScore > bestScore) {
        bestScore = matchScore;
        bestMatch = activityKey;
      }
    }
    
    // Only return if we have a strong match
    return bestScore >= 2 ? bestMatch : null;
  }

  /**
   * Get all activities of a specific type
   */
  public getActivitiesByType(type: ActivityType): Map<string, ActivityManifestEntry> {
    const result = new Map<string, ActivityManifestEntry>();
    
    for (const [key, activity] of this.activities) {
      if (activity.activityType === type) {
        result.set(key, activity);
      }
    }
    
    return result;
  }

  /**
   * Get activities that can be performed at a specific location
   */
  public getActivitiesForLocation(locationId: string): string[] {
    const locationRegistry = WorldLocationRegistry.getInstance();
    const location = locationRegistry.getLocation(locationId);
    
    if (!location) {
      return [];
    }
    
    const compatibleActivities: string[] = [];
    
    for (const [activityKey, activity] of this.activities) {
      // Check if activity can be performed at this location
      if (activity.targetLocationId === locationId) {
        compatibleActivities.push(activityKey);
      } else if (activity.locationTags) {
        // Check if location tags match activity requirements
        const hasMatchingTag = activity.locationTags.some(tag => 
          location.tags.includes(tag)
        );
        if (hasMatchingTag) {
          compatibleActivities.push(activityKey);
        }
      }
    }
    
    return compatibleActivities;
  }

  /**
   * Convert duration to milliseconds (for backward compatibility)
   */
  public getDurationInMs(duration: Duration | string): number {
    // All durations are now determined by schedule, so return -1 to indicate this
    return -1;
  }

  /**
   * Debug: Print all activities and aliases
   */
  public debugPrintActivities(): void {
    console.log('\n🎭 [ACTIVITY MANIFEST] Consolidated Activities:');
    for (const [key, activity] of this.activities) {
      console.log(`  ${key}: ${activity.activityType} - ${activity.description}`);
      if (activity.locationTags) {
        console.log(`    Location Tags: ${activity.locationTags.join(', ')}`);
      }
      if (activity.targetLocationId) {
        console.log(`    Target Location: ${activity.targetLocationId}`);
      }
    }
    
    console.log('\n🔄 [ACTIVITY MANIFEST] Activity Aliases:');
    for (const [alias, target] of this.aliases) {
      console.log(`  ${alias} → ${target}`);
    }
  }
} 