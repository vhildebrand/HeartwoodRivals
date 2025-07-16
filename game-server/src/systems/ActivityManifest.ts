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
  STATIC = 'STATIC'          // No movement
}

export enum Duration {
  SCHEDULED = 'SCHEDULED',           // Duration determined by schedule
  UNTIL_ARRIVAL = 'UNTIL_ARRIVAL',  // Until agent reaches destination
  UNTIL_INTERRUPTED = 'UNTIL_INTERRUPTED' // Until interrupted by higher priority
}

export interface ActivityManifestEntry {
  activityType: ActivityType;
  locationTags?: string[];           // Tags to find appropriate locations
  targetLocationId?: string;         // Specific location ID
  movementPattern?: MovementPattern;
  animation?: string;                // Animation key to play
  duration: Duration | string;       // How long the activity lasts
  priority?: number;                 // 1-10 scale, higher = more important
  interruptible?: boolean;           // Can this activity be interrupted?
  requiredEnergy?: number;           // Energy cost (1-100)
  moodImpact?: { [mood: string]: number }; // How this affects agent mood
  stateTransitions?: string[];       // What states this activity can transition to
  description?: string;              // Human-readable description
}

export class ActivityManifest {
  private static instance: ActivityManifest;
  private activities: Map<string, ActivityManifestEntry> = new Map();

  private constructor() {
    this.loadActivities();
  }

  public static getInstance(): ActivityManifest {
    if (!ActivityManifest.instance) {
      ActivityManifest.instance = new ActivityManifest();
    }
    return ActivityManifest.instance;
  }

  /**
   * Load all activity definitions based on agent schedules
   */
  private loadActivities(): void {
    
    // === WAKE UP & MORNING ACTIVITIES ===
    this.addActivity('wake_up', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['home', 'rest'],
      duration: Duration.SCHEDULED,
      priority: 9,
      description: 'Waking up and starting the day'
    });

    this.addActivity('morning_meditation', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['home', 'quiet'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Morning meditation and reflection'
    });

    this.addActivity('morning_prayers', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['church', 'home'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Morning prayers and spiritual practice'
    });

    this.addActivity('morning_walk', {
      activityType: ActivityType.ROUTINE_MOVEMENT,
      movementPattern: MovementPattern.WANDER,
      locationTags: ['outdoor', 'nature'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Morning walk for exercise and fresh air'
    });

    this.addActivity('sunrise_beach_run', {
      activityType: ActivityType.ROUTINE_MOVEMENT,
      movementPattern: MovementPattern.PATROL,
      locationTags: ['beach', 'outdoor'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Running on the beach at sunrise'
    });

    // === EATING ACTIVITIES ===
    this.addActivity('breakfast', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['food', 'eating', 'home'],
      duration: Duration.SCHEDULED,
      priority: 8,
      description: 'Having breakfast'
    });

    this.addActivity('lunch', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['food', 'eating'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Having lunch'
    });

    this.addActivity('dinner', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['food', 'eating'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Having dinner'
    });

    this.addActivity('lunch_at_tavern', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['tavern', 'food'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Having lunch at the tavern'
    });

    this.addActivity('dinner_at_tavern', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['tavern', 'food'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Having dinner at the tavern'
    });

    // === WORK ACTIVITIES ===
    this.addActivity('work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['work', 'business'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'General work activities'
    });

    this.addActivity('smithing', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['forge', 'crafting', 'blacksmith'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Blacksmith work at the forge'
    });

    this.addActivity('baking', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['bakery', 'food', 'cooking'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Baking bread and pastries'
    });

    this.addActivity('woodworking', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['woodworker_shop', 'crafting'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Woodworking and furniture making'
    });

    this.addActivity('sewing', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['tailor_shop', 'sewing'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Sewing and tailoring work'
    });

    this.addActivity('teaching', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['school', 'education'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Teaching students'
    });

