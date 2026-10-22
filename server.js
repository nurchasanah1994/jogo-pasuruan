'use strict';
/*
  Server Jogo Pasuruan. Tanpa library tambahan, cukup Node.js 18 ke atas.
  - Menyajikan game dari folder public/
  - Menghubungkan pemain dalam satu "ruang" (kode ruang yang sama)
  Pemain mengirim keadaannya lewat POST, dan menerima keadaan pemain lain lewat
  SSE (EventSource). Kalau SSE terhalang, browser otomatis pindah ke long-polling.
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'public', 'index.html');
const MAX_PEERS = 16, MAX_ROOMS = 200, MAX_BODY = 8192, MAX_PRESENCE = 6144, LOG_KEEP = 400;
const ROOM_RE = /^[a-z0-9][a-z0-9_.-]{0,47}$/, PEER_RE = /^[a-z0-9]{6,32}$/, KEY_RE = /^[A-Za-z_][A-Za-z0-9_-]{0,31}$/;

const rooms = new Map();
function getRoom(name, create) {
  let r = rooms.get(name);
  if (!r && create) {
    if (rooms.size >= MAX_ROOMS) return null;
    r = { peers: new Map(), log: [], seq: 0, waiters: new Set() };
    rooms.set(name, r);
  }
  return r;
}
function snapshot(room) {
  const o = {};
  room.peers.forEach((p, id) => { o[id] = p.presence; });
  return o;
}
function push(room, msg) {
  msg.seq = ++room.seq;
  room.log.push(msg);
  if (room.log.length > LOG_KEEP) room.log.splice(0, room.log.length - LOG_KEEP);
  const line = 'id: ' + msg.seq + '\ndata: ' + JSON.stringify(msg) + '\n\n';
  room.peers.forEach((p) => { if (p.sse) { try { p.sse.write(line); } catch (e) {} } });
  room.waiters.forEach((w) => flushWaiter(room, w));
}
function flushWaiter(room, w) {
  const msgs = room.log.filter((m) => m.seq > w.after);
  if (!msgs.length) return;
  room.waiters.delete(w); clearTimeout(w.timer);
  send(w.res, 200, { msgs, seq: room.seq });
}
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function addPeer(room, id) {
  let p = room.peers.get(id);
  if (p) { clearTimeout(p.goneTimer); p.goneTimer = null; return p; }
  if (room.peers.size >= MAX_PEERS) return null;
  p = { presence: {}, sse: null, last: Date.now(), goneTimer: null };
  room.peers.set(id, p);
  return p;
}
function removePeer(name, room, id) {
  const p = room.peers.get(id); if (!p) return;
  clearTimeout(p.goneTimer);
  if (p.sse) { try { p.sse.end(); } catch (e) {} }
  room.peers.delete(id);
  push(room, { t: 'bye', peer: id });
  if (!room.peers.size) { room.waiters.forEach((w) => { clearTimeout(w.timer); try { send(w.res, 200, { msgs: [], seq: room.seq }); } catch (e) {} }); rooms.delete(name); }
}
function readBody(req, cb) {
  let n = 0; const chunks = [];
  req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { req.destroy(); return; } chunks.push(c); });
  req.on('end', () => { try { cb(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { cb(e); } });
  req.on('error', () => cb(new Error('read')));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    fs.readFile(INDEX, (err, buf) => {
      if (err) { res.writeHead(500); return res.end('index.html tidak ditemukan'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
    return;
  }
  if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }

  if (parts[0] === 'rt' && parts.length === 3) {
    const name = parts[1], act = parts[2], id = url.searchParams.get('peer') || '';
    if (!ROOM_RE.test(name)) return send(res, 400, { error: 'ruang' });

    if (req.method === 'GET' && act === 'stream') {
      if (!PEER_RE.test(id)) return send(res, 400, { error: 'peer' });
      const room = getRoom(name, true); if (!room) return send(res, 503, { error: 'penuh' });
      const peer = addPeer(room, id); if (!peer) return send(res, 429, { error: 'ruang penuh' });
      if (peer.sse) { try { peer.sse.end(); } catch (e) {} }
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n');
      peer.sse = res; peer.last = Date.now();
      res.write('data: ' + JSON.stringify({ t: 'snap', peers: snapshot(room), seq: room.seq }) + '\n\n');
      const beat = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 15000);
      res.on('close', () => {
        clearInterval(beat);
        if (peer.sse === res) { peer.sse = null; peer.goneTimer = setTimeout(() => removePeer(name, room, id), 6000); }
      });
      return;
    }

    if (req.method === 'GET' && act === 'poll') {
      if (!PEER_RE.test(id)) return send(res, 400, { error: 'peer' });
      const room = getRoom(name, true); if (!room) return send(res, 503, { error: 'penuh' });
      const peer = addPeer(room, id); if (!peer) return send(res, 429, { error: 'ruang penuh' });
      peer.last = Date.now();
      const after = parseInt(url.searchParams.get('after') || '0', 10) || 0;
      const first = room.log.length ? room.log[0].seq : room.seq + 1;
      if (after === 0 || after < first - 1) return send(res, 200, { snap: { peers: snapshot(room) }, msgs: [], seq: room.seq });
      const msgs = room.log.filter((m) => m.seq > after);
      if (msgs.length) return send(res, 200, { msgs, seq: room.seq });
      const w = { res, after, timer: null };
      w.timer = setTimeout(() => { room.waiters.delete(w); peer.last = Date.now(); send(res, 200, { msgs: [], seq: room.seq }); }, 20000);
      room.waiters.add(w);
      res.on('close', () => { room.waiters.delete(w); clearTimeout(w.timer); });
      return;
    }

    if (req.method === 'POST' && (act === 'presence' || act === 'bye')) {
      readBody(req, (err, body) => {
        if (err || !body || typeof body !== 'object') return send(res, 400, { error: 'isi' });
        const pid = String(body.peer || '');
        const room = getRoom(name, false), peer = room && room.peers.get(pid);
        if (!peer) return send(res, 404, { error: 'tidak terdaftar' });
        if (act === 'bye') { removePeer(name, room, pid); return send(res, 200, { ok: 1 }); }
        const patch = body.patch;
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return send(res, 400, { error: 'patch' });
        const keys = Object.keys(patch);
        if (keys.length > 24 || keys.some((k) => !KEY_RE.test(k))) return send(res, 400, { error: 'kunci' });
        const next = Object.assign({}, peer.presence);
        keys.forEach((k) => { if (patch[k] === null) delete next[k]; else next[k] = patch[k]; });
        if (JSON.stringify(next).length > MAX_PRESENCE) return send(res, 413, { error: 'terlalu besar' });
        peer.presence = next; peer.last = Date.now();
        push(room, { t: 'patch', peer: pid, patch });
        return send(res, 200, { ok: 1 });
      });
      return;
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Tidak ditemukan');
});

/* pemain long-polling yang berhenti menghubungi server selama 30 detik dianggap keluar */
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, name) => {
    room.peers.forEach((p, id) => { if (!p.sse && now - p.last > 30000) removePeer(name, room, id); });
  });
}, 5000);

server.listen(PORT, () => console.log('Jogo Pasuruan berjalan di port ' + PORT));
