import { createPasskey, explain } from './passkey';
import { themeToggle } from './theme-toggle';

themeToggle(new AbortController().signal);

const withToken = document.querySelector<HTMLElement>('[data-with-token]');
const withoutToken = document.querySelector<HTMLElement>('[data-without-token]');
const form = document.querySelector<HTMLFormElement>('[data-setup]');
const alert = document.querySelector<HTMLElement>('[data-alert]');

let token: string | null = null;

// The token travels in the URL fragment, which browsers never send to a server. It's removed from
// the address bar and history straight away, and only ever kept in this variable.
function takeTokenFromAddressBar() {
  const found = new URLSearchParams(location.hash.slice(1)).get('token');
  if (location.hash) history.replaceState(null, '', location.pathname);
  if (!found) return;
  token = found;
  if (withToken) withToken.hidden = false;
  if (withoutToken) withoutToken.hidden = true;
}

takeTokenFromAddressBar();
// Pasting the link into a tab already on this page only changes the fragment, with no reload.
addEventListener('hashchange', takeTokenFromAddressBar);

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!alert || !token) return;
  const submit = form.querySelector('button');
  alert.hidden = true;
  if (submit) submit.disabled = true;
  try {
    await createPasskey(String(new FormData(form).get('label') ?? ''), token);
    location.assign('/dashboard');
  } catch (error) {
    alert.textContent = explain(error);
    alert.hidden = false;
    if (submit) submit.disabled = false;
  }
});
