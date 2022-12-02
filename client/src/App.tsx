import { Component, createSignal, onCleanup } from 'solid-js';
import HCaptcha from 'solid-hcaptcha';

const App: Component = () => {
  const [token, setToken] = createSignal<string | null>(null);

  const handleVerify = (tkn: string) => {
    setToken(tkn);
  };

  const handleSubmit = () => {
    console.log(token());
    fetch('http://localhost:3000/captcha', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: token() }),
    })
      .then((res) => {
        if (res.headers.get('Content-Type')?.includes('application/json')) {
          return res.json();
        } else {
          return res.text();
        }
      })
      .then((data) => {
        console.log(data);
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
