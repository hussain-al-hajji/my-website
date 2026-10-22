import { defineConfig } from 'astro/config';

// الدومين النهائي. عند تجربة الموقع على github.io يُضبط SITE_URL وSITE_BASE من إعدادات المستودع.
export default defineConfig({
  site: process.env.SITE_URL || 'https://hussain-al-hajji.com',
  base: process.env.SITE_BASE || '/',
  trailingSlash: 'never',
  build: { format: 'file' },
  compressHTML: true,
  devToolbar: { enabled: false },
});
