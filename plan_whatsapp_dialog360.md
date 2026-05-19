# Dialog360 WhatsApp Integration - Complete Implementation Guide

## Complete Implementation Code

---

## Phase 1: Setup & Configuration

### Task 1.1: Install Dependencies
```bash
npm install axios
npm install dotenv
```

---

### Task 1.2: Update Environment Variables

Create/Update `.env` file:
```env
# Server Configuration
NODE_ENV=production
PORT=3000
WEBHOOK_BASE_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/chatbot

# OpenAI
OPENAI_API_KEY=sk-your-key-here

# Dialog360 WhatsApp Configuration
DIALOG360_API_TOKEN=your_api_token_from_dialog360
DIALOG360_PHONE_NUMBER_ID=phone_number_id_from_dialog360
DIALOG360_BUSINESS_PHONE=+1-555-0001
DIALOG360_API_BASE_URL=https://api.dialog360.com/v1
DIALOG360_WEBHOOK_URL=https://yourdomain.com/chat/webhook
WEBHOOK_VERIFY_TOKEN=create_random_string_for_webhook_verification
```

Create `.env.example`:
```env
NODE_ENV=
PORT=
WEBHOOK_BASE_URL=
DATABASE_URL=
OPENAI_API_KEY=
DIALOG360_API_TOKEN=
DIALOG360_PHONE_NUMBER_ID=
DIALOG360_BUSINESS_PHONE=
DIALOG360_API_BASE_URL=
DIALOG360_WEBHOOK_URL=
WEBHOOK_VERIFY_TOKEN=
```

---

### Task 1.3: Update Database Schema

Update `prisma/schema.prisma`:

```prisma
model Business {
  id                    Int       @id @default(autoincrement())
  name                  String
  phoneNumber           String    @unique
  
  // NEW: Dialog360 WhatsApp Configuration
  whatsappPhoneNumberId String?
  whatsappBusinessPhone String?   @unique
  whatsappIsActive      Boolean   @default(false)
  
  createdAt             DateTime  @default(now())

  users                 User[]
  chats                 Chat[]
  knowledgeBase         KnowledgeBase[]
}

model Chat {
  id           Int      @id @default(autoincrement())
  userPhone    String
  businessId   Int
  createdAt    DateTime @default(now())

  business     Business @relation(fields: [businessId], references: [id])
  messages     Message[]
}

model Message {
  id                  Int      @id @default(autoincrement())
  chatId              Int
  sender              String
  content             String
  whatsappMessageId   String?  // Track Dialog360 message ID
  createdAt           DateTime @default(now())

  chat                Chat     @relation(fields: [chatId], references: [id])
}
```

Run migration:
```bash
npx prisma migrate dev --name add_dialog360_whatsapp
```

---

## Phase 2: Create WhatsApp Service

### Task 2.1: Create WhatsApp Service

Create `src/whatsapp/whatsapp.service.ts`:

