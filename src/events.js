'use strict';
/**
 * Canlı yayın (Server-Sent Events).
 * Bir terminalde koltuk satıldığında/iptal edildiğinde, aynı seferi açık tutan
 * diğer tüm terminaller anında haber alır ve koltuk haritasını tazeler.
 */

const clients = new Set(); // { res, user, id }
let nextId = 1;

function addClient(req, res, user) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no' // Nginx arkasında tamponlamayı kapat
  });
  res.write('retry: 3000\n\n');

  const client = { id: nextId++, res, user };
  clients.add(client);

  res.write(`event: hello\ndata: ${JSON.stringify({ id: client.id, online: clients.size })}\n\n`);
  broadcastPresence();

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* kapanmış */ }
  }, 25000);

  const close = () => {
    clearInterval(ping);
    clients.delete(client);
    broadcastPresence();
    try { res.end(); } catch {}
  };
  req.on('close', close);
  req.on('error', close);
}

function publish(type, data, exceptUserId) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (exceptUserId && c.user.id === exceptUserId) continue;
    try { c.res.write(payload); } catch { clients.delete(c); }
  }
}

let presenceTimer = null;
function broadcastPresence() {
  clearTimeout(presenceTimer);
  presenceTimer = setTimeout(() => {
    const names = [...new Set([...clients].map((c) => c.user.full_name))];
    publish('presence', { count: clients.size, users: names });
  }, 300);
}

const onlineCount = () => clients.size;

module.exports = { addClient, publish, onlineCount };
