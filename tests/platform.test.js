import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/index.js';
import { addUser, verifyPassword, hashPassword } from '../server/auth.js';
import { Store } from '../server/framework.js';
import { domains, validateBusiness, canDelete } from '../server/domains.js';
import { seed } from '../server/seed.js';

async function setup(t, mode = 'demo') {
  const dir = mkdtempSync(join(tmpdir(), 'sigeia-test-'));
  const app = await createApp({ dataDir: dir, mode, frontend: false });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { await new Promise(r => app.server.close(r)); rmSync(dir, { recursive: true, force: true }); });
  let cookie = '', csrf = mode === 'demo' ? 'demo' : '';
  const request = async (path, method = 'GET', body, overrides = {}) => {
    const res = await fetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf, ...overrides }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie') };
  };
  return { ...app, dir, request, setSession(result) { cookie = result.cookie.split(';')[0]; csrf = result.body.csrf; } };
}

test('generic framework operates with an unrelated domain definition', () => {
  const dir=mkdtempSync(join(tmpdir(),'sigeia-generic-'));
  try {
    const store=new Store({file:join(dir,'store.json'),definitions:{books:{fields:[{key:'title',label:'Título',type:'text',required:true}]}},seed:{books:[]}});
    const book=store.save('books',{title:'Framework independiente'});
    assert.equal(store.list('books')[0].title,book.title);
    assert.throws(()=>store.save('unknown',{}),/Dominio desconocido/);
    store.remove('books',book.id);assert.equal(store.list('books').length,0);
    assert.ok(JSON.parse(readFileSync(join(dir,'store.json'))).books[0].deletedAt);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('demo API enforces references, hierarchy, polygons, uniqueness and soft deletion', async t => {
  const app = await setup(t);
  assert.equal((await app.request('/data')).body.citizens.length,8);
  const badRef=await app.request('/entities/territories','POST',{name:'Prueba',code:'X',regionId:'missing'});
  assert.equal(badRef.status,400);
  const badPoly=await app.request('/entities/territories/t1','PUT',{...seed.territories[0],polygon:[[200,0],[0,0],[1,1]]});
  assert.equal(badPoly.status,400);
  assert.equal((await app.request('/entities/regions','POST',{name:'Duplicado',code:'rc-01'})).status,400);
  assert.equal((await app.request('/entities/assignments','POST',{operatorId:'o2',level:'Región',targetId:'t1'})).status,400);
  assert.equal((await app.request('/entities/assignments','POST',{operatorId:'o2',level:'Territorio',targetId:'t1'})).status,400);
  assert.equal((await app.request('/entities/regions/r1','DELETE',{})).status,400);
  const region=await app.request('/entities/regions','POST',{name:'Nueva región',code:'RC-02'});
  assert.equal(region.status,201);
  assert.equal((await app.request('/entities/regions/'+region.body.id,'DELETE',{})).status,200);
  assert.ok(JSON.parse(readFileSync(join(app.dir,'records.json'))).regions.find(x=>x.id===region.body.id).deletedAt);
  assert.ok(!((await app.request('/entities/regions')).body.some(x=>x.id===region.body.id)));
  assert.equal((await app.request('/entities/__proto__','POST',{})).status,404);
  assert.equal((await app.request('/entities/houses','POST',{...seed.houses[0],lat:91})).status,400);
  assert.equal((await app.request('/entities/houses','POST',{...seed.houses[0],lat:true})).status,400);
});

test('pilot starts empty, requires authentication, rejects CSRF and enforces profiles', async t => {
  const app=await setup(t,'pilot');
  assert.equal((await app.request('/data')).status,401);
  const password='Synthetic-test-password-!42';
  addUser(join(app.dir,'users.json'),'reader',password,'consulta');
  addUser(join(app.dir,'users.json'),'admin',password,'admin');
  addUser(join(app.dir,'users.json'),'capture',password,'capturista');
  assert.equal((await app.request('/auth/login','POST',{username:'admin',password:'wrong'})).status,401);
  const login=await app.request('/auth/login','POST',{username:'reader',password});
  assert.equal(login.status,200);assert.match(login.cookie,/HttpOnly/);assert.match(login.cookie,/SameSite=Strict/);
  app.setSession(login);
  const all=await app.request('/data');assert.ok(Object.values(all.body).every(x=>x.length===0));
  assert.equal((await app.request('/entities/regions','POST',{name:'Norte',code:'N1'})).status,403);
  const admin=await app.request('/auth/login','POST',{username:'admin',password});app.setSession(admin);
  assert.equal((await app.request('/entities/regions','POST',{name:'Norte',code:'N1'},{'x-csrf-token':'wrong'})).status,403);
  assert.equal((await app.request('/entities/regions','POST',{name:'Norte',code:'N1'},{origin:'https://malicious.example'})).status,403);
  const region=await app.request('/entities/regions','POST',{name:'Norte',code:'N1'});assert.equal(region.status,201);
  const capture=await app.request('/auth/login','POST',{username:'capture',password});app.setSession(capture);
  assert.equal((await app.request('/entities/regions','POST',{name:'Sur',code:'S1'})).status,403);
  // Capturista reaches domain validation rather than permission denial for allowed collections.
  assert.equal((await app.request('/entities/citizens','POST',{})).status,400);
  assert.equal((await app.request('/auth/logout','POST',{})).status,200);
  assert.equal((await app.request('/data')).status,401);
  const reloaded=new Store({definitions:domains,file:join(app.dir,'records.json'),seed,validate:validateBusiness,beforeDelete:canDelete});
  assert.equal(reloaded.list('regions')[0].id,region.body.id);
  assert.match(readFileSync(join(app.dir,'audit.jsonl'),'utf8'),/"actor":"admin"/);
});

test('login rate limiting and salted password hashes',async t=>{
  const password='Another-test-password!123';
  const hash=hashPassword(password);
  assert.ok(verifyPassword(password,hash));assert.ok(!verifyPassword('wrong',hash));assert.notEqual(hash,hashPassword(password));
  const app=await setup(t,'pilot');
  for(let i=0;i<10;i++)assert.equal((await app.request('/auth/login','POST',{username:'unknown',password:'invalid'})).status,401);
  assert.equal((await app.request('/auth/login','POST',{username:'unknown',password:'invalid'})).status,429);
});