```typescript
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface IncomingMessage {
  from: string;
  to: string;
  text: string;
  messageId: string;
  timestamp: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: process.env.DIALOG360_API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${process.env.DIALOG360_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Send text message via Dialog360
   */
  async sendMessage(
    userPhone: string,
    message: string,
  ): Promise<SendMessageResponse> {
    try {
      // Validate phone number
      if (!this.isValidPhoneNumber(userPhone)) {
        return {
          success: false,
          error: `Invalid phone number: ${userPhone}`,
        };
      }

      // Format phone number (remove +, just country code + number)
      const formattedPhone = userPhone.replace(/\D/g, '');

      this.logger.debug(`Sending message to ${formattedPhone}: ${message}`);

      const response = await this.apiClient.post('/messages', {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message,
        },
      });

      const messageId = response.data?.messages?.[0]?.id;

      if (messageId) {
        this.logger.log(`Message sent successfully. ID: ${messageId}`);
        return {
          success: true,
          messageId,
        };
      }

      return {
        success: false,
        error: 'No message ID in response',
      };
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(
    userPhone: string,
    templateName: string,
    parameters?: string[],
  ): Promise<SendMessageResponse> {
    try {
      const formattedPhone = userPhone.replace(/\D/g, '');

      const payload: any = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en_US',
          },
        },
      };

      if (parameters && parameters.length > 0) {
        payload.template.parameters = {
          body: {
            parameters,
          },
        };
      }

      const response = await this.apiClient.post('/messages', payload);
      const messageId = response.data?.messages?.[0]?.id;

      return {
        success: !!messageId,
        messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send template message: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    try {
      await this.apiClient.post('/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });

      this.logger.debug(`Marked message ${messageId} as read`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to mark message as read: ${error.message}`);
      return false;
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<string | null> {
    try {
      const response = await this.apiClient.get(`/messages/${messageId}`);
      return response.data?.status || null;
    } catch (error) {
      this.logger.error(`Failed to get message status: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // Check if at least 10 digits (minimum for most countries)
    return digits.length >= 10 && digits.length <= 15;
  }

  /**
   * Parse incoming webhook message
   */
  parseIncomingMessage(body: any): IncomingMessage | null {
    try {
      const message = body?.messages?.[0];
      if (!message) {
        return null;
      }

      return {
        from: message.from,
        to: body?.metadata?.display_phone_number,
        text: message.text?.body || '',
        messageId: message.id,
        timestamp: message.timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to parse incoming message: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate webhook signature (if Dialog360 provides HMAC)
   */
  validateWebhookSignature(body: string, signature: string): boolean {
    // Dialog360 may provide X-Hub-Signature header
    // Implement signature validation if provided by Dialog360
    // For now, return true as Dialog360 documentation doesn't require it
    return true;
  }
}
```

---

### Task 2.2: Create WhatsApp Module

Create `src/whatsapp/whatsapp.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

@Module({
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
```

---

## Phase 3: Update Chat Controller

### Task 3.1: Update Chat Controller with Webhook Handling

Update `src/chat/chat.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { AiService } from '../ai/ai.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

interface WebhookPayload {
  messages?: Array<{
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: { body: string };
  }>;
  metadata?: {
    display_phone_number: string;
    phone_number_id: string;
  };
}

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private chatService: ChatService,
    private aiService: AiService,
    private whatsAppService: WhatsAppService,
  ) {}

  /**
   * Webhook verification endpoint (GET)
   * Dialog360 sends this to verify your webhook
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
  ): any {
    this.logger.log('Webhook verification request received');

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      this.logger.log('Webhook verified successfully');
      return { 'hub.challenge': challenge };
    }

    this.logger.warn('Webhook verification failed - invalid token');
    return { error: 'Unauthorized' };
  }

  /**
   * Incoming message webhook (POST)
   * Dialog360 sends incoming messages here
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleMessage(@Body() body: WebhookPayload): Promise<any> {
    this.logger.debug(`Webhook received: ${JSON.stringify(body)}`);

    try {
      // Parse incoming message
      const incomingMessage =
        this.whatsAppService.parseIncomingMessage(body);

      if (!incomingMessage) {
        this.logger.warn('Could not parse incoming message');
        return { success: true }; // Still return 200 to acknowledge
      }

      const {
        from: userPhone,
        to: businessPhone,
        text: messageText,
        messageId,
      } = incomingMessage;

      this.logger.log(
        `Processing message from ${userPhone} to ${businessPhone}`,
      );

      // Step 1: Find business by WhatsApp phone number
      const business = await this.chatService.findBusinessByWhatsAppPhone(
        businessPhone,
      );

      if (!business || !business.whatsappIsActive) {
        this.logger.warn(
          `Business not found or WhatsApp not active for: ${businessPhone}`,
        );
        return { success: true };
      }

      this.logger.log(`Business found: ${business.id} (${business.name})`);

      // Step 2: Find or create chat
      const chat = await this.chatService.findOrCreateChat(
        userPhone,
        business.id,
      );

      this.logger.log(`Chat found/created: ${chat.id}`);

      // Step 3: Save incoming message
      await this.chatService.saveMessage(
        chat.id,
        'user',
        messageText,
        messageId,
      );

      this.logger.log(`Incoming message saved`);

      // Step 4: Get context (chat history + knowledge base)
      const history = await this.chatService.getChatHistory(chat.id);
      const knowledge = await this.chatService.getKnowledge(business.id);

      this.logger.debug(
        `History: ${history.length} messages, Knowledge: ${knowledge.length} items`,
      );

      // Step 5: Generate AI response
      let aiResponse = await this.aiService.getResponse(messageText);

      if (!aiResponse) {
        aiResponse =
          'Sorry, I could not process your request. Please try again.';
      }

      this.logger.log(`AI response generated: ${aiResponse.substring(0, 50)}...`);

      // Step 6: Send response via Dialog360
      const sendResult = await this.whatsAppService.sendMessage(
        userPhone,
        aiResponse,
      );

      if (!sendResult.success) {
        this.logger.error(`Failed to send message: ${sendResult.error}`);
        // Still save the message for logging purposes
        await this.chatService.saveMessage(chat.id, 'assistant', aiResponse);
        return { success: true };
      }

      this.logger.log(
        `Message sent successfully. ID: ${sendResult.messageId}`,
      );

      // Step 7: Save outgoing message
      await this.chatService.saveMessage(
        chat.id,
        'assistant',
        aiResponse,
        sendResult.messageId,
      );

      return { success: true, messageId: sendResult.messageId };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`);
      return { success: true }; // Return 200 to prevent retries
    }
  }

  /**
   * Test endpoint to manually send a message (for development)
   */
  @Post('test-send')
  async testSendMessage(
    @Body() body: { businessId: number; userPhone: string; message: string },
  ): Promise<any> {
    try {
      const { businessId, userPhone, message } = body;

      const business = await this.chatService.getBusinessById(businessId);

      if (!business) {
        return { success: false, error: 'Business not found' };
      }

      const result = await this.whatsAppService.sendMessage(
        userPhone,
        message,
      );

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

---

## Phase 4: Update Chat Service

### Task 4.1: Update Chat Service

Update `src/chat/chat.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Find business by WhatsApp phone number
   */
  async findBusinessByWhatsAppPhone(phoneNumber: string) {
    return this.prisma.business.findUnique({
      where: { whatsappBusinessPhone: phoneNumber },
    });
  }

  /**
   * Find business by ID
   */
  async getBusinessById(businessId: number) {
    return this.prisma.business.findUnique({
      where: { id: businessId },
    });
  }

  /**
   * Find or create chat
   */
  async findOrCreateChat(userPhone: string, businessId: number) {
    let chat = await this.prisma.chat.findFirst({
      where: {
        userPhone,
        businessId,
      },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: {
          userPhone,
          businessId,
        },
      });
    }

    return chat;
  }

  /**
   * Save message with optional WhatsApp message ID
   */
  async saveMessage(
    chatId: number,
    sender: string,
    content: string,
    whatsappMessageId?: string,
  ) {
    return this.prisma.message.create({
      data: {
        chatId,
        sender,
        content,
        whatsappMessageId,
      },
    });
  }

  /**
   * Get chat history (last 10 messages for context)
   */
  async getChatHistory(chatId: number) {
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
  }

  /**
   * Get business knowledge base
   */
  async getKnowledge(businessId: number) {
    return this.prisma.knowledgeBase.findMany({
      where: { businessId },
    });
  }
}
```

---

## Phase 5: Update App Module

### Task 5.1: Update App Module

Update `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { AiModule } from './ai/ai.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConversationModule } from './conversation/conversation.module';
import { OrderModule } from './order/order.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ChatModule,
    AiModule,
    PrismaModule,
    ConversationModule,
    OrderModule,
    WhatsAppModule, // ← Add this
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

---

## Phase 6: Hosting Setup & Deployment

### Task 6.1: Choose Hosting Platform

#### Option A: Heroku (Easiest for beginners)
**Pros:** Git push to deploy, free tier available, automatic HTTPS
**Cons:** Free tier is limited

**Steps:**
1. Create account at https://heroku.com
2. Install Heroku CLI
3. Run: `heroku login`

#### Option B: DigitalOcean App Platform
**Pros:** Simple interface, affordable ($5-12/month)
**Cons:** Slightly more setup

#### Option C: AWS/Google Cloud
**Pros:** Most scalable, pay-as-you-go
**Cons:** Complex setup, steeper learning curve

### Task 6.2: Deploy to Heroku (Recommended for beginners)

#### Step 1: Create Heroku App

```bash
# Login to Heroku
heroku login

# Create new app
heroku create your-app-name

# Or connect existing app
heroku git:remote -a your-app-name
```

#### Step 2: Add PostgreSQL Database

```bash
# Add Postgres add-on
heroku addons:create heroku-postgresql:hobby-dev --app your-app-name

# Get database URL
heroku config:get DATABASE_URL --app your-app-name
# Copy this URL
```

#### Step 3: Create `Procfile` in project root

Create `Procfile`:
```
release: npx prisma migrate deploy
web: node dist/main.js
```

#### Step 4: Update `package.json` Build Scripts

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch"
  }
}
```

#### Step 5: Set Environment Variables on Heroku

```bash
# Get your app URL first
heroku config:get APP_URL --app your-app-name
# If not set, get it from: heroku apps:info your-app-name

# Set all environment variables
heroku config:set \
  NODE_ENV=production \
  PORT=3000 \
  DATABASE_URL=postgresql://... \
  OPENAI_API_KEY=sk-... \
  DIALOG360_API_TOKEN=your_token \
  DIALOG360_PHONE_NUMBER_ID=123456 \
  DIALOG360_BUSINESS_PHONE=+1-555-0001 \
  DIALOG360_API_BASE_URL=https://api.dialog360.com/v1 \
  DIALOG360_WEBHOOK_URL=https://your-app-name.herokuapp.com/chat/webhook \
  WEBHOOK_VERIFY_TOKEN=your_random_token \
  --app your-app-name
```

#### Step 6: Deploy Code

```bash
# Push to Heroku
git push heroku main

# OR if your branch is not main:
git push heroku your-branch:main

# View logs
heroku logs --tail --app your-app-name
```

#### Step 7: Verify Deployment

```bash
# Get app URL
heroku apps:info your-app-name

# Test webhook verification endpoint
curl "https://your-app-name.herokuapp.com/chat/webhook?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=your_random_token"

# Should return: {"hub.challenge":"test123"}
```

---

### Task 6.3: Deploy to DigitalOcean (Alternative)

#### Step 1: Create DigitalOcean Account
Go to https://digitalocean.com

#### Step 2: Create App

1. Click "Create" → "App"
2. Connect GitHub repo
3. Select branch: `main`
4. Choose Node.js runtime
5. Click "Create App"

#### Step 3: Configure Environment Variables

In App Settings → Environment:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
DIALOG360_API_TOKEN=your_token
DIALOG360_PHONE_NUMBER_ID=123456
DIALOG360_BUSINESS_PHONE=+1-555-0001
DIALOG360_API_BASE_URL=https://api.dialog360.com/v1
DIALOG360_WEBHOOK_URL=https://your-app-name.ondigitalocean.app/chat/webhook
WEBHOOK_VERIFY_TOKEN=your_random_token
```

#### Step 4: Create Database

1. In DigitalOcean console
2. Databases → Create Database
3. Choose PostgreSQL
4. Copy connection string
5. Add to environment variables

#### Step 5: Deploy

Push to GitHub → Automatic deployment

#### Step 6: Get Public URL

```
https://your-app-name.ondigitalocean.app
```

---

### Task 6.4: Configure Dialog360 Webhook URL

**After deployment:**

1. Go to Dialog360 Dashboard
2. Settings → Webhooks
3. Enter Webhook URL:
   - Heroku: `https://your-app-name.herokuapp.com/chat/webhook`
   - DigitalOcean: `https://your-app-name.ondigitalocean.app/chat/webhook`
4. Enter Verify Token: (must match `WEBHOOK_VERIFY_TOKEN`)
5. Click "Verify"
6. Should see: ✓ Verified
7. Subscribe to: `messages` webhook

---

## Phase 7: Testing

### Task 7.1: Test Webhook Verification

```bash
# Get your app URL and verify token
WEBHOOK_URL=https://your-app-name.herokuapp.com/chat/webhook
VERIFY_TOKEN=your_random_token

# Test verification
curl "${WEBHOOK_URL}?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=${VERIFY_TOKEN}"

# Should return: {"hub.challenge":"test123"}
```

### Task 7.2: Test Manual Message Send

Using Postman or curl:

```bash
POST http://localhost:3000/chat/test-send
Content-Type: application/json

{
  "businessId": 1,
  "userPhone": "919876543210",
  "message": "Hello! This is a test message."
}
```

### Task 7.3: Test Full Flow

1. Go to Dialog360 Dashboard
2. Send test message from their test number
3. Check your webhook logs
4. Verify message appears in database
5. Check if response was sent back

---

## Complete .env Example

```env
# Application
NODE_ENV=production
PORT=3000
WEBHOOK_BASE_URL=https://your-app-name.herokuapp.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/chatbot

# AI
OPENAI_API_KEY=sk-proj-xxx...

# Dialog360 WhatsApp
DIALOG360_API_TOKEN=dialog360_xxx_token_here
DIALOG360_PHONE_NUMBER_ID=1234567890
DIALOG360_BUSINESS_PHONE=+1-555-0001
DIALOG360_API_BASE_URL=https://api.dialog360.com/v1
DIALOG360_WEBHOOK_URL=https://your-app-name.herokuapp.com/chat/webhook
WEBHOOK_VERIFY_TOKEN=abc123def456ghi789

# Optional: For more security
LOG_LEVEL=info
```

---

## Troubleshooting Deployment

### Issue: Webhook not receiving messages

**Solution:**
1. Verify webhook URL in Dialog360 is correct and public
2. Ensure WEBHOOK_VERIFY_TOKEN matches in both places
3. Check app logs: `heroku logs --tail`
4. Test manually with curl first

### Issue: Database connection error

**Solution:**
1. Verify DATABASE_URL is correct
2. Run migrations: `heroku run npx prisma migrate deploy`
3. Check database is running

### Issue: CORS errors

**Solution:**
```typescript
// In main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
```

### Issue: Token expired

**Solution:**
1. Generate new token in Dialog360
2. Update environment variable
3. Redeploy

---

## Summary Checklist

- [ ] Dialog360 account created
- [ ] API token obtained
- [ ] Phone number connected
- [ ] `.env` file created with credentials
- [ ] Database schema updated
- [ ] WhatsApp service created
- [ ] Chat controller updated
- [ ] Code deployed to hosting
- [ ] Webhook URL registered in Dialog360
- [ ] Webhook verified (✓ in Dialog360)
- [ ] Test message sent successfully
- [ ] Response received back via WhatsApp

---

## Quick Commands Reference

```bash
# Development
npm run start:dev

# Build
npm run build

# Database
npx prisma migrate dev
npx prisma migrate deploy
npx prisma studio

# Heroku
heroku logs --tail
heroku config:set KEY=value
heroku ps:scale web=1

# Test webhook
curl "http://localhost:3000/chat/webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=token"
```

