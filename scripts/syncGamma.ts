import axios from 'axios';
import { prisma } from '../lib/prisma';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';

async function syncMarkets() {
  console.log('Starting market sync...');
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  let totalSynced = 0;

  while (hasMore) {
    try {
      const url = `${GAMMA_BASE}/markets?active=true&closed=false&limit=${limit}&offset=${offset}`;
      console.log(`Fetching markets: offset ${offset}`);
      
      const response = await axios.get(url);
      const markets = response.data;

      if (!markets || markets.length === 0) {
        hasMore = false;
        break;
      }

      for (const market of markets) {
        try {
          let outcomePrices = market.outcomePrices;
          
          // Parse if it's a string
          if (typeof outcomePrices === 'string') {
            outcomePrices = JSON.parse(outcomePrices);
          }

          await prisma.marketCache.upsert({
            where: { id: market.id },
            update: {
              slug: market.slug,
              question: market.question,
              outcomePricesJson: JSON.stringify(outcomePrices),
              active: market.active ?? true,
              closed: market.closed ?? false,
              volume: parseFloat(market.volume) || 0,
              eventSlug: market.eventSlug || null,
              lastSynced: new Date(),
            },
            create: {
              id: market.id,
              slug: market.slug,
              eventSlug: market.eventSlug || null,
              question: market.question,
              outcomePricesJson: JSON.stringify(outcomePrices),
              active: market.active ?? true,
              closed: market.closed ?? false,
              volume: parseFloat(market.volume) || 0,
              lastSynced: new Date(),
            },
          });

          totalSynced++;
        } catch (err) {
          console.error(`Error syncing market ${market.id}:`, err);
        }
      }

      console.log(`✓ Synced batch of ${markets.length} markets (total: ${totalSynced})`);
      offset += limit;

      // Add small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error('Error fetching markets:', error);
      hasMore = false;
    }
  }

  console.log(`✓ Market sync complete! Total markets: ${totalSynced}`);
}

async function syncEvents() {
  console.log('Starting event sync...');
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  let totalSynced = 0;

  while (hasMore) {
    try {
      const url = `${GAMMA_BASE}/events?order=id&ascending=false&closed=false&limit=${limit}&offset=${offset}`;
      console.log(`Fetching events: offset ${offset}`);
      
      const response = await axios.get(url);
      const events = response.data;

      if (!events || events.length === 0) {
        hasMore = false;
        break;
      }

      for (const event of events) {
        try {
          await prisma.eventCache.upsert({
            where: { id: event.id },
            update: {
              slug: event.slug,
              title: event.title,
              startDate: event.startDate || null,
              endDate: event.endDate || null,
              tagsJson: JSON.stringify(event.tags || []),
              active: event.active ?? true,
              lastSynced: new Date(),
            },
            create: {
              id: event.id,
              slug: event.slug,
              title: event.title,
              startDate: event.startDate || null,
              endDate: event.endDate || null,
              tagsJson: JSON.stringify(event.tags || []),
              active: event.active ?? true,
              lastSynced: new Date(),
            },
          });

          totalSynced++;
        } catch (err) {
          console.error(`Error syncing event ${event.id}:`, err);
        }
      }

      console.log(`✓ Synced batch of ${events.length} events (total: ${totalSynced})`);
      offset += limit;

      // Add small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error('Error fetching events:', error);
      hasMore = false;
    }
  }

  console.log(`✓ Event sync complete! Total events: ${totalSynced}`);
}

async function main() {
  console.log('🚀 Starting Polymarket data sync...\n');
  
  try {
    await syncMarkets();
    console.log('');
    await syncEvents();
    console.log('\n✅ All syncing complete!');
  } catch (error) {
    console.error('❌ Sync failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
