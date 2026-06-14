import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('Seeding database...');

  // 1. Seed Users
  const seedUsers = [
    { name: 'Aisha', pass: 'aisha123' },
    { name: 'Rohan', pass: 'rohan123' },
    { name: 'Priya', pass: 'priya123' },
    { name: 'Meera', pass: 'meera123' },
    { name: 'Sam', pass: 'sam123' },
    { name: 'Dev', pass: 'dev123' }
  ];

  const dbUsers = [];
  for (const u of seedUsers) {
    const existing = await prisma.user.findUnique({
      where: { username: u.name }
    });
    if (!existing) {
      const created = await prisma.user.create({
        data: {
          username: u.name,
          passwordHash: hashPassword(u.pass)
        }
      });
      dbUsers.push(created);
      console.log(`Created seed user: ${u.name}`);
    } else {
      dbUsers.push(existing);
    }
  }

  // Map usernames to IDs
  const userMap = {};
  for (const u of dbUsers) {
    userMap[u.username] = u.id;
  }

  // 2. Seed Group
  let group = await prisma.group.findFirst({
    where: { name: 'Flat 101 Expenses' }
  });
  if (!group) {
    group = await prisma.group.create({
      data: { name: 'Flat 101 Expenses' }
    });
    console.log('Created seed group: Flat 101 Expenses');
  }

  // 3. Seed Memberships
  // Clear any existing memberships to prevent duplicates on re-run
  await prisma.groupMembership.deleteMany({
    where: { groupId: group.id }
  });

  const memberships = [
    { userId: userMap['Aisha'], joinedAt: new Date('2026-02-01'), leftAt: null },
    { userId: userMap['Rohan'], joinedAt: new Date('2026-02-01'), leftAt: null },
    { userId: userMap['Priya'], joinedAt: new Date('2026-02-01'), leftAt: null },
    { userId: userMap['Meera'], joinedAt: new Date('2026-02-01'), leftAt: new Date('2026-03-31') },
    { userId: userMap['Dev'], joinedAt: new Date('2026-03-01'), leftAt: new Date('2026-03-31') },
    { userId: userMap['Sam'], joinedAt: new Date('2026-04-15'), leftAt: null }
  ];

  for (const m of memberships) {
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: m.userId,
        joinedAt: m.joinedAt,
        leftAt: m.leftAt
      }
    });
  }

  console.log('Group memberships seeded successfully.');
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
