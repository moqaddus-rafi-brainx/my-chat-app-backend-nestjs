import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from '../schemas/user.schema';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';


@Injectable()
export class UserService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) {}

    async findAll(query: any={}): Promise<User[]> {
        const { search } = query;
        
        // If no search term provided, return all users
        if (!search || typeof search !== 'string' || search.trim() === '') {
            return this.userModel.find({}).exec();
        }
        
        // Use regex search only when search term is a valid string
        return this.userModel.find({ 
            name: { $regex: search.trim(), $options: 'i' } 
        }).exec();
    }
}
