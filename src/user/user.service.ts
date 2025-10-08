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

    async findAll(query: any={}) {
        const { search } = query;
        
        let users;
        
        // If no search term provided, return all users
        if (!search || typeof search !== 'string' || search.trim() === '') {
            users = await this.userModel.find({}).exec();
        } else {
            // Use regex search only when search term is a valid string
            users = await this.userModel.find({ 
                name: { $regex: search.trim(), $options: 'i' } 
            }).exec();
        }
        
        return {
            success: true,
            message: 'Users retrieved successfully',
            data: users,
        };
    }
}
