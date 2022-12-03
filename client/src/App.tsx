import { Component, createSignal, JSX, onCleanup, Show } from 'solid-js';
import HCaptcha from 'solid-hcaptcha';
import http from './configurations/http';
import { saveAs } from 'file-saver';

const App: Component = () => {
  const [files, setFiles] = createSignal<FileList | null>(null);
  const [token, setToken] = createSignal<string | null>(null);
  const [orientation, setOrientation] = createSignal<'portrait' | 'landscape'>(
    'portrait'
  );
  const [loading, setLoading] = createSignal(false);

  const valid = () => {
    const f = files();
    const t = token();
    return (
      f &&
      f.length > 0 &&
      Array.from(f).every((file) => file.type.startsWith('image/')) &&
      t
    );
  };

  const handleVerify = (tkn: string) => {
    setToken(tkn);
  };

  const handleSubmit: JSX.EventHandlerUnion<
    HTMLFormElement,
    Event & {
      submitter: HTMLElement;
    }
  > = (event) => {
    setLoading(false);
    event.preventDefault();
    const f = files();
    if (!f) {
      return console.error('No files selected');
    }
    const fileTypes = Array.from(f).map((file) => file.type);
    if (!fileTypes.every((type) => type.startsWith('image/'))) {
      return console.error('Only image files are allowed');
    }
    const tk = token();
    if (!tk) {
      return console.error('No token');
    }
    const formData = new FormData();
    Array.from(f).forEach((file) => formData.append('files', file));
    formData.append('layout', orientation());
    setLoading(true);
    http
      .post('/generate', {
        headers: {
          Authorization: tk,
        },
        body: formData,
      })
      .then((data) => {
        saveAs(data, 'generated.pdf');
      })
      .finally(() => {
        setLoading(false);
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
    <div class={'mx-auto max-w-2xl p-4 prose'}>
      <h2 class="mb-4">PDF Converter</h2>
      <form onSubmit={handleSubmit}>
        <label class="label" for="images">
          <span class="label-text">
            Pick an image or multiple images to convert to PDF.
          </span>
        </label>
        <input
          name="images"
          type="file"
          class="file-input file-input-bordered w-full"
          multiple={true}
          accept="image/*"
          onChange={(event) => {
            setFiles(event.currentTarget.files);
          }}
        />
        <div class="form-control my-2">
          <label class="label cursor-pointer">
            <span class="label-text">Portrait</span>
            <input
              type="checkbox"
              class="toggle"
              checked={orientation() === 'portrait'}
              onChange={(event) => {
                setOrientation(
                  event.currentTarget.checked ? 'portrait' : 'landscape'
                );
              }}
            />
          </label>
        </div>
        <div class="my-2">
          <HCaptcha
            sitekey={siteKey}
            onVerify={handleVerify}
            onError={(err) => console.error(err)}
            onExpire={() => setToken(null)}
          />
        </div>
        <button
          type="submit"
          class={'btn btn-wide btn-primary'}
          disabled={loading() || !valid()}
        >
          <Show when={!loading()} fallback={'Generating...'}>
            Generate PDF
          </Show>
        </button>
      </form>
    </div>
  );
};

export default App;
