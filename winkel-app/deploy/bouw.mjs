// Bouwt de online versie op Vercel rechtstreeks uit deze GitHub-repo (Build Output API v3).
// Gebruik (als buildcommando op Vercel): node bouw.mjs <commit>
// Zo moet er bij een update enkel deze map (package.json + bouw.mjs) opnieuw geüpload worden,
// met de nieuwe commit in package.json.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, cpSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const commit = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(commit || '')) throw new Error('Geef een volledige commit-hash mee');

const bron = 'bron';
const uit = '.vercel/output';
rmSync(bron, { recursive: true, force: true });
rmSync(uit, { recursive: true, force: true });
mkdirSync(bron, { recursive: true });

// 1. De code: staat de repo al naast deze map (Vercel bouwt uit GitHub), dan die bestanden gebruiken.
if (existsSync('../public') && existsSync('../api') && existsSync('../lib')) {
  for (const m of ['public', 'api', 'lib']) cpSync(join('..', m), join(bron, m), { recursive: true });
  console.log('Code genomen uit de meegeleverde repo');
} else {
  // 1. De code ophalen op die commit (enkel winkel-app/public, api en lib).
  const tar = join(bron, 'repo.tar.gz');
  // Is de repo privé, dan met de sleutel GITHUB_LEZEN (Vercel-instelling, enkel lezen).
  const sleutel = process.env.GITHUB_LEZEN;
  let res = sleutel ? await fetch(`https://api.github.com/repos/Bogdan-mg/crystal-services/tarball/${commit}`,
    { headers: { Authorization: `Bearer ${sleutel}`, 'User-Agent': 'crystal-winkel-bouw' } }) : null;
  if (res && !res.ok) console.log(`Sleutel GITHUB_LEZEN werkt niet (${res.status}): probeer zonder sleutel`);
  if (!res || !res.ok) res = await fetch(`https://codeload.github.com/Bogdan-mg/crystal-services/tar.gz/${commit}`);
  if (!res.ok) throw new Error(`Kon de code niet ophalen (${res.status}): is de repo privé en de sleutel GITHUB_LEZEN verlopen?`);
  writeFileSync(tar, Buffer.from(await res.arrayBuffer()));
  execFileSync('tar', ['-xzf', tar, '-C', bron, '--strip-components=2', '--wildcards', '*/winkel-app/public/*', '*/winkel-app/api/*', '*/winkel-app/lib/*']);

}

// 2. De website zelf (statische bestanden).
mkdirSync(join(uit, 'static'), { recursive: true });
cpSync(join(bron, 'public'), join(uit, 'static'), { recursive: true });

// 2b. Afgesproken klantprijzen (Sportclubs, Vaste klanten) horen enkel op de winkel-pc: niet in de openbare website.
// Faalt dit, dan stopt de bouw liever dan dat ze online komen te staan.
const prijzenPad = join(uit, 'static', 'prijzen.js');
let prijzenJs = readFileSync(prijzenPad, 'utf8')
  .split('\n').filter((l) => !/^\/\/ (Sportclubs|Atelier|TOR )/.test(l)).join('\n');
prijzenJs = prijzenJs.replace(/^window\.PRIJSLIJST = (\[.*\]);$/m, (_, json) =>
  'window.PRIJSLIJST = ' + JSON.stringify(JSON.parse(json).filter((g) => !['Sportclubs', 'Vaste klanten'].includes(g.titel))) + ';');
if (/rebul|pirates|deurne ob|sportclub|vaste klanten/i.test(prijzenJs)) throw new Error('Afgesproken klantprijzen staan nog in prijzen.js: bouw gestopt');
writeFileSync(prijzenPad, prijzenJs);

// 3. Elke server-functie (api/*.js) met de regels (lib/) en @vercel/blob.
for (const bestand of readdirSync(join(bron, 'api')).filter((f) => f.endsWith('.js'))) {
  const naam = bestand.replace(/\.js$/, '');
  const map = join(uit, 'functions', 'api', naam + '.func');
  mkdirSync(join(map, 'api'), { recursive: true });
  cpSync(join(bron, 'api', bestand), join(map, 'api', bestand));
  cpSync(join(bron, 'lib'), join(map, 'lib'), { recursive: true });
  if (existsSync('node_modules')) cpSync('node_modules', join(map, 'node_modules'), { recursive: true, dereference: true });
  writeFileSync(join(map, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(join(map, '.vc-config.json'), JSON.stringify({
    runtime: 'nodejs22.x', handler: `api/${bestand}`, launcherType: 'Nodejs', shouldAddHelpers: true, regions: ['fra1'],
  }));
}

writeFileSync(join(uit, 'config.json'), JSON.stringify({ version: 3, routes: [{ handle: 'filesystem' }] }));
console.log('Klaar: online versie gebouwd op commit', commit);
