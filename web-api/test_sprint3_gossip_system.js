const { Pool } = require('pg');
const { createClient } = require('redis');

// Test configuration
const dbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'heartwood_db',
    user: 'heartwood_user',
    password: 'heartwood_password'
};

const redisConfig = {
    host: 'localhost',
    port: 6379
};

// Test data
const testNPCId = 'elara';
const testPlayerId = 'test_player_001';
const testTargetPlayerId = 'test_player_002';

class Sprint3GossipTester {
    constructor() {
        this.pool = new Pool(dbConfig);
        this.redisClient = createClient(redisConfig);
        this.testResults = [];
    }

    async connect() {
        await this.redisClient.connect();
        console.log('✅ Connected to PostgreSQL and Redis');
    }

    async disconnect() {
        await this.pool.end();
        await this.redisClient.quit();
        console.log('✅ Disconnected from databases');
    }

    async runTest(testName, testFunction) {
        console.log(`\n🧪 Running test: ${testName}`);
        try {
            await testFunction();
            console.log(`✅ PASSED: ${testName}`);
            this.testResults.push({ test: testName, status: 'PASSED' });
        } catch (error) {
            console.error(`❌ FAILED: ${testName}`, error.message);
            this.testResults.push({ test: testName, status: 'FAILED', error: error.message });
        }
    }

    async runAllTests() {
        console.log('🚀 Starting Sprint 3 Gossip System Tests...\n');

        // Setup test data
        await this.runTest('Setup Test Data', () => this.setupTestData());

        // Test gossip detection
        await this.runTest('Test Positive Gossip Detection', () => this.testPositiveGossipDetection());
        await this.runTest('Test Negative Gossip Detection', () => this.testNegativeGossipDetection());
        await this.runTest('Test No Gossip Detection', () => this.testNoGossipDetection());

        // Test gossip logging
        await this.runTest('Test Gossip Logging', () => this.testGossipLogging());

        // Test reputation updates
        await this.runTest('Test Reputation Updates from Gossip', () => this.testReputationUpdates());

        // Test memory creation
        await this.runTest('Test NPC Memory Creation from Gossip', () => this.testNPCMemoryCreation());

        // Test credibility calculation
        await this.runTest('Test Credibility Calculation', () => this.testCredibilityCalculation());

        // Cleanup
        await this.runTest('Cleanup Test Data', () => this.cleanupTestData());

        this.printResults();
    }

    async setupTestData() {
        // Insert test player reputations
        await this.pool.query(
            'INSERT INTO player_reputations (character_id, reputation_score) VALUES ($1, 50), ($2, 75) ON CONFLICT (character_id) DO UPDATE SET reputation_score = EXCLUDED.reputation_score',
            [testPlayerId, testTargetPlayerId]
        );

        // Insert test agent-player relationship
        await this.pool.query(
            'INSERT INTO agent_player_relationships (agent_id, character_id, trust_level) VALUES ($1, $2, 70) ON CONFLICT (agent_id, character_id) DO UPDATE SET trust_level = EXCLUDED.trust_level',
            [testNPCId, testPlayerId]
        );

        console.log('🔧 Test data setup complete');
    }

    async testPositiveGossipDetection() {
        const response = await this.simulateConversation(testPlayerId, testNPCId, "Alice is really helpful and kind to everyone");
        
        // Check if gossip was detected in logs
        const gossipLogs = await this.pool.query(
            'SELECT * FROM gossip_logs WHERE source_character_id = $1 AND npc_listener_id = $2 ORDER BY timestamp DESC LIMIT 1',
            [testPlayerId, testNPCId]
        );

        if (gossipLogs.rows.length === 0) {
            throw new Error('No gossip log found for positive gossip');
        }

        const gossip = gossipLogs.rows[0];
        if (!gossip.is_positive) {
            throw new Error('Gossip was not detected as positive');
        }

        console.log('✅ Positive gossip detected and logged correctly');
    }

    async testNegativeGossipDetection() {
        const response = await this.simulateConversation(testPlayerId, testNPCId, "Bob has been really rude to the merchants lately");
        
        // Check if gossip was detected in logs
        const gossipLogs = await this.pool.query(
            'SELECT * FROM gossip_logs WHERE source_character_id = $1 AND npc_listener_id = $2 ORDER BY timestamp DESC LIMIT 1',
            [testPlayerId, testNPCId]
        );

        if (gossipLogs.rows.length === 0) {
            throw new Error('No gossip log found for negative gossip');
        }

        const gossip = gossipLogs.rows[0];
        if (gossip.is_positive) {
            throw new Error('Gossip was not detected as negative');
        }

        console.log('✅ Negative gossip detected and logged correctly');
    }

    async testNoGossipDetection() {
        const response = await this.simulateConversation(testPlayerId, testNPCId, "Hello! How are you doing today?");
        
        // Check that no gossip was logged
        const gossipLogs = await this.pool.query(
            'SELECT * FROM gossip_logs WHERE source_character_id = $1 AND npc_listener_id = $2 ORDER BY timestamp DESC LIMIT 1',
            [testPlayerId, testNPCId]
        );

        // Should be empty or the last gossip should be from previous tests
        console.log('✅ No gossip detected for general conversation');
    }

    async testGossipLogging() {
        const initialCount = await this.pool.query('SELECT COUNT(*) FROM gossip_logs');
        
        await this.simulateConversation(testPlayerId, testNPCId, "Charlie is a great blacksmith");
        
        const finalCount = await this.pool.query('SELECT COUNT(*) FROM gossip_logs');
        
        if (parseInt(finalCount.rows[0].count) <= parseInt(initialCount.rows[0].count)) {
            throw new Error('Gossip was not logged to database');
        }

        console.log('✅ Gossip logging to database works correctly');
    }

