# Meta WhatsApp Cloud API - Complete Setup Guide (Scratch to End)

## Overview
This guide takes you from zero to a working WhatsApp chatbot using Meta's official WhatsApp Cloud API.

**Total Time: 4-5 hours**

---

# PART 1: GETTING META API CREDENTIALS (1.5 hours)

## Step 1: Create Facebook Business Account

### 1.1 Go to Facebook Business
```
URL: https://business.facebook.com
Click: "Create account"
```

### 1.2 Fill Business Details
```
Business Name: Your Business Name
Business Email: your-business@email.com
Business Phone: Your phone number
Business Address: Your address
```

### 1.3 Verify Email
- Check your email
- Click verification link
- Business account is ready

---

## Step 2: Create Meta App

### 2.1 Go to Meta Developers
```
URL: https://developers.facebook.com
Sign in with same Facebook account
```

### 2.2 Create New App
```
Click: "My Apps" (top right)
Click: "Create App"
```

### 2.3 Fill App Details
```
App Name: "Chatbot Backend" (or your name)
App Contact Email: your-email@gmail.com
App Purpose: "Automate messaging for my business"
Click: "Create App"
```

### 2.4 Choose App Type
```
Select: "Business"
Click: "Next"
```

### 2.5 Add WhatsApp Product
```
In left sidebar, look for "Products"
Search for: "WhatsApp"
Click: "Set Up"
```

---

## Step 3: Get WhatsApp Business Account

### 3.1 Choose Setup Type
```
Option A: Link existing WhatsApp Business Account
Option B: Create new dedicated number

Choose: Option B (easier for testing)
Click: "Get Started"
```

### 3.2 Create Phone Number
```
Fill form:
- Business Name
- Business Category
- Business Address
- Phone Number (yours, for verification)
- Click: "Next"
```

### 3.3 Verify Phone Number
```
WhatsApp sends SMS to your phone with 6-digit code
Enter code
Click: "Verify"
Wait: 5-10 minutes for setup
```

### 3.4 You'll Get:
```
✓ WhatsApp Business Phone Number (e.g., +1-555-0001)
✓ Phone Number ID (e.g., 120200310302021)
✓ Business Account ID (e.g., 102010235920934)
```

**SAVE THESE - YOU'LL NEED THEM!**

---

## Step 4: Generate Access Token

### 4.1 Get Temporary Token (for testing)

```
In Meta Developers Dashboard:
1. Go to WhatsApp settings
2. Look for "API Setup" section
3. You'll see: Phone Number ID
4. Below that: "Temporary Access Token"
5. Click: "Generate Token" or "Copy" if already there

Temporary Token Format:
EAAB...abc123def456ghi789
(Valid for 24 hours - good for testing)
```

### 4.2 Get Permanent Token (for production)

```
For production, create System User:

1. Go to: https://business.facebook.com
2. Click: Settings (bottom left)
3. Select: "Business Settings"
4. Go to: Users → System Users
5. Click: "Create System User"
   - Name: "ChatBot Backend"
   - Role: Admin
6. Click: "Create System User"
```

### 4.3 Generate Token for System User
```
1. Click the system user you created
2. Click: "Generate Token"
3. Select: Your WhatsApp app
4. Select: whatsapp_business_messaging
5. Click: "Generate Token"
6. You get: NEW_PERMANENT_TOKEN
   (This never expires - use for production)
```

**SAVE THIS TOKEN - VERY IMPORTANT!**

---

## Step 5: Verify Your Webhook URL

### 5.1 What You Need
```
- Your hosting domain (e.g., https://yourdomain.com)
- A random verify token you create (e.g., "abc123xyz456")
- Your NestJS webhook endpoint: /chat/webhook
```

### 5.2 Set Webhook in Meta Dashboard
```
In Meta Developers:
1. Go to WhatsApp settings
2. Find: "Webhook" section
3. Click: "Edit"
4. Webhook URL: https://yourdomain.com/chat/webhook
5. Verify Token: abc123xyz456 (create your own random string)
6. Click: "Verify and Save"
```

