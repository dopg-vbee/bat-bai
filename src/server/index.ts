import { createApp, lanAddresses } from './app.ts';
import { createStore, DEFAULT_ADMIN_PASSWORD, loadConfig } from './config.ts';

const dev = process.argv.includes('--dev');
const config = loadConfig();
const store = createStore(config);

if (config.adminPassword === DEFAULT_ADMIN_PASSWORD) {
  console.warn(`⚠️  Chưa đặt ADMIN_PASSWORD, đang dùng mật khẩu mặc định "${DEFAULT_ADMIN_PASSWORD}"`);
}

const { httpServer, close } = await createApp({
  store,
  adminPassword: config.adminPassword,
  client: dev ? 'dev' : 'static',
});

httpServer.listen(config.port, () => {
  console.log(`🎤 Bắt Bài đang chạy: http://localhost:${config.port}`);
  for (const ip of lanAddresses()) console.log(`   Trong mạng LAN:   http://${ip}:${config.port}`);
  console.log(`   Lưu trữ: ${store.description}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void close().then(() => process.exit(0));
  });
}
