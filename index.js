const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { ValidationPipe } = require('@nestjs/common');
const { IoAdapter } = require('@nestjs/platform-socket.io');
const { Server } = require('socket.io');

let app;
let server;
let io;

async function createApp() {
  if (!app) {
    app = await NestFactory.create(AppModule);
    
    app.enableCors({
      origin: [
        process.env.CORS_ORIGIN,
        'https://my-chat-app-frontend-two.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:5174'
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
    
    // Get the HTTP server instance
    server = app.getHttpAdapter().getInstance();
    
    // Create Socket.IO server
    io = new Server(server, {
      cors: {
        origin: [
          process.env.CORS_ORIGIN,
          'https://my-chat-app-frontend-two.vercel.app',
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173',
          'http://localhost:5174'
        ].filter(Boolean),
        credentials: true,
      },
      path: '/socket.io/'
    });
    
    // Configure WebSocket adapter with the Socket.IO server
    app.useWebSocketAdapter(new IoAdapter(app, io));
  }
  return { app, server, io };
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
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174'
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

    // Handle Socket.IO requests
    if (req.url.startsWith('/socket.io/')) {
      console.log('Handling Socket.IO request:', req.url);
      const { server, io } = await createApp();
      if (io) {
        // Let Socket.IO handle the request
        io.engine.handleRequest(req, res);
        return;
      } else {
        console.error('Socket.IO server not available');
        res.status(500).json({ error: 'Socket.IO server not available' });
        return;
      }
    }

    const { server } = await createApp();
    server(req, res);
  } catch (error) {
    console.error('Error in Vercel handler:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