### 5.3 Meta Will Send Verification Request
```
Your webhook receives:
GET /chat/webhook?
  hub.mode=subscribe&
  hub.challenge=XYZ123&
  hub.verify_token=abc123xyz456

Your server must respond with:
{
  "hub.challenge": "XYZ123"
}

If correct → ✓ Verified (green checkmark appears)
```

---

## Step 6: Subscribe to Webhook Events

### 6.1 In Meta Dashboard
```
1. Go to WhatsApp settings
2. Find: "Webhook" section
3. Click: "Manage" (next to webhook field)
4. Check: "messages" (to receive incoming messages)
5. Check: "message_status" (optional - delivery status)
6. Click: "Save"
```

---

## What You Have Now:

```
WHATSAPP_BUSINESS_PHONE_NUMBER=+1-555-0001
WHATSAPP_PHONE_NUMBER_ID=120200310302021
WHATSAPP_BUSINESS_ACCOUNT_ID=102010235920934
WHATSAPP_ACCESS_TOKEN=EAAB...xyz123...
WHATSAPP_VERIFY_TOKEN=abc123xyz456
WHATSAPP_API_VERSION=v18.0
WHATSAPP_API_BASE_URL=https://graph.instagram.com
```

**Save all these values - you'll need them in your code!**

---

# PART 2: CODE SETUP (2.5 hours)

## Step 7: Update Environment Variables

### 7.1 Create/Update `.env` File

In `chatbot_backend/.env`:

```env
# ========== Meta WhatsApp Configuration ==========
WHATSAPP_BUSINESS_PHONE_NUMBER=+1-555-0001
WHATSAPP_PHONE_NUMBER_ID=120200310302021
WHATSAPP_ACCESS_TOKEN=EAAB...paste_your_token_here
WHATSAPP_VERIFY_TOKEN=abc123xyz456
WHATSAPP_API_VERSION=v18.0
WHATSAPP_API_BASE_URL=https://graph.instagram.com

# ========== Server Configuration ==========
NODE_ENV=development
PORT=3000
WEBHOOK_BASE_URL=http://localhost:3000

# ========== Database ==========
DATABASE_URL=postgresql://user:password@localhost:5432/chatbot

# ========== OpenAI ==========
OPENAI_API_KEY=sk-proj-...paste_your_key_here
```

### 7.2 Create `.env.example`

```env
WHATSAPP_BUSINESS_PHONE_NUMBER=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_API_VERSION=v18.0
WHATSAPP_API_BASE_URL=https://graph.instagram.com
NODE_ENV=development
PORT=3000
WEBHOOK_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/chatbot
OPENAI_API_KEY=
```

---

## Step 8: Update Database Schema

### 8.1 Update Prisma Schema

Edit `prisma/schema.prisma`:

```prisma
// Add these fields to Business model

model Business {
  id                    Int       @id @default(autoincrement())
  name                  String
  phoneNumber           String    @unique
  
  // NEW: WhatsApp Configuration
  whatsappPhoneNumberId String?
  whatsappBusinessPhone String?   @unique
  whatsappAccessToken   String?   // Store encrypted in production
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
  id                   Int      @id @default(autoincrement())
  chatId               Int
  sender               String   // "user" or "assistant"
  content              String
  whatsappMessageId    String?  // Track Meta message ID
  createdAt            DateTime @default(now())

  chat                 Chat     @relation(fields: [chatId], references: [id])
}
```

### 8.2 Run Migration

```bash
cd chatbot_backend
npx prisma migrate dev --name add_whatsapp_fields
```

Output:
```
✓ Migration created
✓ Database updated
```

---

## Step 9: Install Dependencies

```bash
npm install axios
npm install dotenv --save
```

---

## Step 10: Create WhatsApp Service

### 10.1 Create File

