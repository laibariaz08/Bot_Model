# WhatsApp Integration Implementation Plan

## Overview
This document outlines the complete step-by-step implementation plan to add WhatsApp integration to your NestJS chatbot backend.

---

## Phase 1: Setup & Configuration

### Task 1.1: Get WhatsApp Credentials
**Time: 1-2 hours**

#### Steps:
1. Go to https://developers.facebook.com
2. Create developer account
3. Go to https://business.facebook.com
4. Create/select business account
5. Create new app (WhatsApp type)
6. Add WhatsApp to app
7. Get/create business WhatsApp phone number
8. Get Phone Number ID and Access Token

#### Deliverables:
- [ ] Phone Number ID
- [ ] Business Account ID
- [ ] Temporary Access Token (for testing)
- [ ] Permanent Access Token (via System User)
- [ ] WhatsApp Business Phone Number

#### What to Save:
```
WHATSAPP_PHONE_NUMBER_ID=120200310302021
WHATSAPP_ACCESS_TOKEN=EAABzbzs...
WHATSAPP_BUSINESS_PHONE_NUMBER=+1234567890
WHATSAPP_VERIFY_TOKEN=random_secure_string_you_create
```

---

### Task 1.2: Update Database Schema
**Time: 30 mins**

#### Current Schema:
```prisma
model Business {
  id              Int       @id @default(autoincrement())
  name            String
  phoneNumber     String    @unique
  ...
}
```

#### Add WhatsApp Fields:
```prisma
model Business {
  id              Int       @id @default(autoincrement())
  name            String
  phoneNumber     String    @unique
  
  // NEW: WhatsApp Configuration
  whatsappPhoneNumberId    String?
  whatsappBusinessPhone    String?    @unique
  whatsappAccessToken      String?    // Store encrypted in production
  whatsappIsActive         Boolean    @default(false)
  
  users           User[]
  chats           Chat[]
  knowledgeBase   KnowledgeBase[]
}
```

#### Commands to Run:
```bash
npx prisma migrate dev --name add_whatsapp_fields
```

#### New Files:
- [ ] Migration file created

---

### Task 1.3: Set Environment Variables
**Time: 10 mins**

#### Create `.env` file (if not exists):
```env
# Database
DATABASE_URL="postgresql://..."

# OpenAI
OPENAI_API_KEY="sk-..."

# WhatsApp Configuration
WHATSAPP_API_VERSION=v18.0
WHATSAPP_API_URL=https://graph.instagram.com
WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN=YOUR_ACCESS_TOKEN
WHATSAPP_BUSINESS_PHONE_NUMBER=YOUR_BUSINESS_NUMBER
WHATSAPP_VERIFY_TOKEN=your_custom_verify_token_here

# Webhook
WEBHOOK_BASE_URL=http://localhost:3000  # Change to https://yourdomain.com in production
```

#### Add to `.env.example`:
```env
WHATSAPP_API_VERSION=v18.0
WHATSAPP_API_URL=https://graph.instagram.com
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_BUSINESS_PHONE_NUMBER=
WHATSAPP_VERIFY_TOKEN=
WEBHOOK_BASE_URL=
```

#### Files to Update:
- [ ] `.env` updated
- [ ] `.env.example` updated

---

## Phase 2: Backend Implementation

### Task 2.1: Create WhatsApp Service
**Time: 2 hours**

#### New File: `src/whatsapp/whatsapp.service.ts`

This service will handle all WhatsApp API communications.

**Responsibilities:**
- Send text messages to users
- Send template messages
- Send media (images, documents)
- Handle message status updates
- Retry failed messages

**Key Methods:**
```typescript
// Send message to user
sendMessage(userPhone: string, message: string): Promise<{status: string, messageId: string}>

// Send template message (pre-approved)
sendTemplateMessage(userPhone: string, template: string, params: any[]): Promise

// Send media
sendMedia(userPhone: string, mediaUrl: string, type: 'image'|'document'): Promise

// Mark message as read
markAsRead(messageId: string): Promise

// Get message status
getMessageStatus(messageId: string): Promise
```

#### Implementation Outline:
```typescript
@Injectable()
export class WhatsAppService {
  private readonly apiUrl = process.env.WHATSAPP_API_URL;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  async sendMessage(userPhone: string, text: string) {
    // Make HTTP POST to WhatsApp API
    // Endpoint: /{PHONE_NUMBER_ID}/messages
    // Body: { messaging_product, to, type, text }
    // Return: messageId and status
  }

  async markAsRead(messageId: string) {
    // Make HTTP POST to mark message as read
  }
}
```

#### Files to Create:
- [ ] `src/whatsapp/whatsapp.service.ts`
- [ ] `src/whatsapp/whatsapp.service.spec.ts`

---

### Task 2.2: Create WhatsApp Module
**Time: 30 mins**

