import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const signedOut = document.getElementById('signed-out');
const signedIn = document.getElementById('signed-in');
const who = document.getElementById('who');
const workoutList = document.getElementById('workouts');
const status = document.getElementById('status');

document.getElementById('sign-in').addEventListener('click', async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) status.textContent = `Sign-in failed: ${error.message}`;
});

document.getElementById('sign-out').addEventListener('click', () => supabase.auth.signOut());

async function render(session) {
  status.textContent = '';
  signedOut.hidden = !!session;
  signedIn.hidden = !session;
  if (!session) return;

  const user = session.user;
  who.textContent = user.user_metadata?.user_name || user.email;

  const { data, error } = await supabase.from('workout').select('name').order('name');
  if (error) {
    workoutList.innerHTML = '';
    status.textContent = `Couldn't load workouts: ${error.message}`;
    return;
  }
  workoutList.replaceChildren(...data.map((w) => Object.assign(document.createElement('li'), { textContent: w.name })));
  if (!data.length) {
    workoutList.innerHTML = '<li class="muted">No workouts yet. Your history will appear here after the import.</li>';
  }
}

supabase.auth.onAuthStateChange((_event, session) => render(session));
