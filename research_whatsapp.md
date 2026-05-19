# WhatsApp Integration Research Guide

## 1. Understanding WhatsApp Business API

### What is WhatsApp Business API?
- Official API provided by WhatsApp/Meta to send and receive messages programmatically
- Allows businesses to integrate WhatsApp into their apps
- Messages flow through Meta's servers, ensuring security and compliance

### Key Concepts

#### 1.1 Webhook
- A URL on your server that WhatsApp sends messages to
- WhatsApp will POST incoming messages to your webhook endpoint
- Your server processes the message and sends a response back

#### 1.2 Phone Number Routing
- Each business has a unique WhatsApp Business Phone Number
- Users send messages to that phone number
- Your webhook receives the message with:
  - User's phone number (sender)
  - Business phone number (receiver)
  - Message content
  - Timestamp

#### 1.3 Message Types
- **Incoming messages**: From users to your business
- **Outgoing messages**: From your business to users
- **Status updates**: Delivery confirmations, read receipts
- **Template messages**: Pre-approved message formats (for marketing/notifications)

---

## 2. Getting Started: Three Main Options

### Option A: WhatsApp Cloud API (RECOMMENDED FOR MOST BUSINESSES)
**Best for:** Small to medium businesses, startups, developers

**How to Get:**
1. Create/Login to Facebook Business Account (https://business.facebook.com)
2. Go to App Center → Create App
3. Add "WhatsApp" to your app
4. Get Temporary Access Token (for testing)
5. Later: Set up permanent access tokens using Business Account ID + System User

**Pros:**
- Free tier: 1000 messages/day
- Easy to set up
- No infrastructure needed
- Meta handles all infrastructure

**Cons:**
- Monthly fees after free tier
- Message limits

### Option B: WhatsApp Business API (Hosted)
**Best for:** Enterprise businesses with high volume

**Features:**
- Self-hosted or cloud-hosted solution
- Higher message limits
- More control

**Providers:**
- Twilio WhatsApp API
- MessageBird
- Telnyx

### Option C: WhatsApp Business Account (Premium)
**Best for:** Large businesses

**Process:**
- Apply through Meta
- Own infrastructure
- Highest limits
- Highest costs

---

## 3. Step-by-Step: Getting WhatsApp API Key

### Step 1: Create Meta Developer Account
```
Go to: https://developers.facebook.com/
- Create account with business email
- Verify email
```

### Step 2: Create/Select Business Account
```
Go to: https://business.facebook.com/
- Create Business Account if you don't have one
- Add your phone number as business owner
```

### Step 3: Create App
```
Facebook Developer Dashboard:
1. Click "Create App"
2. Select "Business" as app type
3. Fill in app details:
   - App Name: "ChatBot Backend" (or your business name)
   - App Purpose: "Automate messaging"
4. Click "Create App"
```

### Step 4: Add WhatsApp to Your App
```
Dashboard:
1. In left sidebar → Find "WhatsApp"
2. Click "Set Up"
3. Select "WhatsApp Business Platform"
4. Click "Continue"
```

### Step 5: Get Your Phone Number
```
Two Options:
A) Use Existing Business Number:
   - Enter your existing WhatsApp Business number
   
B) Create New Number:
   - Click "Get Started"
   - Enter business details
   - Verify with code sent to phone
   - Get new dedicated number
```

### Step 6: Get Temporary Access Token
```
In WhatsApp Settings:
1. Go to "API Setup" section
2. You'll see:
   - Phone Number ID (save this!)
   - Business Account ID (save this!)
   - Temporary Access Token (valid for 24 hours)

Example:
   Phone Number ID: 120200310302021
   Business Account ID: 102010235920934
   Token: EAAB...xyz123
```

### Step 7: Create Permanent Access Token
```
For production, create System User:

1. Go to Business Account Settings
2. Users → System Users
3. Create System User:
   - Name: "ChatBot Backend"
   - Role: Admin
4. Generate Token:
   - Click system user
   - Assign Assets: Select your WhatsApp app
   - Generate Token (no expiration)
```

---

## 4. Understanding Message Flow Architecture

### Current Your Architecture:
```
WhatsApp User → WhatsApp Servers → Your Webhook → Your NestJS Backend
                                        ↓
                                   Database (save message)
                                        ↓
                                   AI Service (generate response)
                                        ↓
                                   WhatsApp API (send response)
                                        ↓
                                      User sees reply
```

### Message Flow Breakdown:

1. **User sends message to business WhatsApp number**
   - Message reaches WhatsApp servers

2. **WhatsApp sends POST to your webhook**
   ```
   POST https://yourdomain.com/chat/webhook
   {
     "object": "whatsapp_business_account",
     "entry": [{
       "id": "...",
       "changes": [{
         "value": {
           "messaging_product": "whatsapp",
           "metadata": {
             "display_phone_number": "1234567890",  ← Business number
             "phone_number_id": "120200310302021"
           },
           "messages": [{
             "from": "919876543210",                ← User's number
             "id": "wamid.xxx",
             "timestamp": "1234567890",
             "text": {
               "body": "Hello, I want to order pizza"
             }
           }]
         }
       }]
     }]
   }
   ```

3. **Your backend processes message**
   - Extract: sender phone, business phone, message text
   - Look up business in database using phone number
   - Find or create chat record
   - Pass to AI for response generation

4. **Send response back via WhatsApp API**
   ```
   POST https://graph.instagram.com/v18.0/PHONE_NUMBER_ID/messages
   {
     "messaging_product": "whatsapp",
     "to": "919876543210",               ← User's number
     "type": "text",
     "text": {
       "body": "Sure! We have fresh pizza available..."
     }
   }
   ```

---

## 5. Routing Multiple Businesses

### How It Works:

**Database Setup:**
```
Business Table:
- id (primary key)
- name
- phoneNumber (unique) ← This is the WhatsApp number!
- businessId
- whatsappPhoneNumberId
- whatsappAccessToken

When User Message Arrives:
1. Extract recipient phone from webhook (business number)
2. Look up: Business.where({ phoneNumber: recipientPhone })
3. Get businessId
4. Create chat with that businessId
5. Get business's knowledge base
6. Send response to user
```

### Scenarios:

**Example 1: Two Businesses**
```
Business A:
- Name: "Pizza Palace"
- WhatsApp: +1-555-0001
- businessId: 1

Business B:
- Name: "Burger Hut"
- WhatsApp: +1-555-0002
- businessId: 2

User calls +1-555-0001 → Message routed to Pizza Palace → Uses Pizza knowledge
User calls +1-555-0002 → Message routed to Burger Hut → Uses Burger knowledge
```

**Example 2: Random User Numbers**
```
User1 (+1-555-0099) sends: "I want pizza"
User2 (+1-555-0098) sends: "I want burger"
User3 (+1-555-0097) sends: "What are your hours?"

All messages might come to SAME business WhatsApp number.
Your system creates separate Chat records for each user.
```

---

## 6. Webhook Verification

WhatsApp requires you to verify your webhook before it sends messages.

### How Verification Works:

1. **You provide webhook URL**
   ```
   https://yourdomain.com/chat/webhook
   ```

2. **WhatsApp sends GET request with challenge token**
   ```
   GET https://yourdomain.com/chat/webhook?
     hub.mode=subscribe&
     hub.challenge=ABC123&
     hub.verify_token=YOUR_VERIFY_TOKEN
   ```

3. **Your server validates and responds**
   ```
   Validate:
   - hub.verify_token === VERIFY_TOKEN (you set this)
   - Return hub.challenge in response body
   
   If valid: WhatsApp gets response → Webhook is verified
   If invalid: Webhook not verified → Messages won't be sent
   ```

---

## 7. Webhooks vs API for Sending Messages

### Method 1: Webhook (Incoming) ✓ Already in your code
- WhatsApp → Your Server
- Automatic message delivery
- No polling needed

### Method 2: WhatsApp API (Outgoing)
- Your Server → WhatsApp → User
- You make HTTP POST requests
- Need Access Token + Phone Number ID

**Your Architecture Needs:**
```
Incoming: Webhook ✓ (you have this)
Outgoing: WhatsApp API Call (we'll add this)
```

---

## 8. Environment Variables Needed

```
# WhatsApp Configuration
WHATSAPP_PHONE_NUMBER_ID=120200310302021
WHATSAPP_BUSINESS_PHONE_NUMBER=+1234567890
WHATSAPP_ACCESS_TOKEN=EAABzbzsxxxxxx
WHATSAPP_VERIFY_TOKEN=your_custom_verify_token
WHATSAPP_API_VERSION=v18.0
WHATSAPP_API_URL=https://graph.instagram.com

# Webhook
WEBHOOK_URL=https://yourdomain.com/chat/webhook
```

---

## 9. Testing & Sandbox Mode

### Option 1: Use Meta Sandbox
- Free tier provides test numbers
- Test with colleagues' numbers
- No real SMS charges
- Perfect for development

### Option 2: Use Postman
- Simulate WhatsApp webhook calls
- Test your endpoints manually
- Debug locally

### Option 3: Use ngrok
- Expose local server to internet
- Perfect for testing webhooks locally
- Command: `ngrok http 3000`

---

## 10. Common Error Codes

```
1000: Invalid phone number format
1026: Invalid access token
1001: Invalid API version
400: Bad request (check JSON format)
403: Unauthorized (token expired/invalid)
429: Rate limit exceeded (too many messages)
500: Server error (WhatsApp issue)
```

---

## 11. Cost Breakdown

### WhatsApp Cloud API Pricing (as of 2024):

**Free Tier:**
- 1,000 messages/day
- Conversations: 60 minutes response window

**Paid Tiers:**
- Category: Sales, Support, Marketing
- Different rates per message type
- Example: ~$0.003 - $0.1 per message depending on country

**Estimate for Small Business:**
- 100 messages/day = ~$3-10/month
- 1000 messages/day = ~$30-100/month

---

## 12. Security Best Practices

1. **Never hardcode tokens**
   - Use environment variables
   - Rotate tokens regularly

2. **Verify webhook requests**
   - Validate webhook signature
   - Check sender phone number
   - Rate limiting

3. **Encrypt sensitive data**
   - Phone numbers in database
   - Tokens in environment

4. **Use HTTPS only**
   - WhatsApp requires HTTPS
   - Certificate must be valid

5. **Log all messages**
   - For debugging and compliance
   - GDPR considerations

---

## Summary for Getting Started

1. **Create Facebook Developer Account** (5 mins)
2. **Create App** (5 mins)
3. **Add WhatsApp** (5 mins)
4. **Verify Business Number** (10-30 mins)
5. **Get Temporary Access Token** (Instant)
6. **Create System User for Permanent Token** (10 mins)
7. **Set Webhook URL** (2 mins)
8. **Verify Webhook** (5 mins)
9. **Start Testing** (In sandbox mode)

**Total Setup Time: ~1-1.5 hours**

