type ErrorPayload = {
  message?: string;
};

async function parseJson<T extends object>(response: Response) {
  return (await response.json()) as T | ErrorPayload;
}

async function refreshSession() {
  const response = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
  });

  return response.ok;
}

export async function apiFetch<T extends object>(url: string, init?: RequestInit) {
  const requestInit: RequestInit = {
    ...init,
    credentials: 'include',
  };

  let response = await fetch(url, requestInit);

  if (response.status === 401 && (await refreshSession())) {
    response = await fetch(url, requestInit);
  }

  const payload = await parseJson<T>(response);

  if (!response.ok) {
    const message = 'message' in payload && payload.message ? payload.message : '요청 처리에 실패했습니다.';

    throw new Error(message);
  }

  return payload as T;
}