Create `src/whatsapp/whatsapp.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
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
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';

    // Create API client for Meta Graph API
    this.apiClient = axios.create({
      baseURL: `${process.env.WHATSAPP_API_BASE_URL}/${this.apiVersion}`,
      timeout: 30000,
    });
  }

  /**
   * Send text message via WhatsApp Cloud API
   */
  async sendMessage(
    userPhone: string,
    message: string,
  ): Promise<SendMessageResponse> {
    try {
      // Validate phone number
      if (!this.isValidPhoneNumber(userPhone)) {
        this.logger.error(`Invalid phone number: ${userPhone}`);
        return {
          success: false,
          error: `Invalid phone number: ${userPhone}`,
        };
      }

      // Format phone number (remove +, just digits)
      const formattedPhone = userPhone.replace(/\D/g, '');

      this.logger.debug(`Sending message to ${formattedPhone}`);

      // Make request to Meta Graph API
      const url = `/${this.phoneNumberId}/messages`;
      const response = await this.apiClient.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: {
            body: message,
          },
        },
        {
          params: {
            access_token: this.accessToken,
          },
        },
      );

      const messageId = response.data?.messages?.[0]?.id;

      if (messageId) {
        this.logger.log(`Message sent successfully. ID: ${messageId}`);
        return {
          success: true,
          messageId,
        };
      }

      this.logger.error('No message ID in response');
      return {
        success: false,
        error: 'No message ID in response',
      };
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      this.logger.error(`Error details: ${JSON.stringify(error.response?.data)}`);
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
      await this.apiClient.post(
        `/${messageId}`,
        {
          status: 'read',
        },
        {
          params: {
            access_token: this.accessToken,
          },
        },
      );

      this.logger.debug(`Marked message ${messageId} as read`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to mark as read: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }

  /**
   * Parse incoming webhook message from Meta
   */
  parseIncomingMessage(body: any): IncomingMessage | null {
    try {
      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      
      if (!message) {
        this.logger.warn('No message found in webhook body');
        return null;
      }

      const metadata = body?.entry?.[0]?.changes?.[0]?.value?.metadata;

      return {
        from: message.from,
        to: metadata?.display_phone_number,
        text: message.text?.body || '',
        messageId: message.id,
        timestamp: message.timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to parse incoming message: ${error.message}`);
      return null;
    }
  }
}
```

---

## Step 11: Create WhatsApp Module

### 11.1 Create File

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

## Step 12: Update Chat Service

### 12.1 Add New Methods

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
   * Get chat history (last 10 messages)
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

## Step 13: Update Chat Controller

### 13.1 Replace Entire File

Replace `src/chat/chat.controller.ts` with:

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
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ChatService } from './chat.service';
import { AiService } from '../ai/ai.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private chatService: ChatService,
    private aiService: AiService,
    private whatsAppService: WhatsAppService,
  ) {}

  /**
   * GET /chat/webhook
   * 
   * Meta sends this to verify your webhook
   * You must respond with the challenge token
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
  ): any {
    this.logger.log('Webhook verification request received');

    // Check if verification token matches
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      this.logger.log('✓ Webhook verified successfully');
      // Meta expects the challenge as a number in an object
      return { 'hub.challenge': challenge };
    }

    this.logger.warn('✗ Webhook verification failed - invalid token');
    return { error: 'Unauthorized' };
  }

  /**
   * POST /chat/webhook
   * 
   * Meta sends incoming messages here
   * Process message and send response
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleMessage(@Body() body: any): Promise<any> {
    this.logger.debug(`Webhook received: ${JSON.stringify(body, null, 2)}`);

    try {
      // Parse incoming message from Meta format
      const incomingMessage =
        this.whatsAppService.parseIncomingMessage(body);

      if (!incomingMessage) {
        this.logger.warn('Could not parse incoming message');
        return { success: true }; // Still return 200
      }

      const {
        from: userPhone,
        to: businessPhone,
        text: messageText,
        messageId,
      } = incomingMessage;

      this.logger.log(
        `📱 Message from ${userPhone} to ${businessPhone}: "${messageText}"`,
      );

      // ========== STEP 1: Find Business ==========
      const business = await this.chatService.findBusinessByWhatsAppPhone(
        businessPhone,
      );

      if (!business) {
        this.logger.warn(`Business not found for: ${businessPhone}`);
        return { success: true };
      }

      if (!business.whatsappIsActive) {
        this.logger.warn(`WhatsApp not active for business: ${business.id}`);
        return { success: true };
      }

      this.logger.log(`✓ Business found: ${business.name} (ID: ${business.id})`);

      // ========== STEP 2: Find or Create Chat ==========
      const chat = await this.chatService.findOrCreateChat(
        userPhone,
        business.id,
      );

      this.logger.log(`✓ Chat created/found: ${chat.id}`);

      // ========== STEP 3: Save Incoming Message ==========
      await this.chatService.saveMessage(
        chat.id,
        'user',
        messageText,
        messageId,
      );

      this.logger.log(`✓ Incoming message saved`);

      // ========== STEP 4: Get Context ==========
      const history = await this.chatService.getChatHistory(chat.id);
      const knowledge = await this.chatService.getKnowledge(business.id);

      this.logger.debug(
        `📚 Context: ${history.length} messages, ${knowledge.length} knowledge items`,
      );

      // ========== STEP 5: Generate AI Response ==========
      let aiResponse = await this.aiService.getResponse(messageText);

      if (!aiResponse) {
        aiResponse = 'Sorry, I could not process your request. Please try again.';
      }

      this.logger.log(`🤖 AI response: "${aiResponse}"`);

      // ========== STEP 6: Send Response via WhatsApp ==========
      const sendResult = await this.whatsAppService.sendMessage(
        userPhone,
        aiResponse,
      );

      if (!sendResult.success) {
        this.logger.error(`❌ Failed to send message: ${sendResult.error}`);
        // Still save the message for logging
        await this.chatService.saveMessage(
          chat.id,
          'assistant',
          aiResponse,
        );
        return { success: true };
      }

      this.logger.log(
        `✓ Response sent successfully (ID: ${sendResult.messageId})`,
      );

      // ========== STEP 7: Save Outgoing Message ==========
      await this.chatService.saveMessage(
        chat.id,
        'assistant',
        aiResponse,
        sendResult.messageId,
      );

      this.logger.log(`✓ Conversation saved to database`);

      return { success: true, messageId: sendResult.messageId };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      this.logger.error(error.stack);
      return { success: true }; // Still return 200 to prevent Meta retries
    }
  }

  /**
   * POST /chat/test-send
   * 
   * For manual testing - send message to user
   * Usage: POST /chat/test-send
   * Body: { businessId: 1, userPhone: "919876543210", message: "Hello" }
   */
  @Post('test-send')
  async testSendMessage(
    @Body() body: { businessId: number; userPhone: string; message: string },
  ): Promise<any> {
    try {
      const { businessId, userPhone, message } = body;

      this.logger.log(`Test send: businessId=${businessId}, phone=${userPhone}`);

      const business = await this.chatService.getBusinessById(businessId);

      if (!business) {
        return { success: false, error: 'Business not found' };
      }

      const result = await this.whatsAppService.sendMessage(userPhone, message);

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

---

## Step 14: Update App Module

### 14.1 Add WhatsApp Module

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

# PART 3: TESTING (1 hour)

## Step 15: Test Locally

### 15.1 Start Development Server

```bash
cd chatbot_backend

