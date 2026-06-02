const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/server'); // Ekspor app dari server.js tanpa mendengarkan port saat tes
const Device = require('../src/models/Device');

describe('=== MDM Core Integration Test Pipeline ===', () => {
  
  beforeAll(async () => {
    // Hubungkan ke database sandbox/test khusus
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/rayanxweb_test');
    }
  });

  afterEach(async () => {
    // Bersihkan koleksi setelah setiap skenario pengujian selesai
    await Device.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should deny access to device endpoints if Bearer token is missing', async () => {
    const res = await request(app)
      .get('/api/devices')
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Missing Bearer Token');
  });

  it('should successfully register a new device via client app payload', async () => {
    // Catatan: Untuk menjalankan ini dalam CI/CD, buat mock untuk middleware authGuard Anda
    const mockPayload = {
      deviceId: "TEST_DEVICE_INFRA_2026",
      deviceName: "Enterprise Tablet X1",
      brand: "RayanX",
      model: "RX-2026"
    };

    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', 'Bearer MOCK_VALID_FIREBASE_TOKEN') // Di-handle oleh mock middleware di lingkungan tes
      .send(mockPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deviceId).toBe("TEST_DEVICE_INFRA_2026");
  });
});
