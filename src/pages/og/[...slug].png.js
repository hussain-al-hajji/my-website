import { allOgPages } from '../../lib/pages.js';
import { renderOg, renderHomeOg } from '../../lib/og.js';

export function getStaticPaths() {
  return allOgPages().map((p) => ({ params: { slug: p.slug }, props: p }));
}

export function GET({ props }) {
  const png = props.slug === 'index' ? renderHomeOg() : renderOg({ title: props.title, kicker: props.kicker });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
}
