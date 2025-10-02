import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ConversationType } from '../constants';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ trim: true })
  name?: string;

  @Prop({ 
    required: true, 
    enum: ConversationType,
    default: ConversationType.DIRECT 
  })
  type: ConversationType;

  @Prop({ 
    type: [{ type: Types.ObjectId, ref: 'User' }],
    required: true,
    validate: {
      validator: function(members: Types.ObjectId[]) {
        return members.length >= 1;
      },
      message: 'A conversation must have at least 1 member'
    }
  })
  members: Types.ObjectId[];

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

