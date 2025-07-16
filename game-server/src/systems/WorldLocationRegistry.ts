/**
 * World Location Registry
 * Maps semantic names to physical coordinates for agent activities
 * Provides tag-based location lookup for flexible activity resolution
 */

import * as fs from 'fs';
import * as path from 'path';

export interface LocationEntry {
  id: string;
  displayName: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  type: string;
  tags: string[];
  description?: string;
}

export class WorldLocationRegistry {
  private static instance: WorldLocationRegistry;
  private locations: Map<string, LocationEntry> = new Map();
  private locationsByTag: Map<string, LocationEntry[]> = new Map();

  private constructor() {
    this.loadLocations();
  }

  public static getInstance(): WorldLocationRegistry {
    if (!WorldLocationRegistry.instance) {
      WorldLocationRegistry.instance = new WorldLocationRegistry();
    }
    return WorldLocationRegistry.instance;
  }

  /**
   * Load locations from the game data
   */
  private loadLocations(): void {
    try {
      // Load from the local data directory
      const locationsPath = path.join(__dirname, '../data/beacon_bay_locations.json');
      const locationData = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
      
      // Convert existing location data to our format
      for (const [key, location] of Object.entries(locationData)) {
        if (key === 'water_areas') continue; // Skip water areas for now
        
        const loc = location as any;
        const entry: LocationEntry = {
          id: key,
          displayName: loc.name,
          x: loc.x,
          y: loc.y,
          width: loc.width,
          height: loc.height,
          type: loc.type,
          tags: this.generateTags(loc.type, loc.name, loc.description),
          description: loc.description
        };
        
        this.locations.set(key, entry);
        this.indexLocationByTags(entry);
      }
      
      console.log(`🗺️ [LOCATION REGISTRY] Loaded ${this.locations.size} locations`);
      
    } catch (error) {
      console.error('❌ Error loading location data:', error);
    }
  }

