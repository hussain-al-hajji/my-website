import faq from '../data/faq.json';
import { site, records, getKits } from './site.js';

/** يستبدل الرموز {programs} ونحوها بأرقام تُحسب من بيانات الموقع. */
export function faqItems() {
  const n = (v) => Number(v).toLocaleString('en-US');
  const tokens = {
    since: site.stats.since,
    programs: n(site.stats.programs),
    partners: n(site.stats.partners),
    beneficiaries: n(site.stats.beneficiaries),
    kits: n(getKits().length),
    inperson: n(records.filter((r) => /حضوري/.test(r.kind)).length),
    virtual: n(records.filter((r) => /افتراض/.test(r.kind)).length),
  };
  return faq.map((x) => ({ ...x, a: x.a.replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? tokens[k] : m)) }));
}
