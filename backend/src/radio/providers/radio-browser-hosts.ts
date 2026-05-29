import { promises as dns } from 'dns';

const DEFAULT_RADIO_BROWSER_HOSTS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://fr1.api.radio-browser.info',
];

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function toBaseUrl(hostname: string): string {
  return `https://${hostname.replace(/\.$/, '')}`;
}

function shuffle<T>(items: T[]): T[] {
  const values = [...items];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

export async function resolveRadioBrowserBaseUrls(preferredBaseUrl?: string): Promise<string[]> {
  const hosts: string[] = [];

  try {
    const records = await dns.resolveSrv('_api._tcp.radio-browser.info');
    hosts.push(...records.map((record) => toBaseUrl(record.name)));
  } catch {
    hosts.push(...DEFAULT_RADIO_BROWSER_HOSTS);
  }

  if (preferredBaseUrl) {
    const normalizedPreferred = normalizeBaseUrl(preferredBaseUrl);
    if (!DEFAULT_RADIO_BROWSER_HOSTS.includes(normalizedPreferred)) {
      return [normalizedPreferred, ...Array.from(new Set(shuffle(hosts.filter((host) => host !== normalizedPreferred))))];
    }
  }

  return Array.from(new Set(shuffle(hosts)));
}
