const { PrismaClient } = require('@prisma/client');

// Usage:
// DATABASE_URL="postgresql://..." node scripts/check_messages.js [--limit=20] [--businessId=1]

async function main() {
  const prisma = new PrismaClient();

  const args = process.argv.slice(2);
  const opts = args.reduce((acc, cur) => {
    const [k, v] = cur.replace(/^--/, '').split('=');
    acc[k] = v || true;
    return acc;
  }, {});

  const limit = parseInt(opts.limit || '20', 10);
  const where = {};
  if (opts.businessId) where.businessId = parseInt(opts.businessId, 10);
  if (opts.userPhone) where.userPhone = opts.userPhone;

  try {
    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { chat: true },
    });

    console.log(`Found ${messages.length} messages:`);
    messages.forEach((m) => {
      console.log('---');
      console.log(`id: ${m.id}`);
      console.log(`chatId: ${m.chatId}`);
      console.log(`sender: ${m.sender}`);
      console.log(`content: ${m.content}`);
      console.log(`whatsappMessageId: ${m.whatsappMessageId}`);
      console.log(`createdAt: ${m.createdAt}`);
    });
  } catch (err) {
    console.error('Error querying messages:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
