/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineConfig } from 'vite';

const port = parseInt(process.env.PORT || '7789', 10);
const host = '127.0.0.1';

const licenseBanner = `/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */`;

export default defineConfig({
  root: '.',
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        banner: licenseBanner,
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'styles.css';
          }
          return 'assets/[name][extname]';
        }
      }
    }
  },
  server: {
    port,
    host,
    strictPort: true
  },
  plugins: [
    {
      name: 'agy-game-studio-sidecar-preload',
      transformIndexHtml(html) {
        return html
          .replace(/\s+crossorigin(?:="[^"]*")?/g, '')
          .replace(/<script\s+type="module"\s+src="\/app\.js"><\/script>\s*/g, '')
          .replace(
            '<link rel="stylesheet" href="/styles.css">',
            '<link rel="stylesheet" href="/styles.css">\n  <!-- Bridge to Antigravity: applies the host theme and defines window.sidecar. -->\n  <script src="/preload.js"></script>'
          )
          .replace('</body>', '  <script src="/app.js"></script>\n</body>');
      },
      async configureServer(server) {
        process.env.VITE_DEV_MODE = '1';
        const { handleRequest } = await import('./server/index.mjs');
        server.middlewares.use(async (req, res, next) => {
          if (req.url && (req.url.startsWith('/api/') || req.url.startsWith('/_sidecar/'))) {
            await handleRequest(req, res);
            return;
          }
          next();
        });
      }
    }
  ]
});
