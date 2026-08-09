const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.log('client created');
try {
  console.log('engines resolved:', require.resolve('@prisma/engines'));
} catch (e) {
  console.error('resolve engines failed', e.message);
}
prisma.$connect()
  .then(() => prisma.business.findMany({ take: 1 }))
  .then((r) => {
    console.log('OK', r);
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error('ERR', e);
    process.exit(1);
  });
