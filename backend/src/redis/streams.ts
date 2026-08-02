// Redis Streams for weave

import { createClient } from 'redis';

class RedisStreamService {
  private client: any;

  constructor(url: string) {
    this.client = createClient({ url });
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.disconnect();
  }

  async addEntry(stream: string, data: any) {
    return await this.client.xAdd(stream, '*', data);
  }

  async readStream(stream: string, count = 10, block = 0) {
    return await this.client.xRead(
      { key: stream, count },
      { block }
    );
  }

  async readGroup(stream: string, group: string, consumer: string, count = 10) {
    return await this.client.xReadGroup(
      group,
      consumer,
      { key: stream, count }
    );
  }

  async createGroup(stream: string, group: string, id = '0') {
    try {
      return await this.client.xGroupCreate(stream, group, id);
    } catch (error) {
      // Group might already exist
      return null;
    }
  }

  async createConsumer(stream: string, group: string, consumer: string) {
    return await this.client.xGroupCreateConsumer(stream, group, consumer);
  }

  async acknowledge(stream: string, group: string, id: string) {
    return await this.client.xAck(stream, group, id);
  }

  async getStreamLength(stream: string) {
    return await this.client.xLen(stream);
  }

  async trimStream(stream: string, maxLength: number) {
    return await this.client.xTrim(stream, 'MAXLEN', '~', maxLength);
  }

  async getRange(stream: string, start = '-', end = '+') {
    return await this.client.xRange(stream, start, end);
  }

  async deleteEntry(stream: string, id: string) {
    return await this.client.xDel(stream, id);
  }

  async addDocumentEvent(documentId: string, eventType: string, data: any) {
    return await this.addEntry('document-events', {
      documentId,
      eventType,
      timestamp: Date.now(),
      ...data
    });
  }

  async addCollaborationEvent(documentId: string, userId: string, action: string) {
    return await this.addEntry('collaboration-events', {
      documentId,
      userId,
      action,
      timestamp: Date.now()
    });
  }

  async consumeDocumentEvents(group: string, consumer: string) {
    await this.createGroup('document-events', group);
    await this.createConsumer('document-events', group, consumer);
    return await this.readGroup('document-events', group, consumer);
  }
}

export default RedisStreamService;
