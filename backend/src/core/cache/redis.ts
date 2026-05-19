import { createClient, RedisClientType } from 'redis';

class RedisService {
  private client: RedisClientType | null = null;

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.client.on('error', (err) => {
      console.error('Redis error:', err);
    });

    await this.client.connect();
    console.log('✅ Connected to Redis');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client.get(key);
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    if (expirySeconds) {
      await this.client.setEx(key, expirySeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    await this.client.del(key);
  }

  getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }
}

export const redisService = new RedisService();