# Install dependencies
npm install

# Run database migration
npx prisma migrate dev

# Start server
npm run start:dev
```

Output should show:
```
[Nest] 12345 - 05/14/2026 10:30:45 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345 - 05/14/2026 10:30:46 AM     LOG [InstanceLoader] ...
[Nest] 12345 - 05/14/2026 10:30:47 AM     LOG [RoutesResolver] ...
[Nest] 12345 - 05/14/2026 10:30:48 AM     LOG Server running on port 3000
```

---

### 15.2 Test Webhook Verification (Locally)

```bash
# In another terminal, test the webhook verification endpoint
curl "http://localhost:3000/chat/webhook?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=abc123xyz456"
```

**Expected Response:**
```json
{
  "hub.challenge": "test123"
}
```

---

### 15.3 Expose Local Server to Internet

You need to make your local server publicly accessible for Meta to send webhooks.

**Option A: Using ngrok (Easiest)**

```bash
# Download ngrok from: https://ngrok.com/download

# In terminal:
ngrok http 3000

# Output:
# Session Status                online
# Forwarding                    https://abc123xyz.ngrok.io -> http://localhost:3000
```

**Save this URL:** `https://abc123xyz.ngrok.io`

---

### 15.4 Update Meta Webhook URL (for testing)

```
In Meta Developers Dashboard:
1. Go to WhatsApp settings
2. Find "Webhook" section
3. Click "Edit"
4. Webhook URL: https://abc123xyz.ngrok.io/chat/webhook (your ngrok URL)
5. Verify Token: abc123xyz456 (your token from .env)
6. Click "Verify and Save"

Should show: ✓ Verified
```

