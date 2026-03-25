const normalizeBasePath = (value: string) => {
  if (!value || value === '/') {
    return '';
  }

  return `/${value.replace(/^\/+|\/+$/g, '')}`;
};

const normalizeRoutePath = (value: string) => {
  if (!value || value === '/') {
    return '';
  }

  return `/${value.replace(/^\/+|\/+$/g, '')}`;
};

export const getAppBasePath = () => normalizeBasePath(import.meta.env.BASE_URL || '/');

export const getAppPath = (path = '/') => {
  const fullPath = `${getAppBasePath()}${normalizeRoutePath(path)}`;
  return fullPath || '/';
};

export const buildAppUrl = (path = '/') => {
  if (typeof window === 'undefined') {
    return getAppPath(path);
  }

  return `${window.location.origin}${getAppPath(path)}`;
};

export const isCurrentAppRoute = (path: string) => {
  if (typeof window === 'undefined') {
    return false;
  }

  const normalizeForCompare = (value: string) => {
    if (!value || value === '/') {
      return '/';
    }

    return value.replace(/\/+$/g, '') || '/';
  };

  return normalizeForCompare(window.location.pathname) === normalizeForCompare(getAppPath(path));
};
