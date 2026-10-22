import { allOgPages } from '../../lib/pages.js';
import { renderOg } from '../../lib/og.js';

export function getStaticPaths() {
  return allOgPages().map((p) => ({ params: { slug: p.slug }, props: p }));
}

export function GET({ props }) {
  return new Response(renderOg({ title: props.title, kicker: props.kicker }), { headers: { 'Content-Type': 'image/png' } });
}
