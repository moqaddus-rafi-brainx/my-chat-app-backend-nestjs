import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from '../schemas/user.schema';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SignupDto, SigninDto } from './dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private jwtService: JwtService,
    ) {}

    async signup(registerAdminDto: SignupDto): Promise<{ user: any; access_token: string }> {
        const { name, email, password } = registerAdminDto;
    
        // Check if admin user already exists
        const existingUser = await this.userModel.findOne({ email }).exec();
        if (existingUser) {
          throw new ConflictException('User with this email already exists');
        }
    
        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
    
        // Create admin user
        const adminUser = new this.userModel({
          name,
          email,
          password: hashedPassword,
        });
    
        const savedUser = await adminUser.save();
    
        // Generate JWT token
        const payload = { 
          sub: savedUser._id, 
          email: savedUser.email, 
        };
        const access_token = this.jwtService.sign(payload);
    
        // Update last login after JWT creation
        await savedUser.save();
    
        // Return user without password
        const { password: _, ...userWithoutPassword } = savedUser.toObject();
    
        return {
          user: userWithoutPassword,
          access_token,
        };
    }

    async signin(signinAdminDto: SigninDto): Promise<{ user: any; access_token: string; expiresIn: string }> {
        const { email, password } = signinAdminDto;
    
        // Find admin user
        const user = await this.userModel.findOne({ 
          email,
        }).exec();
    
        if (!user) {
          throw new UnauthorizedException('Invalid credentials');
        }

    
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          throw new UnauthorizedException('Invalid credentials');
        }
    
        // Generate JWT token with dynamic expiration
        const payload = { 
          sub: user._id, 
          email: user.email, 
        };
        
        // Set token expiration based on rememberMe
        const expiresIn = '24h'; // 30 days if remember me, otherwise 24 hours
        const access_token = this.jwtService.sign(payload, { expiresIn });
    
        // Update last login using the user object
        await user.save();
    
        // Return user without password
        const { password: _, ...userWithoutPassword } = user.toObject();
    
        return {
          user: userWithoutPassword,
          access_token,
          expiresIn,
        };
      }
}
