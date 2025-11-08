const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 10);
  
  // Check if user exists, if not create
  let user1 = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });

  if (!user1) {
    user1 = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: hashedPassword,
        demoBalance: 10000,
      },
    });
    console.log('✓ User created');
  } else {
    console.log('✓ User already exists');
  }

  // Delete old data in correct order (respect foreign keys)
  await prisma.trade.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.bookmark.deleteMany({});
  await prisma.marketCache.deleteMany({});
  console.log('✓ Old markets cleared');

  // Create markets
  const markets = [
    {
      id: 'mock-market-1',
      slug: 'will-bitcoin-reach-100k-by-2025',
      eventSlug: 'crypto-predictions-2025',
      question: 'Will Bitcoin reach $100k by end of 2025?',
      description: 'Bitcoin price prediction for year-end 2025',
      imageUrl: 'https://images.unsplash.com/photo-1518546305927-30bceead58ce?w=400&h=300&fit=crop',
      outcomePricesJson: '["0.65","0.35"]',
      outcomeLabelsJson: '["Yes","No"]',
      endDate: new Date('2025-12-31'),
      active: true,
      closed: false,
      volume: 125000,
      volume24h: 15000,
      volume7d: 85000,
      volume30d: 125000,
      category: 'Crypto',
    },
    {
      id: 'mock-market-2',
      slug: 'will-india-win-cricket-world-cup-2025',
      eventSlug: 'sports-2025',
      question: 'Will India win the Cricket World Cup 2025?',
      description: 'India cricket team championship prediction',
      imageUrl: 'https://images.unsplash.com/photo-1624526267942-ab7cb9c3aeaf?w=400&h=300&fit=crop',
      outcomePricesJson: '["0.48","0.52"]',
      outcomeLabelsJson: '["Yes","No"]',
      endDate: new Date('2025-11-30'),
      active: true,
      closed: false,
      volume: 89000,
      volume24h: 12000,
      volume7d: 56000,
      volume30d: 89000,
      category: 'Sports',
    },
    {
      id: 'mock-market-3',
      slug: 'will-ai-model-pass-turing-test-2025',
      eventSlug: 'tech-predictions-2025',
      question: 'Will an AI model pass the Turing Test in 2025?',
      description: 'AI artificial intelligence breakthrough prediction',
      imageUrl: 'https://images.unsplash.com/photo-1677442d019cecf8f06c1b0d33e9d7fd6d5f6b6b?w=400&h=300&fit=crop',
      outcomePricesJson: '["0.72","0.28"]',
      outcomeLabelsJson: '["Yes","No"]',
      endDate: new Date('2025-12-31'),
      active: true,
      closed: false,
      volume: 156000,
      volume24h: 28000,
      volume7d: 95000,
      volume30d: 156000,
      category: 'Tech',
    },
    {
      id: 'mock-market-4',
      slug: 'will-spacex-land-on-mars-2025',
      eventSlug: 'space-exploration-2025',
      question: 'Will SpaceX successfully land on Mars in 2025?',
      description: 'Mars landing mission prediction',
      imageUrl: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=300&fit=crop',
      outcomePricesJson: '["0.22","0.78"]',
      outcomeLabelsJson: '["Yes","No"]',
      endDate: new Date('2025-12-31'),
      active: true,
      closed: false,
      volume: 203000,
      volume24h: 35000,
      volume7d: 125000,
      volume30d: 203000,
      category: 'Tech',
    },
    {
      id: 'mock-market-5',
      slug: 'will-ethereum-surpass-5k-2025',
      eventSlug: 'crypto-predictions-2025',
      question: 'Will Ethereum surpass $5,000 in 2025?',
      description: 'Ethereum price prediction',
      imageUrl: 'https://images.unsplash.com/photo-1516245834514-9a747067dbd7?w=400&h=300&fit=crop',
      outcomePricesJson: '["0.58","0.42"]',
      outcomeLabelsJson: '["Yes","No"]',
      endDate: new Date('2025-12-31'),
      active: true,
      closed: false,
      volume: 98000,
      volume24h: 14000,
      volume7d: 65000,
      volume30d: 98000,
      category: 'Crypto',
    },
    {
      id: 'mock-market-6',
      slug: 'will-new-iphone-release-2025',
      eventSlug: 'tech-predictions-2025',
      question: 'Will Apple release iPhone 17 in 2025?',
      description: 'Apple iPhone 17 release prediction',
      imageUrl: 'https://images.unsplash.com/photo-1592286927505-1def25115558?w=400&h=300&fit=crop',
      outcomePricesJson: '["0.95","0.05"]',
      outcomeLabelsJson: '["Yes","No"]',
      endDate: new Date('2025-12-31'),
      active: true,
      closed: false,
      volume: 45000,
      volume24h: 8000,
      volume7d: 28000,
      volume30d: 45000,
      category: 'Tech',
    },
    {
      id: 'mock-market-7',
      slug: 'will-us-election-see-record-turnout',
      eventSlug: 'politics-2025',
      question: 'Will US elections see record turnout in 2025?',
      description: 'US election voter turnout prediction',
      imageUrl: 'https://images.unsplash.com/photo-1611632622046-f77c71cfe3da?w=400&h=300&fit=crop',
      outcomePricesJson: '["0.41","0.59"]',
      outcomeLabelsJson: '["Yes","No"]',
      endDate: new Date('2025-11-30'),
      active: true,
      closed: false,
      volume: 310000,
      volume24h: 52000,
      volume7d: 185000,
      volume30d: 310000,
      category: 'Politics',
    },
    {
      id: 'mock-market-8',
      slug: 'will-tesla-model-2-launch-2025',
      eventSlug: 'tech-predictions-2025',
      question: 'Will Tesla launch Model 2 in 2025?',
      description: 'Tesla Model 2 vehicle launch prediction',
      imageUrl: 'https://images.unsplash.com/photo-1560958089-b8a63019b834?w=400&h=300&fit=crop',
      outcomePricesJson: '["0.67","0.33"]',
      outcomeLabelsJson: '["Yes","No"]',
      endDate: new Date('2025-12-31'),
      active: true,
      closed: false,
      volume: 112000,
      volume24h: 18000,
      volume7d: 72000,
      volume30d: 112000,
      category: 'Tech',
    },
  ];

  for (const market of markets) {
    await prisma.marketCache.create({
      data: market,
    });
  }

  console.log('✓ 8 markets created');
  console.log('✓ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
