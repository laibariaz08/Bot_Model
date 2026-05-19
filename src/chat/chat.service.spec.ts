import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { describe, beforeEach, it } from 'node:test';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
