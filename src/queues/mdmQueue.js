import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

export const adbCommandQueue = new Queue('AdbCommandExecutionPipeline', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  }
});
