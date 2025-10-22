import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configure WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));
  
  app.enableCors({
    origin: [
      process.env.CORS_ORIGIN,
      process.env.FRONTEND_URL,
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
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

// For Vercel serverless
if (process.env.NODE_ENV === 'production') {
  bootstrap();
} else {
  bootstrap();
}
