#!/usr/bin/env node
// Renderiza index.html cuadro por cuadro (Chromium headless) y codifica a MP4 H.264.
//
// Uso:  node render/render.mjs [--fmt 16x9|9x16|1x1] [--fps 30] [--scale 1] [--from 0] [--to <duración>]
//                              [--workers 4] [--out out/_video.mp4] [--frames <t1,t2,...> --dir <carpeta>]
//
// Con --frames sólo guarda PNGs de esos instantes (para revisar diseño) en --dir.
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return createRequire(path.join(globalRoot, '/'))('playwright');
}
const { chromium } = loadPlaywright();

const fps = +(args.fps || 30);
const scale = +(args.scale || 1);
const fmt = args.fmt || '9x16';
const [VW, VH] = fmt === '9x16' ? [1080, 1920] : fmt === '1x1' ? [1080, 1080] : [1920, 1080];
const url = pathToFileURL(path.join(ROOT, 'index.html')).href + '?render=1&fmt=' + fmt;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: scale });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(url);
  await page.evaluate(() => window.READY);
  return page;
}

const browser = await chromium.launch();
try {
  if (args.frames) {
    const dir = path.resolve(args.dir || path.join(ROOT, 'out', 'cuadros'));
    fs.mkdirSync(dir, { recursive: true });
    const page = await openPage(browser);
    for (const t of args.frames.split(',').map(Number)) {
      await page.evaluate(t => window.seek(t), t);
      await page.screenshot({ path: path.join(dir, `f_${t.toFixed(2).padStart(5, '0')}.png`) });
    }
    console.log('cuadros en', dir);
  } else {
    const duration = await (await openPage(browser)).evaluate(() => window.DURATION);
    const from = +(args.from || 0), to = +(args.to || duration);
    const total = Math.round((to - from) * fps);
    const workers = Math.max(1, Math.min(+(args.workers || Math.min(4, os.cpus().length)), total));
    const out = path.resolve(args.out || path.join(ROOT, 'out', '_video.mp4'));
    const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.frames-'));
    const t0 = Date.now();
    let done = 0;
    const chunk = Math.ceil(total / workers);
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const page = await openPage(browser);
      for (let i = w * chunk; i < Math.min(total, (w + 1) * chunk); i++) {
        await page.evaluate(t => window.seek(t), from + i / fps);
        await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(5, '0')}.png`) });
        if (++done % 30 === 0 || done === total) {
          const el = (Date.now() - t0) / 1000;
          process.stdout.write(`\r${done}/${total} cuadros · ${el.toFixed(0)} s · faltan ~${(el / done * (total - done)).toFixed(0)} s   `);
        }
      }
      await page.close();
    }));
    console.log('\ncodificando', out);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, 'f%05d.png'),
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 17), '-profile:v', 'high', '-level', '4.2',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-g', String(fps), '-movflags', '+faststart', out], { stdio: 'inherit' });
    const code = await new Promise(r => ff.on('close', r));
    fs.rmSync(tmp, { recursive: true, force: true });
    if (code !== 0) throw new Error('ffmpeg terminó con código ' + code);
    console.log(`listo en ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
  }
} finally {
  await browser.close();
}
