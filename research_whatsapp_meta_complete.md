# Meta WhatsApp Cloud API - Research & Understanding Guide

## Overview

Meta's WhatsApp Cloud API is the official WhatsApp API provided by Meta (formerly Facebook). It's the most reliable, supported option for integrating WhatsApp into your application.

---

## 1. Understanding WhatsApp Cloud API

### What is it?
- **Official API** provided directly by Meta
- **Cloud-based** - no server infrastructure needed
- **Webhook-based** - Meta sends messages to your server via webhooks
- **REST API** - you call Meta's API to send messages

### Why Use It?
| Aspect | Benefit |
|--------|---------|
| Official | Direct support from Meta |
| Reliable | 99.9% uptime SLA |
| Scalable | Handles millions of messages |
| Secure | End-to-end encryption |
| Features | Templates, media, status updates |
| Documentation | Extensive and updated regularly |

---

## 2. How WhatsApp Cloud API Works

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      WhatsApp Network                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Webhook
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Your NestJS Backend (Your Server)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  GET /chat/webhook - Verification                  │   │
│  │  POST /chat/webhook - Incoming Messages             │   │
│  │  WhatsAppService - Send Messages to Users          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Meta Graph API                                 │
│  POST /messages - Send messages                            │
│  GET /messages/{id} - Check status                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Message Flow - Incoming Messages

### Step-by-Step Flow:

```
USER SENDS MESSAGE:
User (919876543210) → Types message → Sends to business number (+1-555-0001)
                           ↓
WHATSAPP RECEIVES:
WhatsApp receives message on business number
                           ↓
META FORWARDS TO YOUR WEBHOOK:
Meta makes HTTP POST to: https://yourdomain.com/chat/webhook

POST Body Example:
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "919876543210",           ← User's number
          "id": "wamid.xyz123",             ← Message ID
          "timestamp": "1684756200",        ← When sent
          "type": "text",
          "text": {
            "body": "Hello! I want to order" ← Message content
          }
        }],
        "metadata": {
          "display_phone_number": "1234567890",  ← Your business number
          "phone_number_id": "120200310302021"   ← Important for sending
        }
      }
    }]
  }]
}
                           ↓
YOUR SERVER PROCESSES:
1. Extract: from, text, business number
2. Find business in database
3. Create/find chat with user
4. Call AI to generate response
5. Send response back via Meta API
                           ↓
YOU SEND RESPONSE TO META:
POST https://graph.instagram.com/v18.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer YOUR_TOKEN

Body:
{
  "messaging_product": "whatsapp",
  "to": "919876543210",           ← User's number
  "type": "text",
  "text": {
    "body": "Thank you for ordering! Your order ID is #123"
  }
}
                           ↓
META SENDS TO WHATSAPP:
Meta forwards to WhatsApp servers
                           ↓
USER RECEIVES:
User gets your response message
```

---

## 4. Message Flow - Webhook Verification

### Why Verification?

Meta needs to verify that the webhook URL is actually yours before sending messages. This prevents someone from hijacking your URL.

### Verification Process:

```
META'S SERVER:                          YOUR SERVER:
1. Generates random token
2. Makes GET request:
GET https://yourdomain.com/chat/webhook?
  hub.mode=subscribe
  hub.challenge=ABC123XYZ
  hub.verify_token=YOUR_VERIFY_TOKEN
                           ──────────────────→
                                          3. Receives request
                                          4. Checks verify_token
                                          5. If match:
                                          Response:
                                          {"hub.challenge": "ABC123XYZ"}
                           ←──────────────────
6. Receives "ABC123XYZ"
7. ✓ Verified!
8. Starts sending webhooks
```

**Important:** The verify token is something YOU create. Meta doesn't know what it is. You store it in `.env` and tell Meta what it is in the dashboard.

---

## 5. API Endpoints You'll Use

### Endpoint 1: Send Text Message

**Purpose:** Send a text message to a user

```
Endpoint: POST https://graph.instagram.com/v18.0/{PHONE_NUMBER_ID}/messages

Headers:
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

Body:
{
  "messaging_product": "whatsapp",
  "to": "919876543210",           ← Recipient (include country code)
  "type": "text",
  "text": {
    "body": "Hello! How can I help you today?"
  }
}

Success Response (200):
{
  "contacts": [
    {
      "input": "919876543210",
      "wa_id": "919876543210"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBEUGVJVbhEGGGx"   ← Message ID (save for tracking)
    }
  ]
}

Error Response (400):
{
  "error": {
    "message": "Invalid phone number",
    "code": 1000
  }
}
```

### Endpoint 2: Send Template Message

**Purpose:** Send pre-approved marketing/notification messages (higher rate limits)

