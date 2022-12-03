type ClientConfig = {
  baseUrl?: string;
  headers?: Record<string, string>;
};

const isURL = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

type RequestOptions = {
  params?: Record<string, string>;
  headers?: Record<string, string>;
};

const constructRequestInit =
  (configs: Omit<ClientConfig, 'baseUrl'>) => (options: RequestOptions) => {
    const { headers } = options;
    const reqInit: RequestInit = {
      headers: {
        ...configs.headers,
        ...headers,
      },
    };
    return reqInit;
  };
const constructURL =
  (baseUrl: string) => (path: string, options?: RequestOptions) => {
    const url = new URL(path, baseUrl);
    if (!options) return url.toString();
    const { params } = options;
    if (params) {
      const keys: Array<keyof typeof params> = Object.keys(params);
      for (const key of keys) {
        url.searchParams.append(key, params[key]);
      }
    }
    return url.toString();
  };

const createClient = (config: ClientConfig) => {
  if (config.baseUrl && !isURL(config.baseUrl)) {
    throw new Error('Invalid URL');
  }
  if (!config.baseUrl) {
    console.warn('No base URL provided, using current origin');
  }
  const baseUrl = config.baseUrl || window.location.origin;
  const defaultRequestInit = constructRequestInit(config);

  return {
    get: async (path: string, options: RequestOptions) => {
      const url = constructURL(baseUrl)(path, options);
      const reqInit = defaultRequestInit(options);
      const res = await fetch(url, reqInit);
      if (!res.ok) {
        throw res;
      }
      if (res.headers.get('Content-Type')?.includes('application/json')) {
        return res.json();
      }
      return res.text();
    },
    put: async (path: string, body: {}) => {},
    post: async <T extends Record<string, unknown> | FormData>(
      path: string,
      options?: RequestOptions & { body?: T }
    ) => {
      const { body, ...rest } = options || {};
      const url = constructURL(baseUrl)(path, rest);
      const reqInit = {
        ...defaultRequestInit(rest),
        method: 'POST',
        body: body instanceof FormData ? body : JSON.stringify(body),
      };
      const res = await fetch(url, reqInit);
      if (!res.ok) {
        throw res;
      }
      if (res.headers.get('Content-Type')?.includes('application/json')) {
        return res.json();
      }
      return res.text();
    },
    delete: async (path: string) => {},
  };
};

const http = createClient({
  baseUrl: import.meta.env.VITE_API_SERVER_URL,
});

export default http;
