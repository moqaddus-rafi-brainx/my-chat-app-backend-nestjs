import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}


  @Get()
  async findAll(@Query() query: any) {
    return this.userService.findAll(query);
  }
}
