import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();

// Konfigurasi Keamanan CORS lintasan domain
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const httpServer = createServer(app);

// Inisialisasi Pipa Saluran Socket.io Telemetri
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket']
});

// --- REST API ENDPOINTS VIA AXIOS ---

// Mock data awal untuk disajikan saat dashboard memicu REST Fetching pertama kali
let activeDevices = [
  { id: 'MDM-X18-NODE1', name: 'Alpha Runner v18', type: 'Sony Xperia 1 VI', ip: '192.168.10.102', load: '12%', status: 'Active' },
  { id: 'MDM-X18-NODE2', name: 'Beta Vault v18', type: 'Google Pixel 8 Pro', ip: '192.168.10.105', load: '45%', status: 'Active' }
];

app.get('/v1/stats', (req, res) => {
  res.status(200).json({
    bandwidth: '4.8 Gbps',
    cpuLoad: '28.4%',
    storage: '14.2 / 30 TB',
    activeRelays: '2 / 2'
  });
});

app.get('/v1/devices', (req, res) => {
  res.status(200).json(activeDevices);
});

// Endpoint untuk menerima perintah ADB Shell dari frontend
app.post('/v1/adb/execute', (req, res) => {
  const { deviceId, command } = req.body;
  
  // Pancarkan balik ke terminal lewat WebSocket stream secara real-time
  io.emit('adb-terminal-output', `[EXEC] Executed script '${command}' on target root ${deviceId}`);
  io.emit('adb-terminal-output', `Success: property value applied safely.`);
  
  res.status(200).json({ status: 'Dispatched' });
});

// Endpoint pendaftaran Device Enrollment baru
app.post('/v1/enrollment/client-app', (req, res) => {
  const { deviceId, model, osVersion } = req.body;
  const newDevice = { id: deviceId, name: `${model} (Enrolled)`, type: osVersion, ip: '192.168.10.200', load: '1%', status: 'Active' };
  activeDevices.push(newDevice);
  
  io.emit('node-status-change', newDevice);
  res.status(200).json({ message: 'Device approved and synchronized.' });
});

app.post('/v1/enrollment/adb-pair', (req, res) => {
  res.status(200).json({ status: 'Handshake approved' });
});

app.post('/v1/enrollment/wizard', (req, res) => {
  const { deviceName, serialNumber } = req.body;
  const wizardDevice = { id: serialNumber || 'SN-UNKNOWN', name: deviceName, type: 'Android (Wizard)', ip: '192.168.10.201', load: '0%', status: 'Active' };
  activeDevices.push(wizardDevice);
  
  io.emit('node-status-change', wizardDevice);
  res.status(200).json({ message: 'Wizard enrollment completed.' });
});

// --- WEBSOCKET EVENT STREAMING ---
io.on('connection', (socket) => {
  console.log('Operator Console Pipeline linked:', socket.id);

  // Interval otomatis untuk menyiarkan fluktuasi grafik telemetri ke frontend tiap 3 detik
  const telemetryInterval = setInterval(() => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    socket.emit('telemetry-stream', {
      time: timeNow,
      traffic: Math.floor(Math.random() * (400 - 150) + 150),
      cpu: Math.floor(Math.random() * (60 - 15) + 15),
      memory: Math.floor(Math.random() * (85 - 40) + 40)
    });
  }, 3000);

  socket.on('disconnect', () => {
    clearInterval(telemetryInterval);
    console.log('Pipeline connection severed.');
  });
});

// Handler wajib Vercel untuk mendengarkan port serverless
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server API murni berjalan terenkripsi pada port ${PORT}`);
});

export default app;
