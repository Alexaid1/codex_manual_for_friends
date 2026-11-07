import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve('dist');
async function walk(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await walk(p));else result.push(p);}return result;}
const files=await walk(root),htmlFiles=files.filter(p=>p.endsWith('.html')),pages=new Map();
for(const p of htmlFiles){const text=await readFile(p,'utf8');pages.set(p,text);assert(!text.includes('\uFFFD'),`Invalid UTF-8: ${p}`);assert(!/C:[\\/]|D:[\\/]|Alexi|\.credentials\.json/.test(text),`Private local data: ${p}`);assert.equal((text.match(/<h1\b/g)||[]).length,1,`Expected one h1: ${p}`);assert(text.includes('lang="ru"'),`Missing language: ${p}`);const ids=[...text.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size,`Duplicate IDs: ${p}`);}
let links=0;
for(const [p,text] of pages){for(const match of text.matchAll(/(?:href|src)="([^"]+)"/g)){const href=match[1].replaceAll('&amp;','&');if(/^(https?:|mailto:|data:)/.test(href))continue;assert(!href.startsWith('/'),`Root path breaks project hosting: ${p} -> ${href}`);const url=new URL(href,'https://local.test/'+path.relative(root,p).split(path.sep).join('/'));let target=path.resolve(root,'.'+decodeURIComponent(url.pathname));assert(target.startsWith(root+path.sep),`Escaping public root: ${href}`);assert((await stat(target)).isFile(),`Missing link: ${p} -> ${href}`);if(url.hash&&pages.has(target)){const id=decodeURIComponent(url.hash.slice(1));assert(pages.get(target).includes(`id="${id}"`),`Missing anchor: ${p} -> ${href}`);}links++;}}
for(const file of ['src/app.js','scripts/build.mjs','scripts/serve.mjs','content/lessons.mjs'])execFileSync(process.execPath,['--check',file]);
const tools=JSON.parse(await readFile('data/tools.json','utf8'));assert.equal(new Set(tools.map(t=>t.id)).size,tools.length);for(const t of tools){for(const field of ['name','description','repo','docs','license','requirements','command','remove','status','priceDetail'])assert(t[field],`${t.id}: missing ${field}`);if(t.score){assert.equal(t.score.length,5);assert(t.score.every(n=>n>=0&&n<=2));}}
const start=pages.get(path.join(root,'lessons/start.html'));assert(start.includes('data-os="windows"')&&start.includes('data-os="macos"'),'Both OS routes must exist in static HTML');assert(!/<div class="os-content"[^>]*hidden/.test(start),'No-JS OS routes should be visible');
function lum(hex){const values=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;}
for(const [fg,bg] of [['202923','F7F8F5'],['58645D','F7F8F5'],['FFFFFF','23614C'],['23614C','FFFFFF']]){const a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert(ratio>=4.5,`Contrast ${fg}/${bg}: ${ratio}`);}
console.log(`PASS: ${htmlFiles.length} pages, ${links} local links/anchors, JS syntax, tool records, static OS routes, key contrast pairs.`);
