import { createApp } from './app.ts';
import { createStore, DEFAULT_ADMIN_PASSWORD, loadConfig } from './config.ts';
import { lanAddresses } from './network.ts';

const dev = process.argv.includes('--dev');
const config = loadConfig();
const store = createStore(config);

if (config.adminPassword === DEFAULT_ADMIN_PASSWORD) {
  console.warn(`⚠️  Chưa đặt ADMIN_PASSWORD, đang dùng mật khẩu mặc định "${DEFAULT_ADMIN_PASSWORD}"`);
}

const { httpServer, close } = await createApp({
  store,
  adminPassword: config.adminPassword,
  publicUrl: config.publicUrl,
  client: dev ? 'dev' : 'static',
});

httpServer.listen(config.port, async () => {
  const [best, ...others] = await lanAddresses();
  console.log(`🎤 Bắt Bài đang chạy: http://localhost:${config.port}`);
  if (config.publicUrl) console.log(`   Điện thoại vào:   ${config.publicUrl} (PUBLIC_URL)`);
  else if (best) console.log(`   Điện thoại vào:   http://${best}:${config.port} (cùng Wi-Fi với máy này)`);
  for (const ip of others) console.log(`   IP khác:          http://${ip}:${config.port}`);
  console.log(`   Lưu trữ: ${store.description}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void close().then(() => process.exit(0));
  });
}