---

### 15.5 Send Test Message

**Option A: Use WhatsApp Directly**
```
1. Add your phone number to Meta test users
2. Send message from your WhatsApp to your business number
3. Check terminal - you should see logs
4. You should receive a response
```

**Option B: Use Postman to Simulate Message**

Create POST request:

```
POST http://localhost:3000/chat/webhook
Content-Type: application/json

{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "919876543210",
                "id": "wamid.test123",
                "timestamp": "1684756200",
                "type": "text",
                "text": {
                  "body": "Hello! I need help"
                }
              }
            ],
            "metadata": {
              "display_phone_number": "1234567890",
              "phone_number_id": "120200310302021"
            }
          }
        }
      ]
    }
  ]
}
```

Response should be:
```json
{
  "success": true,
  "messageId": "wamid.xxx..."
}
```

---

### 15.6 Check Database

```bash
# Open Prisma Studio
npx prisma studio

# You should see:
# - New Chat record created
# - Messages saved (user + assistant)
# - Timestamps
```

---

## Step 16: Create Test Business in Database

Before full testing, add a test business:

```bash
# Open Prisma Studio
npx prisma studio

# In Chat table, click "Add" and create:
Business:
  - name: "Pizza Palace"
  - phoneNumber: "+1-555-0001"
  - whatsappPhoneNumberId: "120200310302021"
  - whatsappBusinessPhone: "+1-555-0001"
  - whatsappIsActive: true
```

---

# PART 4: DEPLOYMENT (1.5 hours)

## Step 17: Deploy to Heroku

### 17.1 Create Heroku Account

```
Go to: https://heroku.com
Sign up with email
Verify email
```

### 17.2 Install Heroku CLI

```bash
# Download from: https://devcenter.heroku.com/articles/heroku-cli

# Verify installation:
heroku --version
```

### 17.3 Login to Heroku

```bash
heroku login

# Opens browser, click "Log In"
# Returns to terminal: "Logged in as your-email@gmail.com"
```

### 17.4 Create Heroku App

```bash
cd chatbot_backend

# Create new app
heroku create your-app-name

# Output:
# Creating ⬢ your-app-name... done
# https://your-app-name.herokuapp.com/ | https://git.heroku.com/your-app-name.git
```

**Save URL:** `https://your-app-name.herokuapp.com`

---

### 17.5 Add PostgreSQL Database

```bash
# Add Postgres add-on
heroku addons:create heroku-postgresql:hobby-dev --app your-app-name

# Get database URL
heroku config:get DATABASE_URL --app your-app-name

# Copy this entire string
```

---

### 17.6 Create Procfile

Create file `Procfile` in your project root:

```
release: npx prisma migrate deploy
web: node dist/main.js
```

---

### 17.7 Update package.json

Verify your `package.json` has:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch"
  }
}
```

---

### 17.8 Set Environment Variables on Heroku

```bash
heroku config:set \
  NODE_ENV=production \
  PORT=3000 \
  WEBHOOK_BASE_URL=https://your-app-name.herokuapp.com \
  DATABASE_URL=postgresql://xxx \
  OPENAI_API_KEY=sk-... \
  WHATSAPP_BUSINESS_PHONE_NUMBER=+1-555-0001 \
  WHATSAPP_PHONE_NUMBER_ID=120200310302021 \
  WHATSAPP_ACCESS_TOKEN=EAAB... \
  WHATSAPP_VERIFY_TOKEN=abc123xyz456 \
  WHATSAPP_API_VERSION=v18.0 \
  WHATSAPP_API_BASE_URL=https://graph.instagram.com \
  --app your-app-name

# Verify:
heroku config --app your-app-name
```

---

### 17.9 Deploy Code

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Deploy to Heroku
git push heroku main

# If your branch is different:
git push heroku your-branch:main

# Watch deployment:
heroku logs --tail --app your-app-name
```

