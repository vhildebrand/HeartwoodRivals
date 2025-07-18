import { Pool } from 'pg';
import { createClient } from 'redis';
import OpenAI from 'openai';

interface PersonalityTrait {
  category: string;
  traits: string[];
}

interface PersonalitySeed {
  agentId: string;
  personalityTraits: string[];
  likes: string[];
  dislikes: string[];
  datingStyle: string;
  romanticGoals: string[];
  dealbreakers: string[];
  conversationStyle: string;
  attractionTriggers: string[];
  generatedAt: Date;
}

interface SeasonTheme {
  name: string;
  description: string;
  personalityModifiers: Record<string, number>;
  themeSpecificTraits: string[];
}

export class NPCGenerationService {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private openai: OpenAI;

  // Pre-defined personality traits for procedural generation
  private personalityTraits: PersonalityTrait[] = [
    {
      category: 'social',
      traits: ['outgoing', 'introverted', 'charming', 'shy', 'confident', 'reserved', 'playful', 'serious']
    },
    {
      category: 'emotional',
      traits: ['passionate', 'calm', 'empathetic', 'logical', 'romantic', 'practical', 'sensitive', 'thick-skinned']
    },
    {
      category: 'intellectual',
      traits: ['curious', 'wise', 'witty', 'thoughtful', 'creative', 'analytical', 'adventurous', 'traditional']
    },
    {
      category: 'lifestyle',
      traits: ['active', 'relaxed', 'ambitious', 'content', 'spontaneous', 'planned', 'artistic', 'practical']
    }
  ];

  // Pre-defined interests and activities
  private interests = [
    // Creative interests
    'painting', 'music', 'writing', 'dancing', 'theater', 'photography', 'crafting', 'cooking',
    // Outdoor activities
    'hiking', 'sailing', 'fishing', 'gardening', 'stargazing', 'camping', 'swimming', 'walking',
    // Social activities
    'parties', 'tavern_visits', 'community_events', 'storytelling', 'gossip', 'helping_others',
    // Intellectual pursuits
    'reading', 'learning', 'philosophy', 'history', 'science', 'puzzles', 'debates', 'meditation',
    // Professional interests
    'business', 'craftsmanship', 'leadership', 'teaching', 'healing', 'building', 'trading', 'farming'
  ];

  // Pre-defined dislikes
  private commonDislikes = [
    'dishonesty', 'rudeness', 'arrogance', 'laziness', 'gossip', 'violence', 'loud_noises', 'crowds',
    'selfishness', 'impatience', 'negativity', 'boastfulness', 'clinginess', 'insensitivity',
    'unreliability', 'closed_mindedness', 'materialism', 'drama', 'jealousy', 'controlling_behavior'
  ];

  // Dating styles
  private datingStyles = [
    'romantic_traditionalist', 'modern_casual', 'deep_connection_seeker', 'fun_loving_flirt',
    'intellectual_companion', 'adventurous_partner', 'emotional_support_seeker', 'independent_equal'
  ];

  // Conversation styles
  private conversationStyles = [
    'witty_banter', 'deep_philosophical', 'light_hearted', 'storytelling', 'question_asking',
    'compliment_giving', 'teasing_playful', 'sincere_direct', 'mysterious_alluring', 'supportive_listening'
  ];

  // Season themes for variety
  private seasonThemes: SeasonTheme[] = [
    {
      name: 'Harvest Romance',
      description: 'A season focused on finding someone to share life\'s abundance with',
      personalityModifiers: { 'nurturing': 0.3, 'traditional': 0.2, 'family_oriented': 0.4 },
      themeSpecificTraits: ['family_oriented', 'nurturing', 'home_loving', 'traditional']
    },
    {
      name: 'Adventure Seekers',
      description: 'A season for those looking for exciting romantic adventures',
      personalityModifiers: { 'adventurous': 0.4, 'spontaneous': 0.3, 'confident': 0.2 },
      themeSpecificTraits: ['adventurous', 'spontaneous', 'risk_taking', 'energetic']
    },
    {
      name: 'Intellectual Connections',
      description: 'A season focused on meeting minds and hearts',
      personalityModifiers: { 'intellectual': 0.4, 'curious': 0.3, 'thoughtful': 0.2 },
      themeSpecificTraits: ['intellectual', 'curious', 'philosophical', 'book_loving']
    },
    {
      name: 'Artistic Souls',
      description: 'A season for creative spirits seeking their muse',
      personalityModifiers: { 'creative': 0.4, 'artistic': 0.3, 'passionate': 0.2 },
      themeSpecificTraits: ['artistic', 'creative', 'passionate', 'expressive']
    }
  ];

