import { createStore } from './store.mjs';
import { createApp } from './app.mjs';
const store = createStore();
const port = Number(process.env.PORT || 3001);
createApp(store).listen(port, process.env.HOST || '0.0.0.0', () => console.log(`API http://localhost:${port} | Database: ${store.mode}`));