```
POST https://graph.instagram.com/v18.0/{PHONE_NUMBER_ID}/messages

{
  "messaging_product": "whatsapp",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "order_confirmation",     ← Must be approved by Meta
    "language": {
      "code": "en_US"
    },
    "parameters": {
      "body": {
        "parameters": ["Order#123", "Pizza", "$15.99"]  ← Template variables
      }
    }
  }
}
```

### Endpoint 3: Check Message Status

**Purpose:** Check if message was delivered, read, etc.

```
GET https://graph.instagram.com/v18.0/{MESSAGE_ID}
Authorization: Bearer YOUR_ACCESS_TOKEN

Response:
{
  "id": "wamid.HBEUGVJVbhEGGGx",
  "status": "delivered",              ← sent, delivered, read, failed
  "timestamp": "1684756200"
}
```

---

## 6. Important Concepts

### A. Phone Number ID vs Display Phone Number

```
PHONE_NUMBER_ID:
- Used in API calls
- Example: 120200310302021
- Identifies the specific WhatsApp number in Meta's system

DISPLAY_PHONE_NUMBER:
- What users see
- Example: +1-555-0001
- What appears in your dashboard
- Used to route messages to correct business

MAPPING:
When message arrives:
{
  "display_phone_number": "+1-555-0001",  ← Look this up in database
  "phone_number_id": "120200310302021"    ← Use this to send response
}
```

### B. Access Token

```
TYPES:
1. Temporary Token
   - Valid: 24 hours
   - Use for: Testing/development
   - Where: Found in Meta Dashboard
   - Format: EAAB...xyz

2. Permanent Token (via System User)
   - Valid: No expiration
   - Use for: Production
   - Where: Create System User
   - More secure
   - Format: Same as temporary

WHERE TO GET:
- Temporary: WhatsApp settings → API Setup → Copy token
- Permanent: Settings → Users → System Users → Create → Generate token
```

### C. Webhook URL

```
WHAT IT IS:
- Your server's endpoint where Meta sends messages
- Example: https://yourdomain.com/chat/webhook
- Must be public and HTTPS
- Must have GET (for verification) and POST (for messages)

REQUIREMENTS:
✓ Public URL (Meta servers can reach it)
✓ HTTPS only (no HTTP)
✓ Valid SSL certificate
✓ Returns 200 status
✓ Must verify within 30 seconds
✓ Can receive up to 100 requests/second
```

---

## 7. HTTP Status Codes

### Success Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Message sent/webhook processed |
| 201 | Created | Resource created |

### Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| 400 | Bad Request | Check JSON format, phone number format |
| 401 | Unauthorized | Token expired, regenerate new one |
| 403 | Forbidden | Token invalid or insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limited | Wait before sending more messages |
| 500 | Server Error | Meta's servers, retry later |

---

## 8. Error Messages You Might See

### Common Errors

```json
{
  "error": {
    "message": "Invalid phone number",
    "code": 1000
  }
}
// Fix: Phone number must be 10-15 digits, include country code
```

```json
{
  "error": {
    "message": "(#1104) Access token has expired",
    "code": 1104
  }
}
// Fix: Generate new access token in Meta Dashboard
```

```json
{
  "error": {
    "message": "Unsupported post request",
    "code": 2200
  }
}
// Fix: Check HTTP method, headers, and endpoint URL
```

```json
{
  "error": {
    "message": "Message rate limit exceeded",
    "code": 131000
  }
}
// Fix: Wait 1 hour before sending to this number again
```

---

## 9. Rate Limits

### Message Limits

```
FREE TIER:
- 1,000 messages/day per business phone
- 60 minute conversation window
- Limited to test users only

PAID TIER (Pay as you go):
- Unlimited messages
- Cost: $0.0084 per message (approx) - varies by country
- 250 conversations/second concurrent
- Higher limits available

CONVERSATION WINDOW:
- Business → User: 24 hours to reply
- User → Business: Unlimited
- After window: Cost multiplier increases

RATE LIMITING:
- Max 100 requests/second per app
- Per-user limits apply
```

### How to Handle Rate Limits

```
IF YOU GET 429 ERROR:
1. Catch the error
2. Wait 60 seconds
3. Retry the request
4. Or: Use a queue (Bull, RabbitMQ)
```

---

## 10. Webhook Security

### Webhook Signature Validation

Meta doesn't send signatures like some providers, but you should validate:

```
1. Check verify token on GET request ✓
2. Validate incoming request format
3. Rate limit webhook calls
4. Use HTTPS only (encrypted)
5. Log all webhooks
6. Monitor for suspicious activity
```

### Phone Number Validation

```typescript
// Validate format before sending
function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  // 10-15 digits is typical
  return digits.length >= 10 && digits.length <= 15;
}
```

---

## 11. Testing Approaches

### Option 1: Meta Sandbox Mode

