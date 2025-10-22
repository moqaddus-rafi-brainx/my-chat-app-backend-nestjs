import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, SigninDto } from './dto';
import { Public } from './decorators/public.decorator';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {
  }

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() signupDto: SignupDto) {
      const result = await this.authService.signup(signupDto);
      return {
        success: true,
        message: 'User registered successfully',
        data: result,
      };
    }

  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(@Body() signinDto: SigninDto) {
    const result = await this.authService.signin(signinDto);
    return {
      success: true,
      message: 'User signed in successfully',
      data: result,
    };
  }
}
