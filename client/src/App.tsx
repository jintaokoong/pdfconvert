import { Component, createSignal, onCleanup } from 'solid-js';
import HCaptcha from 'solid-hcaptcha';
import http from './configurations/http';

const App: Component = () => {
  const [token, setToken] = createSignal<string | null>(null);

  const handleVerify = (tkn: string) => {
    setToken(tkn);
  };

  const handleSubmit = () => {
    console.log(token());
    http
      .post('/captcha', {
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          token: token(),
        },
      })
      .then((res) => {
        console.log(res);
      });
  };

  onCleanup(() => {
    setToken(null);
  });

  const siteKey = import.meta.env.VITE_SITE_KEY;
  if (!siteKey) {
    throw new Error('VITE_SITE_KEY is not defined');
  }
  return (
    <div>
      <h3>Hello, Solid!</h3>
      <p>Here, solve a captcha:</p>
      <HCaptcha sitekey={siteKey} onVerify={handleVerify} />
      <button disabled={token() === null} onClick={handleSubmit}>
        Submit
      </button>
    </div>
  );
};

export default App;