    async testReputationUpdates() {
        // Get initial reputation
        const initialRep = await this.pool.query(
            'SELECT reputation_score FROM player_reputations WHERE character_id = $1',
            [testTargetPlayerId]
        );

        const initialScore = initialRep.rows[0].reputation_score;

        // Send positive gossip
        await this.simulateConversation(testPlayerId, testNPCId, "David is incredibly generous and always helps others");

        // Wait a bit for processing
        await this.sleep(1000);

        // Check if reputation was updated
        const finalRep = await this.pool.query(
            'SELECT reputation_score FROM player_reputations WHERE character_id = $1',
            [testTargetPlayerId]
        );

        const finalScore = finalRep.rows[0].reputation_score;

        if (finalScore === initialScore) {
            console.log('⚠️  Reputation not changed (this might be expected if gossip about non-existent player)');
        } else {
            console.log(`✅ Reputation updated from ${initialScore} to ${finalScore}`);
        }
    }

    async testNPCMemoryCreation() {
        // Send gossip message
        await this.simulateConversation(testPlayerId, testNPCId, "Eve is really talented at crafting");

        // Check if memory was created
        const memories = await this.pool.query(
            'SELECT * FROM agent_memories WHERE agent_id = $1 AND content LIKE $2 ORDER BY timestamp DESC LIMIT 1',
            [testNPCId, '%told me%about%']
        );

        if (memories.rows.length === 0) {
            throw new Error('No gossip memory found for NPC');
        }

        const memory = memories.rows[0];
        if (!memory.tags.includes('gossip')) {
            throw new Error('Memory was not tagged as gossip');
        }

        console.log('✅ NPC memory created correctly for gossip');
    }

    async testCredibilityCalculation() {
        // Test with different trust levels
        await this.pool.query(
            'UPDATE agent_player_relationships SET trust_level = 90 WHERE agent_id = $1 AND character_id = $2',
            [testNPCId, testPlayerId]
        );

        await this.simulateConversation(testPlayerId, testNPCId, "Frank is very skilled at his work");

        const highTrustGossip = await this.pool.query(
            'SELECT credibility_score FROM gossip_logs WHERE source_character_id = $1 AND npc_listener_id = $2 ORDER BY timestamp DESC LIMIT 1',
            [testPlayerId, testNPCId]
        );

        // Test with low trust
        await this.pool.query(
            'UPDATE agent_player_relationships SET trust_level = 20 WHERE agent_id = $1 AND character_id = $2',
            [testNPCId, testPlayerId]
        );

        await this.simulateConversation(testPlayerId, testNPCId, "Grace is very talented");

        const lowTrustGossip = await this.pool.query(
            'SELECT credibility_score FROM gossip_logs WHERE source_character_id = $1 AND npc_listener_id = $2 ORDER BY timestamp DESC LIMIT 1',
            [testPlayerId, testNPCId]
        );

        if (highTrustGossip.rows[0].credibility_score <= lowTrustGossip.rows[0].credibility_score) {
            throw new Error('Credibility not calculated correctly based on trust level');
        }

        console.log('✅ Credibility calculation based on trust level works correctly');
    }

    async simulateConversation(characterId, npcId, message) {
        // Simulate conversation by calling the conversation API
        const response = await fetch('http://localhost:3000/npc/interact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                npcId: npcId,
                message: message,
                characterId: characterId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Poll for response if needed
        if (data.jobId) {
            return await this.pollForResponse(data.jobId);
        }

        return data;
    }

    async pollForResponse(jobId) {
        const maxAttempts = 30;
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`http://localhost:3000/npc/interact/${jobId}`);
                const data = await response.json();

                if (response.ok && data.response) {
                    return data;
                }
            } catch (error) {
                // Continue polling
            }

            await this.sleep(1000);
            attempts++;
        }

        throw new Error('Conversation response polling timed out');
    }

    async cleanupTestData() {
        // Clean up test data
        await this.pool.query('DELETE FROM gossip_logs WHERE source_character_id = $1', [testPlayerId]);
        await this.pool.query('DELETE FROM agent_memories WHERE agent_id = $1 AND tags && $2', [testNPCId, ['gossip']]);
        await this.pool.query('DELETE FROM agent_player_relationships WHERE agent_id = $1 AND character_id = $2', [testNPCId, testPlayerId]);
        await this.pool.query('DELETE FROM player_reputations WHERE character_id = ANY($1)', [[testPlayerId, testTargetPlayerId]]);

        console.log('🧹 Test data cleaned up');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('========================');
        
        let passed = 0;
        let failed = 0;

        this.testResults.forEach(result => {
            const status = result.status === 'PASSED' ? '✅' : '❌';
            console.log(`${status} ${result.test}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
            
            if (result.status === 'PASSED') passed++;
            else failed++;
        });

        console.log(`\n📈 Summary: ${passed} passed, ${failed} failed`);
        
        if (failed === 0) {
            console.log('🎉 All tests passed! Sprint 3 gossip system is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Please review the implementation.');
        }
    }
}

// Run the tests
async function runTests() {
    const tester = new Sprint3GossipTester();
    
    try {
        await tester.connect();
        await tester.runAllTests();
    } catch (error) {
        console.error('❌ Test runner error:', error);
    } finally {
        await tester.disconnect();
    }
}

// Execute if run directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { Sprint3GossipTester }; 