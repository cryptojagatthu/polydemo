import { prisma } from '../lib/prisma';

async function seedMockData() {
  console.log('🌱 Seeding mock data for local development...\n');

  // Create sample markets
  const sampleMarkets = [
    {
      id: 'mock-market-1',
      slug: 'will-bitcoin-reach-100k-by-2025',
      question: 'Will Bitcoin reach $100k by end of 2025?',
      outcomePricesJson: JSON.stringify(['0.65', '0.35']),
      active: true,
      closed: false,
      volume: 125000,
      eventSlug: 'crypto-predictions-2025',
    },
    {
      id: 'mock-market-2',
      slug: 'will-india-win-cricket-world-cup-2025',
      question: 'Will India win the Cricket World Cup 2025?',
      outcomePricesJson: JSON.stringify(['0.48', '0.52']),
      active: true,
      closed: false,
      volume: 89000,
      eventSlug: 'sports-2025',
    },
    {
      id: 'mock-market-3',
      slug: 'will-ai-model-pass-turing-test-2025',
      question: 'Will an AI model pass the Turing Test in 2025?',
      outcomePricesJson: JSON.stringify(['0.72', '0.28']),
      active: true,
      closed: false,
      volume: 156000,
      eventSlug: 'tech-predictions-2025',
    },
    {
      id: 'mock-market-4',
      slug: 'will-spacex-land-on-mars-2025',
      question: 'Will SpaceX successfully land on Mars in 2025?',
      outcomePricesJson: JSON.stringify(['0.22', '0.78']),
      active: true,
      closed: false,
      volume: 203000,
      eventSlug: 'space-exploration-2025',
    },
    {
      id: 'mock-market-5',
      slug: 'will-ethereum-surpass-5k-2025',
      question: 'Will Ethereum surpass $5,000 in 2025?',
      outcomePricesJson: JSON.stringify(['0.58', '0.42']),
      active: true,
      closed: false,
      volume: 98000,
      eventSlug: 'crypto-predictions-2025',
    },
    {
      id: 'mock-market-6',
      slug: 'will-new-iphone-release-2025',
      question: 'Will Apple release iPhone 17 in 2025?',
      outcomePricesJson: JSON.stringify(['0.95', '0.05']),
      active: true,
      closed: false,
      volume: 45000,
      eventSlug: 'tech-predictions-2025',
    },
    {
      id: 'mock-market-7',
      slug: 'will-us-election-happen-2025',
      question: 'Will US midterm elections see record turnout?',
      outcomePricesJson: JSON.stringify(['0.41', '0.59']),
      active: true,
      closed: false,
      volume: 310000,
      eventSlug: 'politics-2025',
    },
    {
      id: 'mock-market-8',
      slug: 'will-tesla-model-2-launch-2025',
      question: 'Will Tesla launch Model 2 in 2025?',
      outcomePricesJson: JSON.stringify(['0.67', '0.33']),
      active: true,
      closed: false,
      volume: 112000,
      eventSlug: 'tech-predictions-2025',
    },
  ];

  for (const market of sampleMarkets) {
    await prisma.marketCache.upsert({
      where: { id: market.id },
      update: market,
      create: market,
    });
  }

  console.log(`✓ Created ${sampleMarkets.length} mock markets`);

  // Create sample events
  const sampleEvents = [
    {
      id: 'mock-event-1',
      slug: 'crypto-predictions-2025',
      title: 'Cryptocurrency Predictions 2025',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      tagsJson: JSON.stringify(['Crypto', 'Bitcoin', 'Ethereum']),
      active: true,
    },
    {
      id: 'mock-event-2',
      slug: 'sports-2025',
      title: 'Sports Events 2025',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      tagsJson: JSON.stringify(['Sports', 'Cricket', 'Football']),
      active: true,
    },
    {
      id: 'mock-event-3',
      slug: 'tech-predictions-2025',
      title: 'Technology Predictions 2025',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      tagsJson: JSON.stringify(['Technology', 'AI', 'Space']),
      active: true,
    },
    {
      id: 'mock-event-4',
      slug: 'politics-2025',
      title: 'Political Events 2025',
      startDate: '2025-01-01',
      endDate: '2025-11-30',
      tagsJson: JSON.stringify(['Politics', 'Elections', 'USA']),
      active: true,
    },
  ];

  for (const event of sampleEvents) {
    await prisma.eventCache.upsert({
      where: { id: event.id },
      update: event,
      create: event,
    });
  }

  console.log(`✓ Created ${sampleEvents.length} mock events`);

  console.log('\n✅ Mock data seeded successfully!');
  console.log('You can now develop locally and test your app.');
  console.log('When deployed to Render/Vercel, use the real sync script.\n');

  await prisma.$disconnect();
}

seedMockData().catch((error) => {
  console.error('Error seeding mock data:', error);
  process.exit(1);
});