  constructor(pool: Pool, redisClient: ReturnType<typeof createClient>) {
    this.pool = pool;
    this.redisClient = redisClient;
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
    });
  }

  /**
   * Generate personality seeds for all agents based on a seasonal theme
   */
  async generateSeasonalPersonalitySeeds(seasonTheme?: string): Promise<PersonalitySeed[]> {
    try {
      // Get all agents from the database
      const agents = await this.pool.query('SELECT id, name, personality_traits, likes, dislikes FROM agents');
      
      // Select or default season theme
      const theme = seasonTheme ? 
        this.seasonThemes.find(t => t.name === seasonTheme) || this.seasonThemes[0] :
        this.seasonThemes[Math.floor(Math.random() * this.seasonThemes.length)];

      const personalitySeeds: PersonalitySeed[] = [];

      for (const agent of agents.rows) {
        const seed = await this.generatePersonalitySeed(agent, theme);
        personalitySeeds.push(seed);
        
        // Store in database
        await this.storePersonalitySeed(agent.id, seed);
      }

      console.log(`Generated ${personalitySeeds.length} personality seeds for theme: ${theme.name}`);
      return personalitySeeds;
    } catch (error) {
      console.error('Error generating seasonal personality seeds:', error);
      throw error;
    }
  }

  /**
   * Generate a personality seed for a specific agent
   */
  private async generatePersonalitySeed(agent: any, theme: SeasonTheme): Promise<PersonalitySeed> {
    // Base personality traits from existing agent data
    const baseTraits = agent.personality_traits || [];
    const baseLikes = agent.likes || [];
    const baseDislikes = agent.dislikes || [];

    // Enhance with theme-specific traits
    const enhancedTraits = this.enhanceTraitsWithTheme(baseTraits, theme);
    const enhancedLikes = this.enhanceLikesWithTheme(baseLikes, theme);
    const enhancedDislikes = this.generateDislikes(baseDislikes);

    // Generate dating-specific attributes
    const datingStyle = this.selectDatingStyle(enhancedTraits);
    const conversationStyle = this.selectConversationStyle(enhancedTraits);
    const romanticGoals = this.generateRomanticGoals(enhancedTraits, theme);
    const dealbreakers = this.generateDealbreakers(enhancedTraits, enhancedDislikes);
    const attractionTriggers = this.generateAttractionTriggers(enhancedTraits, enhancedLikes);

    return {
      agentId: agent.id,
      personalityTraits: enhancedTraits,
      likes: enhancedLikes,
      dislikes: enhancedDislikes,
      datingStyle,
      romanticGoals,
      dealbreakers,
      conversationStyle,
      attractionTriggers,
      generatedAt: new Date()
    };
  }

  /**
   * Enhance existing personality traits with seasonal theme
   */
  private enhanceTraitsWithTheme(baseTraits: string[], theme: SeasonTheme): string[] {
    const enhanced = [...baseTraits];
    
    // Add theme-specific traits with probability based on modifiers
    theme.themeSpecificTraits.forEach(trait => {
      if (Math.random() < 0.4 && !enhanced.includes(trait)) {
        enhanced.push(trait);
      }
    });

    // Add some random personality traits to create variety
    const randomTraits = this.selectRandomTraits(3);
    randomTraits.forEach(trait => {
      if (!enhanced.includes(trait)) {
        enhanced.push(trait);
      }
    });

    return enhanced.slice(0, 8); // Limit to 8 traits
  }

  /**
   * Enhance existing likes with seasonal theme
   */
  private enhanceLikesWithTheme(baseLikes: string[], theme: SeasonTheme): string[] {
    const enhanced = [...baseLikes];
    
    // Add theme-appropriate interests
    const themeInterests = this.getThemeInterests(theme);
    themeInterests.forEach(interest => {
      if (Math.random() < 0.5 && !enhanced.includes(interest)) {
        enhanced.push(interest);
      }
    });

    // Add some random interests for variety
    const randomInterests = this.selectRandomInterests(4);
    randomInterests.forEach(interest => {
      if (!enhanced.includes(interest)) {
        enhanced.push(interest);
      }
    });

    return enhanced.slice(0, 10); // Limit to 10 likes
  }

  /**
   * Generate dislikes based on existing and common dislikes
   */
  private generateDislikes(baseDislikes: string[]): string[] {
    const enhanced = [...baseDislikes];
    
    // Add some common dislikes
    const randomDislikes = this.selectRandomDislikes(3);
    randomDislikes.forEach(dislike => {
      if (!enhanced.includes(dislike)) {
        enhanced.push(dislike);
      }
    });

    return enhanced.slice(0, 8); // Limit to 8 dislikes
  }

  /**
   * Select dating style based on personality traits
   */
  private selectDatingStyle(traits: string[]): string {
    // Logic to select dating style based on traits
    if (traits.includes('romantic') || traits.includes('traditional')) {
      return 'romantic_traditionalist';
    } else if (traits.includes('adventurous') || traits.includes('spontaneous')) {
      return 'adventurous_partner';
    } else if (traits.includes('intellectual') || traits.includes('curious')) {
      return 'intellectual_companion';
    } else if (traits.includes('playful') || traits.includes('outgoing')) {
      return 'fun_loving_flirt';
    } else if (traits.includes('empathetic') || traits.includes('sensitive')) {
      return 'emotional_support_seeker';
    } else if (traits.includes('confident') || traits.includes('independent')) {
      return 'independent_equal';
    } else if (traits.includes('passionate') || traits.includes('intense')) {
      return 'deep_connection_seeker';
    } else {
      return 'modern_casual';
    }
  }

  /**
   * Select conversation style based on personality traits
   */
  private selectConversationStyle(traits: string[]): string {
    if (traits.includes('witty') || traits.includes('playful')) {
      return 'witty_banter';
    } else if (traits.includes('thoughtful') || traits.includes('philosophical')) {
      return 'deep_philosophical';
    } else if (traits.includes('charming') || traits.includes('complimentary')) {
      return 'compliment_giving';
    } else if (traits.includes('curious') || traits.includes('inquisitive')) {
      return 'question_asking';
    } else if (traits.includes('empathetic') || traits.includes('supportive')) {
      return 'supportive_listening';
    } else if (traits.includes('mysterious') || traits.includes('alluring')) {
      return 'mysterious_alluring';
    } else if (traits.includes('direct') || traits.includes('honest')) {
      return 'sincere_direct';
    } else if (traits.includes('storytelling') || traits.includes('narrative')) {
      return 'storytelling';
    } else {
      return 'light_hearted';
    }
  }

  /**
   * Generate romantic goals based on traits and theme
   */
  private generateRomanticGoals(traits: string[], theme: SeasonTheme): string[] {
    const goals = [];
    
    if (traits.includes('family_oriented') || theme.name === 'Harvest Romance') {
      goals.push('find_life_partner', 'build_family');
    }
    if (traits.includes('adventurous') || theme.name === 'Adventure Seekers') {
      goals.push('exciting_romance', 'travel_companion');
    }
    if (traits.includes('intellectual') || theme.name === 'Intellectual Connections') {
      goals.push('meeting_of_minds', 'philosophical_companion');
    }
    if (traits.includes('artistic') || theme.name === 'Artistic Souls') {
      goals.push('creative_partnership', 'artistic_inspiration');
    }
    
    // Add some general goals
    if (traits.includes('passionate')) goals.push('deep_connection');
    if (traits.includes('supportive')) goals.push('emotional_support');
    if (traits.includes('fun_loving')) goals.push('joyful_companionship');
    if (traits.includes('growth_oriented')) goals.push('mutual_growth');
    
    return goals.slice(0, 4); // Limit to 4 goals
  }

  /**
   * Generate dealbreakers based on traits and dislikes
   */
  private generateDealbreakers(traits: string[], dislikes: string[]): string[] {
    const dealbreakers = [];
    
    // Convert dislikes to dealbreakers
    if (dislikes.includes('dishonesty')) dealbreakers.push('lying');
    if (dislikes.includes('arrogance')) dealbreakers.push('superiority_complex');
    if (dislikes.includes('violence')) dealbreakers.push('aggression');
    if (dislikes.includes('selfishness')) dealbreakers.push('lack_of_empathy');
    if (dislikes.includes('controlling_behavior')) dealbreakers.push('possessiveness');
    
    // Add trait-based dealbreakers
    if (traits.includes('intellectual')) dealbreakers.push('close_mindedness');
    if (traits.includes('family_oriented')) dealbreakers.push('commitment_phobia');
    if (traits.includes('honest')) dealbreakers.push('deception');
    if (traits.includes('independent')) dealbreakers.push('clinginess');
    if (traits.includes('ambitious')) dealbreakers.push('lack_of_drive');
    
    return dealbreakers.slice(0, 5); // Limit to 5 dealbreakers
  }

  /**
   * Generate attraction triggers based on traits and likes
   */
  private generateAttractionTriggers(traits: string[], likes: string[]): string[] {
    const triggers = [];
    
    // Convert likes to attraction triggers
    if (likes.includes('music')) triggers.push('musical_talent');
    if (likes.includes('humor')) triggers.push('makes_me_laugh');
    if (likes.includes('cooking')) triggers.push('culinary_skills');
    if (likes.includes('reading')) triggers.push('literary_discussions');
    if (likes.includes('adventure')) triggers.push('exciting_stories');
    if (likes.includes('helping_others')) triggers.push('kindness_to_others');
    
    // Add trait-based triggers
    if (traits.includes('intellectual')) triggers.push('stimulating_conversation');
    if (traits.includes('romantic')) triggers.push('thoughtful_gestures');
    if (traits.includes('confident')) triggers.push('self_assurance');
    if (traits.includes('empathetic')) triggers.push('emotional_intelligence');
    if (traits.includes('passionate')) triggers.push('enthusiasm');
    
    return triggers.slice(0, 6); // Limit to 6 triggers
  }

  /**
   * Helper methods for random selection
   */
  private selectRandomTraits(count: number): string[] {
    const allTraits = this.personalityTraits.flatMap(category => category.traits);
    return this.selectRandomItems(allTraits, count);
  }

  private selectRandomInterests(count: number): string[] {
    return this.selectRandomItems(this.interests, count);
  }

  private selectRandomDislikes(count: number): string[] {
    return this.selectRandomItems(this.commonDislikes, count);
  }

  private selectRandomItems(array: string[], count: number): string[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private getThemeInterests(theme: SeasonTheme): string[] {
    switch (theme.name) {
      case 'Harvest Romance':
        return ['cooking', 'gardening', 'family_time', 'home_improvement', 'traditional_values'];
      case 'Adventure Seekers':
        return ['hiking', 'sailing', 'exploration', 'travel', 'new_experiences'];
      case 'Intellectual Connections':
        return ['reading', 'debates', 'learning', 'philosophy', 'puzzles'];
      case 'Artistic Souls':
        return ['painting', 'music', 'writing', 'theater', 'creative_expression'];
      default:
        return [];
    }
  }

  /**
   * Store personality seed in database
   */
  private async storePersonalitySeed(agentId: string, seed: PersonalitySeed): Promise<void> {
    const seedJson = JSON.stringify(seed);
    
    await this.pool.query(
      'UPDATE agents SET personality_seed = $1 WHERE id = $2',
      [seedJson, agentId]
    );
  }

  /**
   * Retrieve personality seed from database
   */
  async getPersonalitySeed(agentId: string): Promise<PersonalitySeed | null> {
    try {
      const result = await this.pool.query(
        'SELECT personality_seed FROM agents WHERE id = $1',
        [agentId]
      );
      
      if (result.rows.length > 0 && result.rows[0].personality_seed) {
        return JSON.parse(result.rows[0].personality_seed);
      }
      
      return null;
    } catch (error) {
      console.error('Error retrieving personality seed:', error);
      return null;
    }
  }

  /**
   * Generate a themed social season
   */
  async createSocialSeason(themeName: string, startDate: Date, endDate: Date): Promise<number> {
    const theme = this.seasonThemes.find(t => t.name === themeName) || this.seasonThemes[0];
    
    const result = await this.pool.query(
      `INSERT INTO social_seasons (season_name, theme, start_date, end_date, description, personality_modifiers)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        theme.name,
        theme.name,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        theme.description,
        JSON.stringify(theme.personalityModifiers)
      ]
    );
    
    return result.rows[0].id;
  }

  /**
   * Get available season themes
   */
  getAvailableThemes(): SeasonTheme[] {
    return this.seasonThemes;
  }

  /**
   * Regenerate personality seeds for all agents
   */
  async regenerateAllPersonalitySeeds(seasonTheme?: string): Promise<void> {
    console.log('Regenerating personality seeds for all agents...');
    
    // Clear existing seeds
    await this.pool.query('UPDATE agents SET personality_seed = NULL');
    
    // Generate new seeds
    await this.generateSeasonalPersonalitySeeds(seasonTheme);
    
    console.log('Personality seed regeneration complete!');
  }
} 