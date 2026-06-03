const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('../config');
const path = require('path');

// Definisi Format Kustom untuk Produksi
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }), // Menangkap stack trace error
  winston.format.splat(),                 // Mendukung string interpolation %s, %d
  winston.format.metadata(),              // Memisahkan metadata
  winston.format.json()                   // Format JSON standar untuk log aggregator
);

// Transportasi: Rotasi Harian (Mencegah log file membengkak)
const dailyRotateOptions = {
  dirname: path.join(__dirname, '../logs'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,      // Kompres log lama agar hemat ruang
  maxSize: '20m',           // Maksimal 20MB per file
  maxFiles: '14d',          // Simpan log selama 14 hari saja
};

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'rayanxweb-backend',
    env: config.env,
    pid: process.pid 
  },
  transports: [
    // Error Logs terpisah untuk investigasi cepat
    new winston.transports.DailyRotateFile({
      ...dailyRotateOptions,
      filename: 'error-%DATE%.log',
      level: 'error',
    }),
    // Combined Logs untuk histori aktivitas sistem
    new winston.transports.DailyRotateFile({
      ...dailyRotateOptions,
      filename: 'combined-%DATE%.log',
    }),
  ],
  // Jika terjadi kesalahan saat proses logging, jangan crash server
  handleExceptions: true,
  handleRejections: true,
});

// Tambahkan output Console untuk debugging real-time di lingkungan lokal/Docker logs
if (config.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return `[${timestamp}] ${level}: ${stack || message}`;
      })
    ),
  }));
}

module.exports = logger;
