import http from 'node:http';

const server = http.createServer((req, res) => {
  if (req.url === '/sehat') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  res.writeHead(404);
  res.end('tidak ditemukan');
});

server.listen(process.env.PORT || 3000);