    this.addActivity('medical_work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['hospital', 'medical'],
      duration: Duration.SCHEDULED,
      priority: 8,
      description: 'Medical practice and patient care'
    });

    this.addActivity('emergency_response', {
      activityType: ActivityType.GOTO_LOCATION,
      locationTags: ['emergency', 'medical', 'urgent'],
      duration: Duration.UNTIL_INTERRUPTED,
      priority: 10,
      interruptible: false,
      description: 'Emergency response to urgent medical situations'
    });

    this.addActivity('fire_response', {
      activityType: ActivityType.GOTO_LOCATION,
      locationTags: ['emergency', 'fire', 'urgent'],
      duration: Duration.UNTIL_INTERRUPTED,
      priority: 10,
      interruptible: false,
      description: 'Emergency response to fire emergencies'
    });

    this.addActivity('police_response', {
      activityType: ActivityType.GOTO_LOCATION,
      locationTags: ['emergency', 'crime', 'urgent'],
      duration: Duration.UNTIL_INTERRUPTED,
      priority: 10,
      interruptible: false,
      description: 'Emergency response to criminal situations'
    });

    // === IMMEDIATE ACTION ACTIVITIES ===
    this.addActivity('social', {
      activityType: ActivityType.GOTO_LOCATION,
      locationTags: ['social', 'entertainment', 'meeting'],
      duration: Duration.UNTIL_INTERRUPTED,
      priority: 8,
      interruptible: false,
      description: 'Immediate social interaction or gathering'
    });

    this.addActivity('visit', {
      activityType: ActivityType.GOTO_LOCATION,
      locationTags: ['social', 'meeting', 'home'],
      duration: Duration.UNTIL_INTERRUPTED,
      priority: 8,
      interruptible: false,
      description: 'Immediate visit to a person or place'
    });

    this.addActivity('entertainment', {
      activityType: ActivityType.GOTO_LOCATION,
      locationTags: ['entertainment', 'music', 'performance'],
      duration: Duration.UNTIL_INTERRUPTED,
      priority: 8,
      interruptible: false,
      description: 'Immediate attendance at entertainment event'
    });

    this.addActivity('library_work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['library', 'books'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Library management and helping patrons'
    });

    this.addActivity('farming', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['farm', 'outdoor', 'agricultural'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Farming and agricultural work'
    });

    this.addActivity('gardening', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['garden', 'outdoor', 'agricultural', 'farm'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Gardening and plant care'
    });

    this.addActivity('fishing', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['fishing_dock', 'water'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Fishing activities'
    });

    this.addActivity('dj_work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['dj_stage', 'entertainment'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'DJ performance and music work'
    });

    this.addActivity('lighthouse_keeping', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['lighthouse', 'navigation'],
      duration: Duration.SCHEDULED,
      priority: 9,
      description: 'Lighthouse operation and maintenance'
    });

    this.addActivity('boat_work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['shipyard', 'maritime'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Boat building and repair'
    });

    this.addActivity('apothecary_work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['apothecary', 'medicine'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Herbal medicine and remedy preparation'
    });

    this.addActivity('tavern_work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['tavern', 'service'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Tavern service and hospitality'
    });

    this.addActivity('store_work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['store', 'business'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Store management and customer service'
    });

    // === ADDITIONAL MISSING ACTIVITIES ===
    this.addActivity('farm_work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['farm', 'outdoor', 'agricultural'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'General farm work and agricultural activities'
    });

    this.addActivity('crafting', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['crafting', 'workshop', 'work'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'General crafting and workshop activities'
    });

    this.addActivity('business', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['business', 'office', 'commercial'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Business activities and commercial work'
    });

    this.addActivity('sailing', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['harbor', 'maritime', 'boats', 'water'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Sailing and maritime activities'
    });

    this.addActivity('legal_work', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['office', 'legal', 'court', 'professional'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Legal work and court proceedings'
    });

    this.addActivity('administration', {
      activityType: ActivityType.ADMINISTRATION,
      locationTags: ['office', 'administration', 'government'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Administrative tasks and paperwork'
    });

    this.addActivity('meetings', {
      activityType: ActivityType.SOCIAL_INTERACTION,
      locationTags: ['meeting', 'office', 'business'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Business meetings and conferences'
    });

    this.addActivity('exercise', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['gym', 'fitness', 'training'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Physical exercise and fitness training'
    });

    this.addActivity('religious_service', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['church', 'worship', 'spiritual'],
      duration: Duration.SCHEDULED,
      priority: 8,
      description: 'Religious services and worship'
    });

    this.addActivity('counseling', {
      activityType: ActivityType.SOCIAL_INTERACTION,
      locationTags: ['church', 'office', 'private'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Counseling and spiritual guidance'
    });

    // === MAINTENANCE ACTIVITIES ===
    this.addActivity('equipment_maintenance', {
      activityType: ActivityType.MAINTENANCE,
      locationTags: ['work', 'equipment'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Equipment maintenance and repair'
    });

    this.addActivity('forge_maintenance', {
      activityType: ActivityType.MAINTENANCE,
      locationTags: ['forge', 'blacksmith'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Forge maintenance and preparation'
    });

    this.addActivity('tool_maintenance', {
      activityType: ActivityType.MAINTENANCE,
      locationTags: ['work', 'tools'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Tool maintenance and organization'
    });

    this.addActivity('shop_cleaning', {
      activityType: ActivityType.MAINTENANCE,
      locationTags: ['shop', 'business'],
      duration: Duration.SCHEDULED,
      priority: 4,
      description: 'Cleaning and organizing shop'
    });

    this.addActivity('equipment_check', {
      activityType: ActivityType.MAINTENANCE,
      locationTags: ['work', 'equipment'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Checking equipment functionality'
    });

    // === PATROL & SECURITY ACTIVITIES ===
    this.addActivity('patrol', {
      activityType: ActivityType.ROUTINE_MOVEMENT,
      movementPattern: MovementPattern.PATROL,
      locationTags: ['public', 'security'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Security patrol of area'
    });

    this.addActivity('town_patrol', {
      activityType: ActivityType.ROUTINE_MOVEMENT,
      movementPattern: MovementPattern.PATROL,
      locationTags: ['town', 'public'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Patrolling the town'
    });

    this.addActivity('harbor_patrol', {
      activityType: ActivityType.ROUTINE_MOVEMENT,
      movementPattern: MovementPattern.PATROL,
      locationTags: ['harbor', 'maritime'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Patrolling the harbor area'
    });

    this.addActivity('fire_safety_inspection', {
      activityType: ActivityType.ROUTINE_MOVEMENT,
      movementPattern: MovementPattern.PATROL,
      locationTags: ['town', 'safety'],
      duration: Duration.SCHEDULED,
      priority: 8,
      description: 'Fire safety inspections around town'
    });

    // === OBSERVATION & MONITORING ===
    this.addActivity('weather_observation', {
      activityType: ActivityType.OBSERVATION,
      locationTags: ['lighthouse', 'outdoor'],
      duration: Duration.SCHEDULED,
      priority: 8,
      description: 'Observing weather conditions'
    });

    this.addActivity('sea_monitoring', {
      activityType: ActivityType.OBSERVATION,
      locationTags: ['lighthouse', 'water'],
      duration: Duration.SCHEDULED,
      priority: 8,
      description: 'Monitoring sea conditions'
    });

    this.addActivity('watch_duty', {
      activityType: ActivityType.OBSERVATION,
      locationTags: ['lighthouse', 'watchtower'],
      duration: Duration.SCHEDULED,
      priority: 8,
      description: 'Standing watch and observation'
    });

    // === TRAINING & EDUCATION ===
    this.addActivity('training', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['gym', 'training'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Physical training and exercise'
    });

    this.addActivity('fire_training', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['fire_station', 'training'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Fire department training'
    });

    this.addActivity('maritime_training', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['harbor', 'maritime'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Maritime rescue training'
    });

    this.addActivity('crew_training', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['work', 'training'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Training crew members'
    });

    // === SOCIAL ACTIVITIES ===
    this.addActivity('socializing', {
      activityType: ActivityType.SOCIAL_INTERACTION,
      locationTags: ['social', 'gathering'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Socializing with others'
    });

    this.addActivity('community_meeting', {
      activityType: ActivityType.SOCIAL_INTERACTION,
      locationTags: ['town_hall', 'meeting'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Attending community meetings'
    });

    this.addActivity('meeting', {
      activityType: ActivityType.SOCIAL_INTERACTION,
      locationTags: ['meeting', 'business'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Business or official meetings'
    });

    this.addActivity('consultation', {
      activityType: ActivityType.SOCIAL_INTERACTION,
      locationTags: ['business', 'professional'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Professional consultations'
    });

    this.addActivity('collaboration', {
      activityType: ActivityType.SOCIAL_INTERACTION,
      locationTags: ['work', 'social'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Collaborating with others'
    });

    // === LEISURE & PERSONAL ACTIVITIES ===
    this.addActivity('reading', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['library', 'quiet', 'home'],
      duration: Duration.SCHEDULED,
      priority: 3,
      description: 'Reading books or documents'
    });

    this.addActivity('personal_time', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['home', 'rest'],
      duration: Duration.SCHEDULED,
      priority: 4,
      description: 'Personal time and relaxation'
    });

    this.addActivity('beach_walk', {
      activityType: ActivityType.ROUTINE_MOVEMENT,
      movementPattern: MovementPattern.WANDER,
      locationTags: ['beach', 'outdoor'],
      duration: Duration.SCHEDULED,
      priority: 3,
      description: 'Walking on the beach'
    });

    this.addActivity('evening_stroll', {
      activityType: ActivityType.ROUTINE_MOVEMENT,
      movementPattern: MovementPattern.WANDER,
      locationTags: ['town', 'outdoor'],
      duration: Duration.SCHEDULED,
      priority: 3,
      description: 'Evening stroll around town'
    });

    this.addActivity('music_practice', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['music', 'instruments', 'practice', 'home'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Practicing musical skills and performance'
    });

    this.addActivity('research', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['library', 'research', 'science'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Research and study activities'
    });

    this.addActivity('planning', {
      activityType: ActivityType.ADMINISTRATION,
      locationTags: ['office', 'work'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Planning and administrative work'
    });

    // === SLEEP & REST ===
    this.addActivity('sleep', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['home', 'rest'],
      duration: Duration.SCHEDULED,
      priority: 9,
      description: 'Sleeping and resting'
    });

    this.addActivity('rest', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['home', 'rest'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Taking a rest break'
    });

    this.addActivity('prepare_for_bed', {
      activityType: ActivityType.STATIONARY,
      locationTags: ['home', 'rest'],
      duration: Duration.SCHEDULED,
      priority: 7,
      description: 'Preparing for bed'
    });

    // === DELIVERY & TRANSPORT ===
    this.addActivity('delivery', {
      activityType: ActivityType.GOTO_LOCATION,
      locationTags: ['business', 'trade'],
      duration: Duration.SCHEDULED,
      priority: 6,
      description: 'Making deliveries'
    });

    this.addActivity('visit_store', {
      activityType: ActivityType.GOTO_LOCATION,
      locationTags: ['store', 'business'],
      duration: Duration.SCHEDULED,
      priority: 5,
      description: 'Visiting a store'
    });

         // === GENERAL MOVEMENT ===
     this.addActivity('walk_to_harbor', {
       activityType: ActivityType.GOTO_LOCATION,
       locationTags: ['harbor', 'maritime'],
       duration: Duration.UNTIL_ARRIVAL,
       priority: 5,
       description: 'Walking to the harbor'
     });

     this.addActivity('go_to_town_square', {
       activityType: ActivityType.GOTO_LOCATION,
       targetLocationId: 'town_square',
       duration: Duration.UNTIL_ARRIVAL,
       priority: 5,
       description: 'Going to the town square'
     });

     // === FALLBACK ACTIVITIES ===
     this.addActivity('general_work', {
       activityType: ActivityType.STATIONARY,
       locationTags: ['work', 'business', 'office'],
       duration: Duration.SCHEDULED,
       priority: 5,
       description: 'General work activities'
     });

     this.addActivity('organize', {
       activityType: ActivityType.STATIONARY,
       locationTags: ['work', 'shop', 'office'],
       duration: Duration.SCHEDULED,
       priority: 4,
       description: 'Organizing and tidying up'
     });

     this.addActivity('review', {
       activityType: ActivityType.STATIONARY,
       locationTags: ['office', 'work', 'home'],
       duration: Duration.SCHEDULED,
       priority: 5,
       description: 'Reviewing documents or plans'
     });

     this.addActivity('check', {
       activityType: ActivityType.STATIONARY,
       locationTags: ['work', 'equipment'],
       duration: Duration.SCHEDULED,
       priority: 5,
       description: 'Checking equipment or status'
     });

     this.addActivity('prepare', {
       activityType: ActivityType.STATIONARY,
       locationTags: ['work', 'home'],
       duration: Duration.SCHEDULED,
       priority: 5,
       description: 'Preparing for activities'
     });

    console.log(`🎭 [ACTIVITY MANIFEST] Loaded ${this.activities.size} activities`);
  }

  /**
   * Add an activity to the manifest
   */
  private addActivity(key: string, entry: ActivityManifestEntry): void {
    this.activities.set(key, entry);
  }

  /**
   * Get activity definition by name or alias
   */
  public getActivity(activityName: string): ActivityManifestEntry | null {
    const originalName = activityName.trim();
    const normalizedName = this.normalizeActivityName(activityName);
    
    // Check direct match first with original name
    if (this.activities.has(originalName)) {
      return this.activities.get(originalName)!;
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
   * Debug: Print all activities
   */
  public debugPrintActivities(): void {
    console.log('\n🎭 [ACTIVITY MANIFEST] All Activities:');
    for (const [key, activity] of this.activities) {
      console.log(`  ${key}: ${activity.activityType} - ${activity.description}`);
      if (activity.locationTags) {
        console.log(`    Location Tags: ${activity.locationTags.join(', ')}`);
      }
      if (activity.targetLocationId) {
        console.log(`    Target Location: ${activity.targetLocationId}`);
      }
    }
  }
} 