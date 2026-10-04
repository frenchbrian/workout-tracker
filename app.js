import * as db from './data.js';
import { h, shortDate } from './ui.js';
import { renderSession } from './session.js';

const root = document.getElementById('app');
const toastEl = document.getElementById('toast');
let toastTimer;

function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = isError ? 'show error' : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = ''; }, isError ? 6000 : 1500);
}

function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

function renderSignedOut() {
  root.replaceChildren(
    h('p', {}, 'Sign in to log your workouts.'),
    h('button', {
      type: 'button',
      onclick: async () => {
        const { error } = await db.supabase.auth.signInWithOAuth({
          provider: 'github',
          options: { redirectTo: location.origin + location.pathname },
        });
        if (error) toast(`Sign-in failed: ${error.message}`, true);
      },
    }, 'Sign in with GitHub'));
}

async function renderHome() {
  root.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
  const workouts = await db.listWorkouts();
  const cards = workouts.map((w) => {
    const start = h('button', { type: 'button' }, w.todaySession ? "Continue today's workout" : 'Start workout');
    start.addEventListener('click', async () => {
      start.disabled = true;
      try {
        const id = w.todaySession ?? await db.startSession(w.id);
        go(`#/session/${id}`);
      } catch (err) {
        toast(`Couldn't start: ${err.message}`, true);
        start.disabled = false;
      }
    });
    return h('li', { class: 'card' },
      h('div', {}, h('strong', {}, w.name), h('div', { class: 'muted' }, w.lastDone ? `Last done ${shortDate(w.lastDone)}` : 'Not done yet')),
      start);
  });
  root.replaceChildren(
    h('ul', { class: 'cards' }, cards),
    h('div', { class: 'footer-actions' },
      h('button', { type: 'button', class: 'secondary', onclick: exportCsv }, 'Download all data (CSV)'),
      h('button', { type: 'button', class: 'secondary', onclick: () => db.supabase.auth.signOut() }, 'Sign out')));
}

async function exportCsv() {
  toast('Preparing download…');
  try {
    const rows = await db.exportRows();
    const cols = Object.keys(rows[0] ?? { date: '' });
    const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `workouts-${new Date().toLocaleDateString('en-CA')}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    toast(`Download failed: ${err.message}`, true);
  }
}

let signedIn = false;
async function route() {
  if (!signedIn) return renderSignedOut();
  const m = location.hash.match(/^#\/session\/(\d+)$/);
  try {
    if (m) await renderSession(root, Number(m[1]), { toast, go });
    else await renderHome();
  } catch (err) {
    root.replaceChildren(h('p', {}, `Something went wrong: ${err.message}`), h('a', { href: '#/' }, 'Back to workouts'));
  }
}

window.addEventListener('hashchange', route);
db.supabase.auth.onAuthStateChange((event, session) => {
  const now = !!session;
  if (now !== signedIn || event === 'INITIAL_SESSION') { signedIn = now; route(); }
});