  /**
   * Generate tags for a location based on its properties
   */
  private generateTags(type: string, name: string, description?: string): string[] {
    const tags: string[] = [type];
    
    // Add semantic tags based on type
    const typeTagMap: { [key: string]: string[] } = {
      'civic': ['public', 'official', 'government', 'community'],
      'commercial': ['business', 'shop', 'trade', 'commerce'],
      'residential': ['home', 'living', 'private', 'rest'],
      'maritime': ['water', 'nautical', 'shipping', 'boats'],
      'agricultural': ['farm', 'rural', 'farming', 'crops'],
      'recreational': ['fun', 'leisure', 'entertainment', 'activities'],
      'natural': ['outdoor', 'nature', 'environment'],
      'waterfront': ['water', 'dock', 'harbor', 'boats'],
      'special': ['unique', 'experimental', 'research']
    };
    
    if (typeTagMap[type]) {
      tags.push(...typeTagMap[type]);
    }
    
    // Comprehensive location-specific tags
    const locationTags: { [key: string]: string[] } = {
      // Government & Civic
      'town_hall': ['administration', 'government', 'meetings', 'official', 'court', 'legal'],
      'hospital': ['medical', 'health', 'emergency', 'treatment'],
      'police_station': ['law', 'security', 'safety', 'patrol'],
      'fire_station': ['emergency', 'rescue', 'safety', 'equipment'],
      'post_office': ['mail', 'delivery', 'communication'],
      'library': ['reading', 'quiet', 'learning', 'books', 'research'],
      'church': ['worship', 'quiet', 'meeting', 'community', 'spiritual', 'religious'],
      'school': ['learning', 'education', 'teaching', 'students'],
      'town_square': ['social', 'gathering', 'meeting', 'community', 'events'],
      'watchtower': ['observation', 'security', 'monitoring'],
      
      // Commercial & Business
      'blacksmith_shop': ['work', 'crafting', 'forge', 'blacksmith', 'metal', 'tools', 'repair'],
      'general_store': ['shopping', 'supplies', 'trade', 'goods'],
      'bakery': ['food', 'bread', 'eating', 'baking', 'morning'],
      'cafe': ['food', 'social', 'meeting', 'coffee', 'relaxation'],
      'tavern': ['food', 'social', 'drinking', 'evening', 'entertainment'],
      'gym': ['fitness', 'training', 'exercise', 'physical', 'health'],
      'music_store': ['music', 'instruments', 'lessons', 'practice'],
      'butcher': ['food', 'meat', 'preparation'],
      'fish_market': ['food', 'fish', 'trading', 'fresh'],
      'apothecary': ['medicine', 'herbs', 'healing', 'health'],
      'tailor_shop': ['clothing', 'sewing', 'fitting', 'fabric', 'tailor_shop'],
      'woodworker_shop': ['crafting', 'wood', 'furniture', 'tools'],
      'warehouse': ['storage', 'goods', 'inventory'],
      'farmers_market': ['food', 'produce', 'trading', 'fresh'],
      
      // Maritime
      'lighthouse': ['navigation', 'safety', 'observation', 'beacon'],
      'shipyard': ['boats', 'construction', 'repair', 'maritime'],
      'fishing_dock': ['fishing', 'boats', 'catch', 'maritime'],
      
      // Agricultural
      'stables': ['animals', 'horses', 'care', 'transport'],
      'windmill': ['grinding', 'grain', 'processing'],
      'farmhouse': ['farming', 'rural', 'home', 'agricultural', 'garden'],
      'barn': ['storage', 'animals', 'farming', 'equipment'],
      'crop_fields': ['farming', 'growing', 'harvest', 'outdoor', 'agricultural'],
      'orchard': ['farming', 'fruit', 'trees', 'harvest', 'garden'],
      
      // Residential
      'cottage': ['home', 'living', 'rest', 'private'],
      'house': ['home', 'living', 'rest', 'private'],
      'apartments': ['home', 'living', 'community', 'residential'],
      'mansion': ['home', 'luxury', 'private', 'wealth'],
      
      // Recreation
      'rec_center': ['activities', 'community', 'programs', 'social'],
      'playground': ['children', 'play', 'fun', 'activities'],
      'dj_stage': ['music', 'entertainment', 'performance', 'events'],
      'beach': ['water', 'relaxation', 'swimming', 'outdoor'],
      
      // Special
      'mad_science_lab': ['research', 'experiments', 'science', 'unique']
    };
    
    // Add location-specific tags
    const locationKey = Object.keys(locationTags).find(key => 
      name.toLowerCase().includes(key) || 
      type.toLowerCase().includes(key)
    );
    
    if (locationKey && locationTags[locationKey]) {
      tags.push(...locationTags[locationKey]);
    }
    
    // Add general keyword-based tags
    const nameToTags: { [key: string]: string[] } = {
      'kitchen': ['food', 'cooking', 'eating'],
      'table': ['sitting', 'eating', 'meeting'],
      'forge': ['work', 'crafting', 'hot', 'metal'],
      'shop': ['business', 'trade', 'commerce'],
      'market': ['shopping', 'food', 'trading'],
      'harbor': ['water', 'ships', 'work'],
      'dock': ['water', 'boats', 'work'],
      'field': ['outdoor', 'farming', 'open'],
      'garden': ['outdoor', 'growing', 'peaceful'],
      'hall': ['meeting', 'gathering', 'official'],
      'store': ['shopping', 'goods', 'business'],
      'office': ['work', 'business', 'professional'],
      'station': ['official', 'service', 'public'],
      'center': ['community', 'activities', 'gathering']
    };
    
    for (const [keyword, additionalTags] of Object.entries(nameToTags)) {
      if (name.toLowerCase().includes(keyword) || description?.toLowerCase().includes(keyword)) {
        tags.push(...additionalTags);
      }
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Index location by its tags
   */
  private indexLocationByTags(entry: LocationEntry): void {
    for (const tag of entry.tags) {
      if (!this.locationsByTag.has(tag)) {
        this.locationsByTag.set(tag, []);
      }
      this.locationsByTag.get(tag)!.push(entry);
    }
  }

  /**
   * Get location by ID
   */
  public getLocation(id: string): LocationEntry | null {
    return this.locations.get(id) || null;
  }

  /**
   * Get all locations
   */
  public getAllLocations(): Map<string, LocationEntry> {
    return this.locations;
  }

  /**
   * Find locations by tags
   */
  public findLocationsByTags(tags: string[], preferredType?: string): LocationEntry[] {
    const candidates: LocationEntry[] = [];
    
    for (const tag of tags) {
      const taggedLocations = this.locationsByTag.get(tag) || [];
      candidates.push(...taggedLocations);
    }
    
    // Count how many tags each location matches
    const locationScores = new Map<string, number>();
    for (const location of candidates) {
      const score = locationScores.get(location.id) || 0;
      locationScores.set(location.id, score + 1);
    }
    
    // Get unique locations sorted by match score
    const uniqueLocations = Array.from(new Set(candidates.map(l => l.id)))
      .map(id => this.locations.get(id)!)
      .sort((a, b) => {
        const scoreA = locationScores.get(a.id) || 0;
        const scoreB = locationScores.get(b.id) || 0;
        
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Higher score first
        }
        
        // If same score, prefer by type
        if (preferredType && a.type === preferredType && b.type !== preferredType) {
          return -1;
        }
        if (preferredType && b.type === preferredType && a.type !== preferredType) {
          return 1;
        }
        
        return 0;
      });
    
    return uniqueLocations;
  }

  /**
   * Find best location for activity
   */
  public findLocationForActivity(activityName: string, requiredTags: string[], agentLocation?: { x: number, y: number }): LocationEntry | null {
    const candidates = this.findLocationsByTags(requiredTags);
    
    if (candidates.length === 0) {
      return null;
    }
    
    // If agent location is provided, prefer closer locations
    if (agentLocation) {
      candidates.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.x - agentLocation.x, 2) + Math.pow(a.y - agentLocation.y, 2));
        const distB = Math.sqrt(Math.pow(b.x - agentLocation.x, 2) + Math.pow(b.y - agentLocation.y, 2));
        return distA - distB;
      });
    }
    
    return candidates[0];
  }

  /**
   * Get all locations of a specific type
   */
  public getLocationsByType(type: string): LocationEntry[] {
    return Array.from(this.locations.values()).filter(loc => loc.type === type);
  }

  /**
   * Get center position of a location (accounting for width/height)
   */
  public getLocationCenter(location: LocationEntry): { x: number, y: number } {
    return {
      x: location.x + (location.width || 0) / 2,
      y: location.y + (location.height || 0) / 2
    };
  }

  /**
   * Debug: Print all locations with their tags
   */
  public debugPrintLocations(): void {
    console.log('\n🏗️ [LOCATION REGISTRY] All Locations:');
    for (const [id, location] of this.locations) {
      console.log(`  ${id}: ${location.displayName} (${location.type}) - Tags: ${location.tags.join(', ')}`);
    }
  }
} 