// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Backend entrypoint for the Playtest Studio UI extension.
// Antigravity starts this file with Node.js (see sidecar.json) and sets
// ANTIGRAVITY_SIDECAR_WEB_PORT; SidecarApp listens on it automatically.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';
import { configureSidecarApp } from '../../server/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..', '..', 'server');
const distDir = path.resolve(__dirname, '..', '..', 'dist');
let restartTimer = null;
function scheduleSupervisorRestart(reason) {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log(`[sidecar] ${reason}, exiting for supervisor restart...`);
    process.exit(0);
  }, 250);
}
try {
  fs.watch(serverDir, { recursive: true }, (_eventType, filename) => {
    if (filename && filename.endsWith('.mjs')) {
      scheduleSupervisorRestart(`Backend file changed (${filename})`);
    }
  });
  fs.watch(distDir, { recursive: true }, (_eventType, filename) => {
    if (filename && (filename.endsWith('.js') || filename.endsWith('.css'))) {
      scheduleSupervisorRestart(`Frontend bundle updated (${filename})`);
    }
  });
} catch {
  // Ignore if recursive watch is unsupported
}

const app = new SidecarApp();
configureSidecarApp(app, Response);
const server = await app.run();

if (server && typeof server.on === 'function') {
  server.on('request', (req, res) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(
        `[sidecar-http] ${new Date().toISOString()} ${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - start}ms)`
      );
    });
  });
}
