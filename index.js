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
      origin: [
        process.env.CORS_ORIGIN,
        'https://my-chat-app-frontend-two.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
      ].filter(Boolean),
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
    console.log('Request method:', req.method);
    console.log('Request origin:', req.headers.origin);
    console.log('Request URL:', req.url);
    
    // Set CORS headers manually for Vercel
    const allowedOrigins = [
      process.env.CORS_ORIGIN,
      'https://my-chat-app-frontend-two.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ].filter(Boolean);

    console.log('Allowed origins:', allowedOrigins);

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      console.log('Set CORS origin to:', origin);
    } else {
      console.log('Origin not in allowed list:', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS preflight request');
      res.status(200).end();
      return;
    }

    const app = await createApp();
    const server = app.getHttpAdapter().getInstance();
    server(req, res);
  } catch (error) {
    console.error('Error in Vercel handler:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