#### New File: `src/whatsapp/whatsapp.module.ts`

**Contents:**
```typescript
import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
```

#### Files to Create:
- [ ] `src/whatsapp/whatsapp.module.ts`
- [ ] `src/whatsapp/index.ts` (for exports)

---

### Task 2.3: Update Chat Controller - Add Webhook Verification
**Time: 30 mins**

#### Current Code:
```typescript
@Post('webhook')
async handleMessage(@Body() body: any) {
  // Process message
}
```

#### Updated Code:
```typescript
// GET request for webhook verification
@Get('webhook')
verifyWebhook(
  @Query('hub.mode') mode: string,
  @Query('hub.challenge') challenge: string,
  @Query('hub.verify_token') token: string,
): any {
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return parseInt(challenge); // ← WhatsApp expects integer response
  }
  return 'Unauthorized';
}

// POST request for incoming messages
@Post('webhook')
async handleMessage(@Body() body: any) {
  try {
    // Validate webhook signature (for security)
    
    // Extract message from nested WhatsApp format
    const message = this.extractMessage(body);
    
    if (!message) return { success: true }; // Acknowledge all webhooks
    
    // Process message
    const reply = await this.processIncomingMessage(message);
    
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

private extractMessage(body: any) {
  // Extract from WhatsApp webhook format
  // Return: { userPhone, businessPhone, text, messageId }
}
```

#### Files to Update:
- [ ] `src/chat/chat.controller.ts` (GET handler + webhook verification)

---

### Task 2.4: Update Chat Service - Message Processing
**Time: 1 hour**

#### Current Methods to Enhance:
```typescript
// Already exists
findBusinessByPhone(phoneNumber: string)
findOrCreateChat(userPhone, businessId)
saveMessage(chatId, sender, content)
getChatHistory(chatId)
getKnowledge(businessId)
```

#### New Methods Needed:
```typescript
// Get business by WhatsApp phone number specifically
async findBusinessByWhatsAppPhone(whatsappPhone: string) {
  return this.prisma.business.findUnique({
    where: { whatsappBusinessPhone: whatsappPhone }
  });
}

// Save message with WhatsApp message ID (for status tracking)
async saveMessageWithWhatsAppId(chatId: number, sender: string, content: string, whatsappMessageId: string) {
  // Save message + link to WhatsApp message ID
}

// Get business with WhatsApp configuration
async getBusinessWithWhatsAppConfig(businessId: number) {
  return this.prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      whatsappPhoneNumberId: true,
      whatsappAccessToken: true,
    }
  });
}
```

#### Files to Update:
- [ ] `src/chat/chat.service.ts` (add new methods)

---

### Task 2.5: Update App Module - Add WhatsApp Module
**Time: 15 mins**

