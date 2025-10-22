import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): any {
    return {
      message: 'Chat App Backend API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        auth: '/api/v1/auth',
        conversations: '/api/v1/conversation',
        messages: '/api/v1/message',
        users: '/api/v1/user'
      },
      documentation: 'Visit /api/v1 for API endpoints'
    };
  }

  @Get('health')
  getHealth(): any {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }
}
