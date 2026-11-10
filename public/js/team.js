// Équipe du projet : la production et les chefs de poste, avec leur fonction.
// Les noms cochés « En-tête » apparaissent en haut de chaque page des PDF exportés.
// Données : project.credits = [{ id, role, name, phone, email, head }] ; la société de production et la réalisation
// restent synchronisées avec project.settings.prod / .real (utilisés ailleurs dans l'app).
import { esc } from './parser.js';
import { tr } from './i18n.js';

export const CREDIT_ROLES = [
  ['prod', 'Société de production', true], ['producer', 'Producteur·rice', true], ['exec', 'Producteur·rice exécutif·ve', true],
  ['real', 'Réalisateur·rice', true], ['ad1', '1er·e assistant·e réalisateur·rice', true], ['dirprod', 'Directeur·rice de production', false],
  ['regie', 'Régisseur·se général·e', false], ['dop', 'Directeur·rice de la photographie', false], ['script', 'Scripte', false],
  ['deco', 'Chef·fe décorateur·rice', false], ['cost', 'Chef·fe costumier·e', false], ['hmc', 'Chef·fe maquilleur·se', false],
  ['son', 'Ingénieur·e du son', false], ['montage', 'Chef·fe monteur·se', false], ['casting', 'Directeur·rice de casting', false]
];
const SUGGEST = ['2e assistant·e réalisateur·rice', 'Coproducteur·rice', 'Producteur·rice associé·e', 'Chargé·e de production', 'Cadreur·se', 'Chef·fe électricien·ne', 'Chef·fe machiniste', 'Ensemblier·e', 'Accessoiriste', 'Coiffeur·se', 'Perchman', 'Photographe de plateau', 'Superviseur·se VFX', 'Étalonneur·se', 'Compositeur·rice', 'Attaché·e de presse', 'Client', 'Agence'];
const nid = () => Math.random().toString(36).slice(2, 8);

export function creditsOf(project) {
  let c = project.credits;
  if (!Array.isArray(c)) {
    c = CREDIT_ROLES.map(([k, l, h]) => ({ id: k, key: k, role: l, name: '', phone: '', email: '', head: h }));
    project.credits = c;
  }
  const s = project.settings || {};
  const pr = c.find(x => x.key === 'prod'), re = c.find(x => x.key === 'real');
  // la société de production et la réalisation suivent les réglages du projet (Bible › Le film)
  if (pr && s.prod != null) pr.name = s.prod;
  if (re && s.real != null) re.name = s.real;
  return c;
}

// Ligne d'en-tête des PDF : « Production : Atlas Films · Réalisation : … »
const SHORT = { prod: 'Production', producer: 'Producteur·rice', exec: 'Prod. exécutif·ve', real: 'Réalisation', ad1: '1er·e assistant·e', dirprod: 'Dir. de production', dop: 'Image' };
export function headerCredits(project, lang) {
  const t = v => tr(v, lang);
  return creditsOf(project).filter(x => x.head && (x.name || '').trim()).map(x => [t(SHORT[x.key] || x.role), x.name.trim()]);
}

export function renderTeam(project) {
  const c = creditsOf(project), filled = c.filter(x => (x.name || '').trim()).length;
  return `<div class="team">
    <div class="tm-top"><div><h2>${tr('Équipe et générique')}</h2><p class="note">${tr('Les fonctions cochées « En-tête » sont imprimées en haut de chaque page des PDF (présentation, plan de travail, feuilles de service, budget…).')}</p></div>
      <span class="tm-k"><b>${filled}</b>${tr('noms renseignés')}</span></div>
    <div class="tm-head">${headerCredits(project).length ? headerCredits(project).map(([r, n]) => `<span><small>${esc(r)}</small>${esc(n)}</span>`).join('') : `<em>${tr('Aperçu de l’en-tête : renseignez au moins un nom coché « En-tête ».')}</em>`}</div>
    <div class="tscroll"><table class="tbl tm-tab"><thead><tr><th>${tr('Fonction')}</th><th>${tr('Nom')}</th><th>${tr('Téléphone')}</th><th>E-mail</th><th class="c">${tr('En-tête')}</th><th></th></tr></thead><tbody>
      ${c.map((x, i) => `<tr data-cid="${x.id}"><td>${x.key ? `<b>${tr(x.role)}</b>` : `<input class="tm-role" data-cr="${x.id}|role" value="${esc(x.role)}" list="tmroles" placeholder="${tr('Fonction')}">`}</td>
        <td><input data-cr="${x.id}|name" value="${esc(x.name || '')}" placeholder="${tr('Nom et prénom')}${x.key === 'prod' ? ' / ' + tr('société') : ''}"></td>
        <td><input data-cr="${x.id}|phone" value="${esc(x.phone || '')}" inputmode="tel"></td><td><input data-cr="${x.id}|email" value="${esc(x.email || '')}" inputmode="email"></td>
        <td class="c"><input type="checkbox" data-cr="${x.id}|head" ${x.head ? 'checked' : ''} aria-label="${tr('En-tête')}"></td>
        <td class="nw">${i ? `<button class="bx" data-cmv="${x.id}|-1" title="${tr('Monter')}">↑</button>` : ''}${x.key ? '' : `<button class="bx" data-cdel="${x.id}" title="${tr('Supprimer')}">✕</button>`}</td></tr>`).join('')}
    </tbody></table></div>
    <datalist id="tmroles">${SUGGEST.map(s => `<option value="${esc(tr(s))}">`).join('')}</datalist>
    <button class="btn sm ghost" data-cadd>+ ${tr('Ajouter une fonction')}</button>
  </div>`;
}

// o : { project, save(), refresh() }
export function bindTeam(root, o) {
  const c = () => creditsOf(o.project);
  const sync = x => { o.project.settings ||= {}; if (x.key === 'prod') o.project.settings.prod = x.name; if (x.key === 'real') o.project.settings.real = x.name; };
  root.addEventListener('input', e => {
    if (!root.querySelector('.team')) return;
    const d = e.target.dataset.cr; if (!d || e.target.type === 'checkbox') return;
    const [id, f] = d.split('|'), x = c().find(y => y.id === id); if (!x) return;
    x[f] = e.target.value; sync(x); o.save();
  });
  root.addEventListener('change', e => {
    if (!root.querySelector('.team')) return;
    const d = e.target.dataset.cr; if (!d) return;
    const [id, f] = d.split('|'), x = c().find(y => y.id === id); if (!x) return;
    if (e.target.type === 'checkbox') { x.head = e.target.checked; o.save(); }
    o.refresh();
  });
  root.addEventListener('click', e => {
    if (!root.querySelector('.team')) return;
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-cadd')) { c().push({ id: nid(), role: '', name: '', phone: '', email: '', head: false }); o.save(); o.refresh(); setTimeout(() => [...root.querySelectorAll('.tm-role')].pop()?.focus(), 30); return; }
    if (b.dataset.cdel) { o.project.credits = c().filter(y => y.id !== b.dataset.cdel); o.save(); return o.refresh(); }
    if (b.dataset.cmv) { const [id] = b.dataset.cmv.split('|'), a = c(), i = a.findIndex(y => y.id === id); if (i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]]; o.save(); return o.refresh(); }
  });
}