```
1. Go to Meta Dashboard
2. Test users section
3. Add your phone number as test user
4. Send real message from your phone
5. See webhook in logs
```

### Option 2: Manual Testing with Postman

```
Create POST request to your webhook:

URL: http://localhost:3000/chat/webhook
Body: Simulate Meta message format
Headers: Content-Type: application/json

Simulated message:
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "919876543210",
          "id": "wamid.test",
          "text": { "body": "Hello" }
        }],
        "metadata": {
          "display_phone_number": "1234567890"
        }
      }
    }]
  }]
}
```

### Option 3: Webhook.site for Testing

```
1. Go to https://webhook.site
2. Get unique URL
3. Set as Meta webhook URL temporarily
4. Send test message
5. See JSON in webhook.site
6. Understand Meta's format
```

---

## 12. Webhook Format Reference

### Complete Webhook Payload

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "1234567890",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "1234567890",     ← Your business number
              "phone_number_id": "120200310302021",     ← Important!
              "business_account_id": "102010235920934"
            },
            "messages": [
              {
                "context": {
                  "from": "919876543210",
                  "id": "wamid.parent123",
                  "referred_product": null
                },
                "errors": [],
                "from": "919876543210",                ← Sender
                "id": "wamid.HBEUGVJVbhEGGGx",       ← Message ID
                "timestamp": "1684756200",             ← Unix timestamp
                "type": "text",
                "text": {
                  "body": "Hello! I want to order pizza"  ← Content
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### Webhook Fields Explained

```
entry[0].changes[0].value:
├─ metadata
│  ├─ display_phone_number: Business number visible to users
│  └─ phone_number_id: Use in API calls
├─ messages[0]
│  ├─ from: User's phone number
│  ├─ id: Message ID (for tracking)
│  ├─ timestamp: When sent (Unix time)
│  ├─ type: "text", "image", "document", etc.
│  └─ text.body: Message content
```

---

## 13. Common Scenarios

### Scenario 1: Multiple Businesses

```
Business A uses number: +1-555-0001 (Phone ID: 111)
Business B uses number: +1-555-0002 (Phone ID: 222)

User sends to +1-555-0001:
Webhook shows: display_phone_number: "1234567890"
Your code: Find Business where whatsappBusinessPhone == "1234567890"
Result: Route to Business A ✓

User sends to +1-555-0002:
Webhook shows: display_phone_number: "1234567890" (but Phone ID: 222)
Your code: Finds Business B
Result: Route to Business B ✓
```

### Scenario 2: Multiple Users → Same Business

```
User A (+1-555-9001) sends message
User B (+1-555-9002) sends message
User C (+1-555-9003) sends message

All to same business number: +1-555-0001

Your system:
1. All messages → Same webhook
2. Extract "from" number
3. Find/create separate Chat for each user
4. Keep conversations separate
```

---

## 14. Meta Dashboard Navigation

### Where to Find Things

```
Dashboard: https://developers.facebook.com

Left Sidebar:
├─ My Apps → Select your app
├─ Settings
│  ├─ Basic (App ID, Secret)
│  └─ Advanced
├─ Build
│  └─ Products
│     └─ WhatsApp
│        ├─ API Setup (Credentials)
│        ├─ Configuration (Webhook)
│        ├─ Business Accounts
│        └─ Phone Numbers
└─ Tools
   └─ Webhooks (Test webhooks)
```

---

## 15. Environment Variables Needed

```
# Meta WhatsApp Configuration
WHATSAPP_BUSINESS_PHONE_NUMBER=+1-555-0001
WHATSAPP_PHONE_NUMBER_ID=120200310302021
WHATSAPP_ACCESS_TOKEN=EAAB...your_token_here
WHATSAPP_VERIFY_TOKEN=abc123xyz456
WHATSAPP_API_VERSION=v18.0
WHATSAPP_API_BASE_URL=https://graph.instagram.com

# Server
WEBHOOK_BASE_URL=https://yourdomain.com
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://...

# AI
OPENAI_API_KEY=sk-proj-...
```

---

## Summary Table

| Aspect | Details |
|--------|---------|
| Provider | Meta (Official) |
| Setup Time | 1-2 hours |
| Webhook Type | REST HTTP |
| Message Format | JSON (nested structure) |
| Authentication | Bearer Token |
| Rate Limit | 1,000 msgs/day (free), unlimited paid |
| Cost | ~$0.0084 per message (paid tier) |
| Support | Official Meta support |
| Reliability | 99.9% SLA |
| Documentation | Excellent |

---

## Next Steps

1. ✓ Read this research guide
2. → Follow the implementation plan
3. → Set up Meta account & credentials
4. → Implement code
5. → Test locally with ngrok
6. → Deploy to production
7. → Test with real messages

