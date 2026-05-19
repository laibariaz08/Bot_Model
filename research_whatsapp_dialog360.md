# WhatsApp Integration with Dialog360 - Complete Research Guide

## Overview
Dialog360 is a WhatsApp API provider that acts as a bridge between your application and WhatsApp. Unlike Meta's official Cloud API, Dialog360 handles the technical complexity and provides simpler endpoints.

---

## 1. Dialog360 vs Meta Cloud API

### Why Dialog360?
| Feature | Dialog360 | Meta Cloud API |
|---------|-----------|---|
| Setup Time | 10-15 mins | 1-2 hours |
| Documentation | Beginner friendly | Complex |
| Support | Direct support | Community |
| Webhook Format | Simple JSON | Complex nested JSON |
| Cost | Pay as you go | Similar |
| Infrastructure | Managed | You manage |

---

## 2. Getting Dialog360 Credentials

### Step 1: Create Account
1. Go to https://dialog360.com (or your provider's URL)
2. Sign up with email
3. Verify email
4. Create workspace

### Step 2: Get Your API Credentials
In Dialog360 Dashboard:
1. Go to Settings → API Credentials
2. You'll get:
   - **API Token** (or API Key): `xyz123abc...` 
   - **Phone Number ID**: `1234567890`
   - **Business Phone Number**: `+1-555-0001`
   - **Webhook URL**: (you'll set this later)

### Step 3: Connect WhatsApp Number
1. In Dashboard → Phone Numbers
2. Click "Add Number"
3. Choose:
   - Option A: Use existing WhatsApp Business number
   - Option B: Create new number
4. Verify with OTP
5. Number is now active

### What You'll Have:
```
DIALOG360_API_TOKEN=xyz123abc456...
DIALOG360_PHONE_NUMBER_ID=1234567890
DIALOG360_BUSINESS_PHONE=+1-555-0001
DIALOG360_API_BASE_URL=https://api.dialog360.com/v1
DIALOG360_WEBHOOK_URL=https://yourdomain.com/chat/webhook
```

---

## 3. Dialog360 Message Flow

### Incoming Message Flow:
```
User (+1-555-9999) sends message to business (+1-555-0001)
    ↓
Dialog360 receives on WhatsApp
    ↓
Dialog360 sends POST to your webhook:
    {
      "messages": [{
        "from": "1-555-9999",
        "id": "msg_xyz123",
        "text": {
          "body": "Hello, I want to order"
        },
        "timestamp": "1234567890"
      }]
    }
    ↓
Your NestJS backend processes
    ↓
You make HTTP request to Dialog360 API to send response
    ↓
Dialog360 sends via WhatsApp to user
```

### Outgoing Message Flow:
```
Your Backend:
POST https://api.dialog360.com/v1/messages
{
  "messaging_product": "whatsapp",
  "to": "1-555-9999",
  "type": "text",
  "text": {
    "body": "Thank you for your order!"
  }
}
With Header: Authorization: Bearer YOUR_TOKEN
    ↓
Dialog360 API receives
    ↓
Sends via WhatsApp to user
    ↓
Returns message ID
```

---

## 4. Webhook Format from Dialog360

### What You Receive:
```json
{
  "messages": [
    {
      "from": "919876543210",
      "id": "wamid.xyz123",
      "timestamp": "1684756200",
      "type": "text",
      "text": {
        "body": "Hello, I need help with my order"
      }
    }
  ],
  "contacts": [
    {
      "input": "919876543210",
      "wa_id": "919876543210"
    }
  ],
  "metadata": {
    "display_phone_number": "1234567890",
    "phone_number_id": "102010235920934"
  }
}
```

### Key Fields:
- `messages[0].from`: User's phone number
- `messages[0].text.body`: Message content
- `messages[0].id`: Message ID (for status tracking)
- `metadata.display_phone_number`: Your business number
- `metadata.phone_number_id`: Used for sending responses

---

## 5. API Endpoints You'll Use

### 1. Send Text Message
```
POST https://api.dialog360.com/v1/messages
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "919876543210",
  "type": "text",
  "text": {
    "body": "Your message here"
  }
}

Response:
{
  "contacts": [{"input": "919876543210", "wa_id": "919876543210"}],
  "messages": [{"id": "wamid.HBEUGVJVxxx"}]
}
```

### 2. Send Template Message
```
POST https://api.dialog360.com/v1/messages
Authorization: Bearer YOUR_TOKEN

{
  "messaging_product": "whatsapp",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "order_confirmation",
    "language": {
      "code": "en_US"
    },
    "parameters": {
      "body": {
        "parameters": ["Order123", "Pizza"]
      }
    }
  }
}
```

### 3. Mark Message as Read
```
POST https://api.dialog360.com/v1/messages
Authorization: Bearer YOUR_TOKEN

{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid.HBEUGVJVxxx"
}
```

### 4. Get Message Status
```
GET https://api.dialog360.com/v1/messages/wamid.HBEUGVJVxxx
Authorization: Bearer YOUR_TOKEN

Response:
{
  "id": "wamid.HBEUGVJVxxx",
  "status": "delivered",
  "timestamp": "1684756200"
}
```

---

## 6. HTTP Status Codes from Dialog360

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Message sent |
| 400 | Bad Request | Check JSON format |
| 401 | Unauthorized | Check API token |
| 403 | Forbidden | Token expired |
| 429 | Rate Limited | Wait before resending |
| 500 | Server Error | Retry later |

---

## 7. Error Responses

### Example Error:
```json
{
  "errors": [
    {
      "message": "Invalid phone number",
      "code": 400,
      "type": "OAuthException"
    }
  ]
}
```

### Common Errors:
- **"Invalid phone number"** → Check phone format (include country code)
- **"Invalid token"** → Token expired, generate new one
- **"Rate limit exceeded"** → Wait 1 minute before retrying
- **"Message too long"** → Max 4096 characters

---

## 8. Security Considerations

### Webhook Verification
Dialog360 doesn't require webhook signature verification like Meta does, BUT:
1. Use HTTPS only
2. Validate phone number format
3. Rate limit incoming webhooks
4. Store API token in environment variables

### Phone Number Format
- Must include country code
- No spaces or dashes
- Examples: `919876543210`, `14155552671`

---

## 9. Testing Dialog360

### Option 1: Using Dialog360 Sandbox
```
1. In Dialog360 Dashboard → Sandbox
2. You get test phone number
3. Send test messages
4. See webhook calls in logs
```

### Option 2: Using Postman to Send Messages
```
POST https://api.dialog360.com/v1/messages
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "919876543210",
  "type": "text",
  "text": {
    "body": "Test message"
  }
}
```

### Option 3: Webhook Testing
Use RequestBin or Webhook.site:
1. Go to https://webhook.site
2. Get unique URL
3. Set as Dialog360 webhook URL
4. Send test message
5. See webhook payload

---

## 10. Rate Limits

### Dialog360 Standard Limits:
- **Free Tier**: 100 messages/day
- **Paid Tier**: 10,000+ messages/day
- **Concurrent**: 10 requests/second
- **Template messages**: Higher limits (approval needed)

### What to Do:
1. Monitor message count in dashboard
2. Queue messages if near limit
3. Upgrade plan if needed
4. Use template messages for bulk sends

---

## 11. Webhook Verification

### Dialog360 Webhook Verification (GET Request)
```
GET https://yourdomain.com/chat/webhook?
  hub.mode=subscribe&
  hub.challenge=ABC123&
  hub.verify_token=YOUR_VERIFY_TOKEN

Your Response:
{
  "hub.challenge": "ABC123"
}
```

### In Your Code:
```typescript
@Get('webhook')
verifyWebhook(
  @Query('hub.mode') mode: string,
  @Query('hub.challenge') challenge: string,
  @Query('hub.verify_token') token: string,
): any {
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return { 'hub.challenge': challenge };
  }
  return { error: 'Unauthorized' };
}
```

---

## 12. Dialog360 Dashboard Features

### Sections You Need to Know:
1. **Messages**: See all sent/received messages
2. **Contacts**: Manage customer list
3. **Analytics**: Message statistics
4. **API Credentials**: Get tokens
5. **Phone Numbers**: Manage WhatsApp numbers
6. **Webhooks**: Configure and test webhooks
7. **Templates**: Manage message templates
8. **Settings**: Account settings

---

## 13. Environment Variables Required

```env
# Dialog360 Configuration
DIALOG360_API_TOKEN=your_api_token_here
DIALOG360_PHONE_NUMBER_ID=your_phone_id
DIALOG360_BUSINESS_PHONE=+1-555-0001
DIALOG360_API_BASE_URL=https://api.dialog360.com/v1
DIALOG360_WEBHOOK_URL=https://yourdomain.com/chat/webhook
WEBHOOK_VERIFY_TOKEN=your_custom_verify_token

# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:port/db

# AI
OPENAI_API_KEY=sk-...
```

---

## Summary Checklist

- [ ] Create Dialog360 account
- [ ] Connect WhatsApp number
- [ ] Get API token
- [ ] Get Phone Number ID
- [ ] Save credentials in .env
- [ ] Set webhook URL in Dialog360 dashboard
- [ ] Test webhook verification
- [ ] Understand message format
- [ ] Ready for implementation