#### Current:
```typescript
@Module({
  imports: [ChatModule, AiModule, PrismaModule, ConversationModule, OrderModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

#### Updated:
```typescript
@Module({
  imports: [
    ChatModule,
    AiModule,
    PrismaModule,
    ConversationModule,
    OrderModule,
    WhatsAppModule,  // ← Add this
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

#### Files to Update:
- [ ] `src/app.module.ts`

---

### Task 2.6: Integrate WhatsApp Service into Chat Controller
**Time: 1 hour**

#### Update `handleMessage` to:
1. Extract WhatsApp message details
2. Find correct business
3. Send response back via WhatsApp API
4. Save conversation

#### Pseudo Code:
```typescript
async handleMessage(@Body() body: any) {
  const message = this.extractWhatsAppMessage(body);
  
  // Find business
  const business = await this.chatService.findBusinessByWhatsAppPhone(
    message.recipientPhone
  );
  
  if (!business || !business.whatsappIsActive) {
    return { success: false };
  }
  
  // Create/find chat
  const chat = await this.chatService.findOrCreateChat(
    message.senderPhone,
    business.id
  );
  
  // Save incoming message
  await this.chatService.saveMessage(chat.id, 'user', message.text);
  
  // Get AI response
  const aiResponse = await this.aiService.getResponse(message.text);
  
  // Send via WhatsApp
  const result = await this.whatsAppService.sendMessage(
    message.senderPhone,
    aiResponse
  );
  
  // Save outgoing message
  await this.chatService.saveMessage(chat.id, 'assistant', aiResponse);
  
  return { success: true, messageId: result.messageId };
}
```

#### Files to Update:
- [ ] `src/chat/chat.controller.ts` (enhance handleMessage)

---

## Phase 3: Security & Validation

### Task 3.1: Add Webhook Signature Verification
**Time: 30 mins**

#### Why:
- Verify that webhooks actually come from WhatsApp
- Prevent fake/malicious webhook calls

#### Implementation:
```typescript
// In chat.controller.ts
private validateWebhookSignature(body: any, signature: string): boolean {
  const crypto = require('crypto');
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(body)
    .digest('hex');
    
  return expected === signature;
}
```

#### Files to Update:
- [ ] `src/chat/chat.controller.ts` (add validation)
- [ ] `.env` (add WHATSAPP_APP_SECRET)

---

### Task 3.2: Add Input Validation
**Time: 30 mins**

#### Create DTO:
```typescript
// src/whatsapp/dto/incoming-message.dto.ts
export class IncomingWhatsAppMessageDto {
  @IsPhoneNumber()
  userPhone: string;

  @IsPhoneNumber()
  businessPhone: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  messageId: string;
}
```

#### Files to Create:
- [ ] `src/whatsapp/dto/incoming-message.dto.ts`

---

### Task 3.3: Add Rate Limiting
**Time: 45 mins**

#### Why:
- Prevent abuse
- Handle WhatsApp API rate limits
- Prevent spam

#### Implementation:
```typescript
// Install: npm install @nestjs/throttler

import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // 60 seconds
      limit: 10, // 10 requests per ttl
    }),
  ],
})
export class AppModule {}

// On controller:
@UseGuards(ThrottlerGuard)
@Post('webhook')
async handleMessage(@Body() body: any) { ... }
```

#### Files to Update:
- [ ] `src/app.module.ts` (add ThrottlerModule)
- [ ] `src/chat/chat.controller.ts` (add guard)

---

## Phase 4: Testing

### Task 4.1: Unit Tests for WhatsApp Service
**Time: 1.5 hours**

#### Test Cases:
```typescript
// whatsapp.service.spec.ts
describe('WhatsAppService', () => {
  it('should send text message', async () => { });
  it('should handle rate limits', async () => { });
  it('should retry failed messages', async () => { });
  it('should throw error on invalid token', async () => { });
});
```

#### Files to Create:
- [ ] `src/whatsapp/whatsapp.service.spec.ts` (comprehensive tests)

---

### Task 4.2: Integration Tests
**Time: 2 hours**

#### Test Cases:
```typescript
// src/chat/chat.e2e-spec.ts
describe('WhatsApp Webhook (e2e)', () => {
  it('should verify webhook', async () => {
    // GET /chat/webhook?hub.mode=subscribe...
  });
  
  it('should receive and process message', async () => {
    // POST /chat/webhook with WhatsApp message
  });
  
  it('should route to correct business', async () => {
    // Verify message goes to right business
  });
  
  it('should save message to database', async () => { });
  
  it('should send response via WhatsApp API', async () => { });
});
```

#### Files to Update/Create:
- [ ] `test/chat.e2e-spec.ts` (add WhatsApp tests)

---

### Task 4.3: Manual Testing Checklist
**Time: 2 hours**

#### Using Postman:
- [ ] Test webhook verification (GET)
- [ ] Test message reception (POST)
- [ ] Verify business routing
- [ ] Check database records
- [ ] Verify AI response

#### Using ngrok (local testing):
```bash
# Terminal 1: Start NestJS
npm run start:dev

# Terminal 2: Start ngrok
ngrok http 3000
# Get URL: https://xxxxx.ngrok.io

# WhatsApp Dashboard: Set webhook URL to:
# https://xxxxx.ngrok.io/chat/webhook
```

#### Testing Scenarios:
- [ ] Test with valid business phone
- [ ] Test with invalid business phone
- [ ] Test with multiple users to same business
- [ ] Test webhook verification
- [ ] Test rate limiting
- [ ] Test with special characters
- [ ] Test with media (if implementing)

---

## Phase 5: Deployment

### Task 5.1: Prepare Production Environment
**Time: 30 mins**

#### Requirements:
- [ ] Valid HTTPS domain
- [ ] SSL certificate
- [ ] Production database
- [ ] Environment variables set

#### Update Files:
- [ ] `.env.production` created with:
  - WEBHOOK_BASE_URL=https://yourdomain.com
  - Real WhatsApp credentials
  - Permanent access token

---

### Task 5.2: Deploy to Production
**Time: 1 hour (depending on hosting)**

#### Steps:
1. Push code to git
2. Deploy to server (Heroku, AWS, DigitalOcean, etc.)
3. Update WhatsApp webhook URL in Meta dashboard
4. Run Prisma migrations: `npx prisma migrate deploy`
5. Test webhook verification
6. Test with real message

#### Files/Configs:
- [ ] Deployment configuration ready
- [ ] Database migrations run
- [ ] Environment variables set in production

---

### Task 5.3: Set Webhook URL in WhatsApp Dashboard
**Time: 15 mins**

#### In Meta Dashboard:
1. Go to App Settings
2. Find WhatsApp settings
3. Set Webhook URL: `https://yourdomain.com/chat/webhook`
4. Set Verify Token: (same as `WHATSAPP_VERIFY_TOKEN` in .env)
5. Click Verify and Save
6. Subscribe to "messages" webhook

#### What to Verify:
- [ ] Webhook URL is HTTPS
- [ ] URL is publicly accessible
- [ ] Verify Token matches environment variable
- [ ] Green checkmark appears in Meta dashboard

---

## Phase 6: Monitoring & Maintenance

### Task 6.1: Add Logging
**Time: 1 hour**

#### Log Events:
- Incoming messages
- API errors
- Rate limit hits
- Failed sends
- Message delivery status

#### Implementation:
```typescript
// Use Winston or similar
import * as winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

#### Files to Update:
- [ ] `src/main.ts` (add logging)
- [ ] Service files (add logger)

---

### Task 6.2: Add Error Handling & Alerts
**Time: 1 hour**

#### Handle:
- Token expiration
- Rate limit exceeded
- Invalid phone numbers
- API timeouts
- Database errors

#### Implementation:
```typescript
try {
  await this.whatsAppService.sendMessage(...);
} catch (error) {
  if (error.code === 1026) {
    // Invalid token - alert admin
    logger.error('WhatsApp token expired');
  }
  // ... handle other errors
}
```

#### Files to Update:
- [ ] `src/whatsapp/whatsapp.service.ts` (error handling)
- [ ] `src/chat/chat.controller.ts` (error handling)

---

### Task 6.3: Add Metrics & Monitoring
**Time: 1 hour**

#### Track:
- Messages sent/received per business
- Response times
- Error rates
- API usage
- Cost tracking

#### Example:
```typescript
// Send message
const start = Date.now();
const result = await this.whatsAppService.sendMessage(...);
const duration = Date.now() - start;

// Log metric
metrics.recordMessageSent(duration, business.id);
```

#### Files to Update:
- [ ] `src/common/metrics.ts` (create)
- [ ] Service files (integrate metrics)

---

## Summary Timeline

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1: Setup | Get credentials, update schema, env vars | 2.5 hours |
| Phase 2: Backend | Services, modules, integration | 5 hours |
| Phase 3: Security | Validation, verification, rate limit | 1.5 hours |
| Phase 4: Testing | Unit, integration, manual | 5.5 hours |
| Phase 5: Deployment | Production prep, deploy | 1.5 hours |
| Phase 6: Monitoring | Logging, alerts, metrics | 3 hours |
| **TOTAL** | | **~19 hours** |

---

## Implementation Checklist

### Phase 1
- [ ] WhatsApp credentials obtained
- [ ] Database schema updated
- [ ] Environment variables set
- [ ] Migration created and tested

### Phase 2
- [ ] WhatsApp service created
- [ ] WhatsApp module created
- [ ] Webhook verification implemented
- [ ] Chat service enhanced
- [ ] Chat controller updated
- [ ] App module updated
- [ ] Integration complete

### Phase 3
- [ ] Webhook signature verification added
- [ ] DTOs created for validation
- [ ] Rate limiting implemented
- [ ] Error handling added

### Phase 4
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Manual testing completed
- [ ] All test scenarios passed

### Phase 5
- [ ] Production environment ready
- [ ] Code deployed
- [ ] Webhook URL registered in Meta
- [ ] Webhook verified in production
- [ ] Tested with real message

### Phase 6
- [ ] Logging implemented
- [ ] Error alerts set up
- [ ] Metrics tracking added
- [ ] Monitoring dashboard created

---

## Key Files to Create/Update

### New Files:
```
src/whatsapp/
  ├── whatsapp.service.ts
  ├── whatsapp.service.spec.ts
  ├── whatsapp.module.ts
  ├── index.ts
  └── dto/
      └── incoming-message.dto.ts

src/common/
  └── metrics.ts
```

### Files to Update:
```
src/
  ├── app.module.ts
  ├── chat/
  │   ├── chat.controller.ts
  │   └── chat.service.ts
  └── main.ts

prisma/
  └── schema.prisma

.env
.env.example
test/
  └── chat.e2e-spec.ts
```

---

## Next Steps After Implementation

1. **Scale message handling** → Add message queues (Bull/BullMQ)
2. **Add media support** → Images, documents, videos
3. **Add template messages** → Pre-approved messaging
4. **Add conversational AI** → Context-aware responses
5. **Add analytics dashboard** → Track conversations
6. **Add multi-channel** → Telegram, Facebook Messenger integration

---

## Resources & Documentation Links

- WhatsApp Cloud API Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
- Meta Developer Dashboard: https://developers.facebook.com
- Business Account Setup: https://business.facebook.com
- Webhook Format: https://developers.facebook.com/docs/whatsapp/webhooks
- API Reference: https://developers.facebook.com/docs/whatsapp/guides

