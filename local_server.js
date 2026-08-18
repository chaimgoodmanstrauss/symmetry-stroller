#!/usr/bin/env node
// Trusted LOCAL-ONLY server: serves this repo as static files (same as
// `python3 -m http.server`, so existing URLs keep working) and adds a
// same-origin /deploy API that the maker page's "Deploy" button calls.
//
// Why this exists instead of a plain static server: a browser can't make
// an SFTP connection or read an arbitrary local file (like the deploy
// credentials) on its own — that's not something web pages are allowed to
// do, by design. This process is the trusted, non-browser side of that:
// it runs ONLY on your machine, reads deploy.sh's credentials itself (the
// page never sees them, and deploy.sh already keeps them outside the repo
// — see symmetrystroller/deploy.example.env), and shells out to
// deploy.sh when asked.
//
// Bound to 127.0.0.1 only — never reachable from the network, and the
// /deploy endpoint checks Origin so an unrelated page/tab can't trigger a
// deploy just by knowing the port. Serving the page and the API from the
// SAME origin (one port) also means the button's fetch('/deploy') is
// same-origin automatically: no CORS configuration, and — just as
// important — index.html's use of it is inert everywhere else, including
// on the real remote server, since a relative fetch('/deploy-status')
// there just hits a path that doesn't exist.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8934;
const ROOT = __dirname;
const DEPLOY_SCRIPT = path.join(ROOT, 'symmetrystroller', 'deploy.sh');
const CREDS_FILE = path.join(process.env.HOME || '', '.symmetrystroller_deploy.env');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

function isLocalOrigin(req) {
    const origin = req.headers.origin || req.headers.referer || '';
    return origin === '' || /^https?:\/\/(localhost|127\.0\.0\.1):8934\b/.test(origin);
}

function serveStatic(req, res) {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

    fs.stat(filePath, (err, stat) => {
        if (!err && stat.isDirectory() && !urlPath.endsWith('/')) {
            // Same behavior as `python3 -m http.server`: a directory
            // request without a trailing slash gets redirected to one
            // WITH it, before ever serving index.html — otherwise the
            // browser's address bar stays at .../symmetrystroller (no
            // slash) while the served page's relative fetches (walks.json,
            // walks/*, fonts/*) resolve against its PARENT directory
            // instead, since that's how relative URL resolution treats a
            // path segment with no trailing slash. Every existing bookmark
            // and test URL in this app uses the no-slash form, so this
            // has to match, not just "also work directly".
            res.writeHead(302, { Location: urlPath + '/' + query });
            res.end();
            return;
        }
        if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
        fs.readFile(filePath, (err2, data) => {
            if (err2) { res.writeHead(404); res.end('Not found'); return; }
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            res.end(data);
        });
    });
}

function handleDeployStatus(req, res) {
    fs.access(CREDS_FILE, fs.constants.R_OK, (err) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ available: !err }));
    });
}

function handleDeploy(req, res) {
    if (!isLocalOrigin(req)) { res.writeHead(403); res.end('Forbidden'); return; }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        let payload;
        try { payload = JSON.parse(body || '{}'); } catch { payload = {}; }
        const args = [];
        if (payload.target === 'code') {
            args.push('code');
        } else if (payload.target === 'walk' && payload.slug) {
            args.push('walk', String(payload.slug));
        } else if (payload.target === 'all') {
            args.push('all');
        } else {
            res.writeHead(400); res.end('Bad request: need {target, slug}'); return;
        }

        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' });
        const proc = spawn(DEPLOY_SCRIPT, args, { cwd: path.join(ROOT, 'symmetrystroller') });
        proc.stdout.on('data', d => res.write(d));
        proc.stderr.on('data', d => res.write(d));
        proc.on('close', code => {
            res.write(`\n[deploy.sh exited with code ${code}]`);
            res.end();
        });
        proc.on('error', err => {
            res.write(`\n[failed to run deploy.sh: ${err.message}]`);
            res.end();
        });
    });
}

const server = http.createServer((req, res) => {
    if (req.url === '/deploy-status' && req.method === 'GET') return handleDeployStatus(req, res);
    if (req.url === '/deploy' && req.method === 'POST') return handleDeploy(req, res);
    serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Local server (with deploy) running at http://localhost:${PORT}/`);
    console.log(`Deploy credentials: ${CREDS_FILE} ${fs.existsSync(CREDS_FILE) ? '(found)' : '(NOT found — deploy button will stay hidden)'}`);
});
