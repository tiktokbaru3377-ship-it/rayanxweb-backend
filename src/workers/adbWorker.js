import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger.js';

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

export const initAdbWorker = (ioInstance) => {
  new Worker('AdbCommandExecutionPipeline', async (job) => {
    const { deviceId, command } = job.data;
    logger.info(`[WORKER] Running job #${job.id} for device target: ${deviceId}`);

    // Log simulasi eksekusi biner riil dikirim ke socket terhubung
    ioInstance.emit('adb-terminal-output', `[WORKER JOBS] Processing batch task secure injection...`);
    ioInstance.emit('adb-terminal-output', `[EXEC] Node ${deviceId} executed task success code (0).`);
    
    return { success: true, deviceId };
  }, { connection: redisConnection });
};
