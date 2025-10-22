const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { ValidationPipe } = require('@nestjs/common');
const { IoAdapter } = require('@nestjs/platform-socket.io');

let app;

async function createApp() {
  if (!app) {
    app = await NestFactory.create(AppModule);
    
    // Configure WebSocket adapter
    app.useWebSocketAdapter(new IoAdapter(app));
    
    app.enableCors({
      origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });

    // Enable validation globally
    app.useGlobalPipes(new ValidationPipe());

    // Set global API prefix, but exclude root routes
    app.setGlobalPrefix('api/v1', {
      exclude: ['/', '/health']
    });
    
    await app.init();
  }
  return app;
}

module.exports = async (req, res) => {
  try {
    const app = await createApp();
    const server = app.getHttpAdapter().getInstance();
    server(req, res);
  } catch (error) {
    console.error('Error in Vercel handler:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
