const http = require('http');

http.get('http://127.0.0.1:4000/', (res) => {
  console.log('HTTP Status:', res.statusCode);
  let body = '';
  res.on('data', (c) => { body += c; });
  res.on('end', () => { console.log('Body:', body); process.exit(0); });
}).on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
