const translations = {
  es: {
    'command.doctor.description': 'Abrir el diagnóstico de Babysitter',
    'command.doctor.aliasDescription': 'Alias de /doctor',
  },
  fr: {
    'command.doctor.description': 'Ouvrir le diagnostic Babysitter',
    'command.doctor.aliasDescription': 'Alias de /doctor',
  },
  'pt-BR': {
    'command.doctor.description': 'Abrir o diagnóstico do Babysitter',
    'command.doctor.aliasDescription': 'Alias para /doctor',
  },
};

let currentLocale = 'en';

export function initI18n(pi) {
  pi.events?.emit?.('pi-core/i18n/registerBundle', {
    namespace: 'babysitter-pi',
    defaultLocale: 'en',
    locales: translations,
  });
  pi.events?.emit?.('pi-core/i18n/requestApi', {
    onReady: (api) => {
      const locale = api.getLocale?.();
      if (isLocale(locale)) currentLocale = locale;
      api.onLocaleChange?.((next) => {
        if (isLocale(next)) currentLocale = next;
      });
    },
  });
}

export function t(key, fallback, params = {}) {
  const template = currentLocale === 'en' ? fallback : translations[currentLocale]?.[key] ?? fallback;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

function isLocale(locale) {
  return locale === 'en' || locale === 'es' || locale === 'fr' || locale === 'pt-BR';
}
