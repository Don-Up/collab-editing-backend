import { Test, TestingModule } from '@nestjs/testing';
import { TextGateway } from './text.gateway';

describe('TextGateway', () => {
  let gateway: TextGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TextGateway],
    }).compile();

    gateway = module.get<TextGateway>(TextGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
