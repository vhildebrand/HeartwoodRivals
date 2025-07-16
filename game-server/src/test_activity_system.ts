/**
 * Test script for the new Activity System
 * Demonstrates how agents can be given different activities and execute them
 */

import { WorldLocationRegistry } from './systems/WorldLocationRegistry';
import { ActivityManifest } from './systems/ActivityManifest';
import { ActivityManager } from './systems/ActivityManager';
import { Activity } from './systems/Activity';

// Mock agent for testing
const mockAgent = {
  data: {
    id: 'test_agent',
    name: 'Test Agent',
    current_activity: 'idle',
    current_location: 'town_square',
    energy_level: 100,
    mood: 'happy'
  },
  schema: {
    x: 120,
    y: 80,
    currentActivity: 'idle',
    currentLocation: 'town_square',
    energyLevel: 100,
    mood: 'happy',
    lastUpdate: Date.now()
  },
  stateMachine: {
    getState: () => 'idle',
    transitionTo: (state: string, data?: any) => {
      console.log(`🔄 Agent state transition: ${state}`);
      return true;
    }
  },
  pathfinding: {
    findPath: (start: any, end: any) => {
      console.log(`🧭 Finding path from (${start.x},${start.y}) to (${end.x},${end.y})`);
      return [start, end]; // Simple path
    }
  },
  activityManager: null as any // Will be set after creation
};

// Set up activity manager
mockAgent.activityManager = new ActivityManager(mockAgent as any);

async function testActivitySystem() {
  console.log('🧪 Testing Activity System...\n');
  
  // Test 1: Load and display location registry
  console.log('=== Test 1: Location Registry ===');
  const locationRegistry = WorldLocationRegistry.getInstance();
  
  console.log('📍 Finding locations for "eating":');
  const eatingLocations = locationRegistry.findLocationsByTags(['food', 'eating']);
  eatingLocations.slice(0, 3).forEach(loc => {
    console.log(`  - ${loc.displayName} (${loc.id}): ${loc.tags.join(', ')}`);
  });
  
  console.log('\n📍 Finding locations for "work":');
  const workLocations = locationRegistry.findLocationsByTags(['work', 'crafting']);
  workLocations.slice(0, 3).forEach(loc => {
    console.log(`  - ${loc.displayName} (${loc.id}): ${loc.tags.join(', ')}`);
  });
  
  // Test 2: Activity Manifest
  console.log('\n=== Test 2: Activity Manifest ===');
  const activityManifest = ActivityManifest.getInstance();
  
  console.log('🎭 Testing activity lookup:');
  const activities = ['eating', 'working', 'smithing', 'go_to_town_square', 'morning_meditation', 'lighthouse_keeping'];
  
  for (const activityName of activities) {
    const activity = activityManifest.getActivity(activityName);
    if (activity) {
      console.log(`  ✅ ${activityName}: ${activity.activityType} - ${activity.description}`);
      console.log(`    Duration: ${activity.duration}, Priority: ${activity.priority}`);
    } else {
      console.log(`  ❌ ${activityName}: Not found`);
    }
  }
  
  // Test 3: Activity Manager
  console.log('\n=== Test 3: Activity Manager ===');
  const activityManager = mockAgent.activityManager;
  
  console.log('🎬 Testing activity requests:');
  
  // Test eating activity
  console.log('\n  📝 Requesting "breakfast" activity:');
  let result = activityManager.requestActivity({
    activityName: 'breakfast',
    priority: 7
  });
  console.log(`    Result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message}`);
  
  // Test alias resolution
  console.log('\n  📝 Testing alias resolution:');
  const aliasTests = [
    'craft fishing equipment and ship fittings',
    'morning set planning and music discovery',
    'field work - planting, harvesting, or maintenance',
    'wake up, check lighthouse operation'
  ];
  
  for (const aliasTest of aliasTests) {
    const resolved = activityManifest.getActivity(aliasTest);
    if (resolved) {
      console.log(`    ✅ "${aliasTest}" → "${resolved.description}"`);
    } else {
      console.log(`    ❌ "${aliasTest}" → Not resolved`);
    }
  }
  
  // Simulate some updates
  console.log('\n  🔄 Simulating activity updates:');
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      activityManager.update();
      console.log(`    Update ${i + 1}: ${activityManager.getStatus()}`);
    }, i * 100);
  }
  
  // Test 4: Complex Activity Sequence
  setTimeout(() => {
    console.log('\n=== Test 4: Complex Activity Sequence ===');
    
    // Clear any existing activity
    activityManager.cancelCurrentActivity();
    activityManager.clearQueue();
    
    // Queue multiple activities
    const activitySequence = [
      { activityName: 'go_to_town_square', priority: 8 },
      { activityName: 'socializing', priority: 6 },
      { activityName: 'smithing', priority: 4 },
      { activityName: 'lunch', priority: 7 }
    ];
    
    console.log('📋 Queueing activity sequence:');
    activitySequence.forEach((activity: { activityName: string; priority: number }) => {
      const result = activityManager.requestActivity(activity);
      console.log(`  - ${activity.activityName}: ${result.success ? 'QUEUED' : 'FAILED'}`);
    });
    
    console.log(`\n🎯 Queue status: ${activityManager.getActivityQueue().length} activities`);
    console.log(`📊 Current status: ${activityManager.getStatus()}`);
    
    // Test 5: Debug Information
    setTimeout(() => {
      console.log('\n=== Test 5: Debug Information ===');
      const debugInfo = activityManager.getDebugInfo();
      console.log('🔍 Activity Manager Debug Info:');
      console.log(JSON.stringify(debugInfo, null, 2));
      
      // Test 6: Suggested Activities
      console.log('\n=== Test 6: Suggested Activities ===');
      const suggestions = activityManager.getSuggestedActivities();
      console.log('💡 Suggested activities for current context:');
      suggestions.forEach((activity: string) => {
        console.log(`  - ${activity}`);
      });
      
      console.log('\n✅ Activity System Test Complete!');
    }, 1000);
  }, 1000);
}

// Run the test
if (require.main === module) {
  testActivitySystem().catch(console.error);
}

export { testActivitySystem }; 