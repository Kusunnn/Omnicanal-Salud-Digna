import { defineConfig, loadEnv } from 'vite';

const patientCookie = 'salud-digna-session';
const adminCookie = 'salud-digna-admin-demo';
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = process.env.SALUD_DIGNA_API || 'http://localhost:5080';
  const adminKey = process.env.SALUD_DIGNA_LOCAL_ADMIN_KEY || env.SALUD_DIGNA_LOCAL_ADMIN_KEY;

  function installLocalAdmin(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/admin-api/')) return next();
      const host = req.headers.host;
      const origin = req.headers.origin;
      const expectedOrigin = 'http://' + host;
      if (!loopback.has(req.socket.remoteAddress) || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host ?? '')
        || (origin && origin !== expectedOrigin) || !adminKey) {
        res.statusCode = 403;
        return res.end(JSON.stringify({ title: 'La administración local no está habilitada.' }));
      }
      if (req.url !== '/admin-api/demo/session') return next();
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      try {
        const upstream = await fetch(new URL('/api/demo/identidad/personal', target), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rol: 'ADMIN', clave: adminKey }),
        });
        const cookies = upstream.headers.getSetCookie();
        if (cookies.length) {
          res.setHeader('Set-Cookie', cookies.map(cookie =>
            cookie.replace(/^salud-digna-session=/, adminCookie + '=').replace(/;\s*path=\//i, '; Path=/admin-api')));
        }
        res.statusCode = upstream.status;
        res.end(await upstream.text());
      } catch {
        res.statusCode = 503;
        res.end(JSON.stringify({ title: 'El backend local no responde.' }));
      }
    });
  }

  const proxy = {
    '^/api/': { target, changeOrigin: true },
    '^/admin-api/': {
      target,
      changeOrigin: true,
      rewrite: path => path.replace(/^\/admin-api\//, '/api/'),
      configure(proxyServer) {
        proxyServer.on('proxyReq', (outgoing, incoming) => {
          const cookie = (incoming.headers.cookie ?? '').split(';').map(value => value.trim())
            .find(value => value.startsWith(adminCookie + '='));
          if (cookie) outgoing.setHeader('Cookie', patientCookie + cookie.slice(adminCookie.length));
          else outgoing.removeHeader('Cookie');
        });
      },
    },
  };
  return {
    plugins: [{ name: 'local-admin-session', configureServer: installLocalAdmin, configurePreviewServer: installLocalAdmin }],
    server: { proxy }, preview: { proxy },
  };
});