Output should show:
```
remote: Building source...
remote: npm install
remote: npm run build
remote: released v1
deployed to Heroku
```

---

### 17.10 Verify Deployment

```bash
# Test webhook endpoint
curl "https://your-app-name.herokuapp.com/chat/webhook?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=abc123xyz456"

# Should return:
{"hub.challenge":"test123"}
```

---

## Step 18: Update Meta Webhook to Production

### 18.1 Update Webhook URL

```
In Meta Developers Dashboard:
1. Go to WhatsApp settings
2. Find "Webhook" section
3. Click "Edit"
4. Webhook URL: https://your-app-name.herokuapp.com/chat/webhook
5. Verify Token: abc123xyz456
6. Click "Verify and Save"

Should show: ✓ Verified
```

---

## Step 19: Add Test Users to Meta

### 19.1 Add Your Phone Number

```
In Meta Developers:
1. Go to WhatsApp settings
2. Find "Test Users"
3. Click "Add Number"
4. Enter your phone number
5. Click "Send OTP"
6. Enter OTP from SMS
7. Click "Verify"
```

---

## Step 20: End-to-End Testing

### 20.1 Send Message from WhatsApp

```
1. Open WhatsApp on your phone
2. Search for your business number (from Meta)
3. Send message: "Hello"
4. Wait 2-3 seconds
5. You should receive AI response
```

### 20.2 Check Logs

```bash
# View production logs
heroku logs --tail --app your-app-name

# Should show:
# 📱 Message from 919876543210 to 1234567890
# ✓ Business found: Pizza Palace
# ✓ Chat created/found
# 🤖 AI response: "Hello! Welcome..."
# ✓ Response sent successfully
```

### 20.3 Check Database

```bash
# Open Prisma Studio
npx prisma studio

# Check:
# - Chat created
# - Messages saved (user + assistant)
# - timestamps correct
```

---

# FINAL CHECKLIST

- [ ] Meta account created
- [ ] Facebook Business account created
- [ ] Meta app created
- [ ] WhatsApp added to app
- [ ] WhatsApp business number obtained
- [ ] API credentials saved
- [ ] Access token generated
- [ ] .env file created with all credentials
- [ ] Database schema updated
- [ ] Migration run
- [ ] WhatsApp service created
- [ ] Chat controller updated
- [ ] App module updated
- [ ] Local testing passed (webhook verification works)
- [ ] ngrok running (if testing locally)
- [ ] Meta webhook URL set
- [ ] Webhook verified ✓
- [ ] Test message sent locally
- [ ] Database has test data
- [ ] Code deployed to Heroku
- [ ] Production webhook URL set
- [ ] Production webhook verified ✓
- [ ] Phone number added to test users
- [ ] End-to-end test passed (message sent → response received)

---

# TROUBLESHOOTING

## Webhook Not Receiving Messages

**Check:**
```
1. Is webhook URL public and HTTPS?
2. Does webhook verification show ✓ in Meta?
3. Is NODE_ENV correct?
4. Check logs: heroku logs --tail
```

**Fix:**
```bash
# Verify endpoint
curl "https://your-app-name.herokuapp.com/chat/webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=YOUR_TOKEN"

# Should return: {"hub.challenge":"test"}
```

---

## Database Connection Error

```bash
# Check DATABASE_URL
heroku config:get DATABASE_URL --app your-app-name

# Run migrations
heroku run npx prisma migrate deploy --app your-app-name

# View logs
heroku logs --tail --app your-app-name
```

---

## Token Expired

```bash
# Generate new token in Meta Dashboard
# Update in Heroku:
heroku config:set WHATSAPP_ACCESS_TOKEN=NEW_TOKEN --app your-app-name

# Redeploy
git push heroku main
```

---

## Message Not Sending

**Check logs:**
```bash
heroku logs --tail --app your-app-name

# Look for errors like:
# "Invalid phone number"
# "Invalid token"
# "Rate limited"
```

**Common Fixes:**
- Phone number must include country code (no +, just digits)
- Token must not be expired
- Business must have WhatsApp enabled in database

