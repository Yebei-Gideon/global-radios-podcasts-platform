import { Controller, Get } from '@nestjs/common';

@Controller('')
export class AppController {

  constructor() { }

  // health check endpoint
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
