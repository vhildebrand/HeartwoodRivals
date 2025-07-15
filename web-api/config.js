module.exports = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
    },
    database: {
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'heartwood_db',
      user: process.env.DB_USER || 'heartwood_user',
      password: process.env.DB_PASSWORD || 'heartwood_password'
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://redis:6379'
    },
    server: {
      port: parseInt(process.env.PORT || '3000'),
      environment: process.env.NODE_ENV || 'development'
    }
  }; 