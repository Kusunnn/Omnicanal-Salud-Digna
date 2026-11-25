import { defineConfig, loadEnv } from 'vite';

const patientCookie = 'salud-digna-session';
const staffViews = [
  { prefix: '/admin-api', cookie: 'salud-digna-admin-demo', role: 'ADMIN', key: 'SALUD_DIGNA_LOCAL_ADMIN_KEY' },
  { prefix: '/operador-api', cookie: 'salud-digna-operador-demo', role: 'ASESOR', key: 'SALUD_DIGNA_LOCAL_ADVISOR_KEY' },
];
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = process.env.SALUD_DIGNA_API || 'http://localhost:5080';

  function installLocalStaff(server) {
    server.middlewares.use(async (req, res, next) => {
      const view = staffViews.find(item => req.url?.startsWith(item.prefix + '/'));
      if (!view) return next();
      const key = process.env[view.key] || env[view.key];
      const host = req.headers.host;
      const origin = req.headers.origin;
      const expectedOrigin = 'http://' + host;
      if (!loopback.has(req.socket.remoteAddress) || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host ?? '')
        || (origin && origin !== expectedOrigin) || !key) {
        res.statusCode = 403;
        return res.end(JSON.stringify({ title: 'El acceso local a este tablero no está habilitado.' }));
      }
      if (req.url !== view.prefix + '/demo/session') return next();
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      try {
        const upstream = await fetch(new URL('/api/demo/identidad/personal', target), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rol: view.role, clave: key }),
        });
        const cookies = upstream.headers.getSetCookie();
        if (cookies.length) {
          res.setHeader('Set-Cookie', cookies.map(cookie =>
            cookie.replace(/^salud-digna-session=/, view.cookie + '=').replace(/;\s*path=\//i, '; Path=' + view.prefix)));
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
    ...Object.fromEntries(staffViews.map(view => [`^${view.prefix}/`, {
      target,
      changeOrigin: true,
      rewrite: path => '/api' + path.slice(view.prefix.length),
      configure(proxyServer) {
        proxyServer.on('proxyReq', (outgoing, incoming) => {
          const cookie = (incoming.headers.cookie ?? '').split(';').map(value => value.trim())
            .find(value => value.startsWith(view.cookie + '='));
          if (cookie) outgoing.setHeader('Cookie', patientCookie + cookie.slice(view.cookie.length));
          else outgoing.removeHeader('Cookie');
        });
      },
    }])),
  };
  return {
    plugins: [{ name: 'local-staff-session', configureServer: installLocalStaff, configurePreviewServer: installLocalStaff }],
    server: { proxy }, preview: { proxy },
  };
});
