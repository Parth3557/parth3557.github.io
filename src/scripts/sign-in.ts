import { explain, signIn } from './passkey';
import { themeToggle } from './theme-toggle';

themeToggle(new AbortController().signal);

const button = document.querySelector<HTMLButtonElement>('[data-sign-in]');
const alert = document.querySelector<HTMLElement>('[data-alert]');

button?.addEventListener('click', async () => {
  if (!alert) return;
  alert.hidden = true;
  button.disabled = true;
  try {
    await signIn();
    location.assign('/dashboard');
  } catch (error) {
    alert.textContent = explain(error);
    alert.hidden = false;
    button.disabled = false;
  }
});
