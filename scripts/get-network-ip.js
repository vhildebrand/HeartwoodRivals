#!/usr/bin/env node
const os = require('os');

function getNetworkIP() {
    const interfaces = os.networkInterfaces();
    
    console.log('🌐 Network Configuration for Local WiFi Access');
    console.log('================================================');
    
    // Find all non-localhost IPv4 addresses
    const networkIPs = [];
    
    for (const interfaceName in interfaces) {
        const interfaceAddresses = interfaces[interfaceName];
        
        for (const addr of interfaceAddresses) {
            // Skip non-IPv4, internal addresses, and localhost
            if (addr.family === 'IPv4' && !addr.internal && addr.address !== '127.0.0.1') {
                networkIPs.push({
                    interface: interfaceName,
                    address: addr.address
                });
            }
        }
    }
    
    if (networkIPs.length === 0) {
        console.log('❌ No network IP addresses found.');
        console.log('   Make sure you are connected to WiFi or ethernet.');
        return;
    }
    
    console.log('📍 Available Network IP Addresses:');
    networkIPs.forEach((ip, index) => {
        console.log(`   ${index + 1}. ${ip.address} (${ip.interface})`);
    });
    
    const primaryIP = networkIPs[0].address;
    
    console.log('\n🚀 To enable network access:');
    console.log(`   1. Use IP address: ${primaryIP}`);
    console.log(`   2. Access the game at: http://${primaryIP}:5173`);
    console.log(`   3. Others on your network can also use this URL`);
    
    console.log('\n💡 Optional: Create client/.env.local with:');
    console.log(`   VITE_HOST=${primaryIP}`);
    
    console.log('\n✅ No other changes needed - the client will auto-detect!');
    
    return primaryIP;
}

if (require.main === module) {
    getNetworkIP();
}

module.exports = getNetworkIP; 