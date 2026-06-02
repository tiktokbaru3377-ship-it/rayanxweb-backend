const logger = require('./logger');

const MEMORY_THRESHOLD_MB = 1024; // Batas toleransi RAM 1GB untuk 1 proses Node.js Container

const initWatchdog = () => {
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const rssInMb = memoryUsage.rss / 1024 / 1024;

    if (rssInMb > MEMORY_THRESHOLD_MB) {
      logger.error(`[CRITICAL SYSTEM ALERT] Memory threshold exceeded! RSS: ${rssInMb.toFixed(2)} MB / Limit: ${MEMORY_THRESHOLD_MB} MB. Initiating self-healing process recycling...`);
      
      // 1. Matikan fungsi penerimaan koneksi baru pada server HTTP
      const { io } = require('../server');
      io.close(() => {
        logger.info('Socket.IO Broker network drained and closed gracefully.');
        
        // 2. Berikan waktu 10 detik bagi worker aktif untuk menyelesaikan tugas terakhir
        setTimeout(() => {
          logger.warn('Process killing triggered gracefully by Watchdog Engine.');
          process.exit(1); // Docker / PM2 akan otomatis mengangkat container baru dalam < 1 detik tanpa memutus koneksi di load-balancer Nginx
        }, 10000);
      });
    }
  }, 30000); // Evaluasi kesehatan memori runtime setiap 30 detik
};

module.exports = { initWatchdog };
