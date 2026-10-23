import { chromium, expect } from '@playwright/test';
import { existsSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const apache=process.env.APACHE_BIN;
const modules=process.env.APACHE_MODULE_DIR;
const phpModule=process.env.PHP_APACHE_MODULE;
const php=process.env.PHP_BIN||'php';
if(!apache||!modules||!phpModule)throw new Error('Define APACHE_BIN, APACHE_MODULE_DIR y PHP_APACHE_MODULE para probar Apache/PHP real. Ejecuta antes npm run build:xampp.');
const temp=mkdtempSync(join(tmpdir(),'sigeia-xampp-test-'));
const htdocs=join(temp,'htdocs');mkdirSync(htdocs);
cpSync(resolve('build-xampp/sigeia'),join(htdocs,'sigeia'),{recursive:true});
mkdirSync(join(htdocs,'anidado'));cpSync(resolve('build-xampp/sigeia'),join(htdocs,'anidado','otra-instalacion'),{recursive:true});
mkdirSync(join(temp,'run'));
writeFileSync(join(temp,'mime.types'),'text/html html\ntext/css css\ntext/javascript js\nimage/png png\n');
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
const conf=join(temp,'httpd.conf');
writeFileSync(conf,`ServerRoot "${temp}"
DefaultRuntimeDir "${temp}/run"
PidFile "${temp}/run/httpd.pid"
Listen 127.0.0.1:${port}
ServerName localhost
LoadModule mpm_prefork_module "${modules}/mod_mpm_prefork.so"
LoadModule authz_core_module "${modules}/mod_authz_core.so"
LoadModule authz_host_module "${modules}/mod_authz_host.so"
LoadModule dir_module "${modules}/mod_dir.so"
LoadModule mime_module "${modules}/mod_mime.so"
LoadModule php_module "${phpModule}"
User ${process.env.USER||'agent'}
Group ${process.env.USER||'agent'}
ErrorLog "${temp}/error.log"
LogLevel warn
DocumentRoot "${htdocs}"
TypesConfig "${temp}/mime.types"
DirectoryIndex index.php
<FilesMatch "\\.php$">
  SetHandler application/x-httpd-php
</FilesMatch>
<Directory />
  Require all denied
</Directory>
<Directory "${htdocs}">
  AllowOverride All
  Require all granted
  Options -Indexes +FollowSymLinks
</Directory>
php_admin_flag display_errors Off
php_admin_flag log_errors On
`);
let child,browser,logs='';
const errors=[];
try{
  execFileSync(apache,['-t','-f',conf]);
  child=spawn(apache,['-f',conf,'-DFOREGROUND'],{detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
  child.stderr.on('data',x=>logs+=x);child.stdout.on('data',x=>logs+=x);
  const base=`http://127.0.0.1:${port}/sigeia/`;
  let ready=false;
  for(let i=0;i<100;i++){
    if(child.exitCode!==null||child.signalCode!==null)throw new Error('Apache no inició: '+logs);
    try{const res=await fetch(base+'api.php?route=%2Fhealth');if(res.ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,50));
  }
  if(!ready)throw new Error('Apache no listo: '+logs+' '+(existsSync(join(temp,'error.log'))?readFileSync(join(temp,'error.log'),'utf8'):''));
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
  await page.goto(base);
  await page.getByRole('heading',{name:'Tu territorio, en perspectiva.'}).waitFor();
  await expect(page.locator('.metric-value').first()).toHaveText('3');
  assert.ok(await page.locator('.leaflet-overlay-pane path').count()>=15);
  await page.screenshot({path:'/tmp/sigeia-xampp-dashboard.png',fullPage:true});
  async function request(route,method='GET',body,extra={},mode='demo'){
    const res=await fetch(base+`api.php?mode=${mode}&route=`+encodeURIComponent(route),{method,headers:{'content-type':'application/json','x-csrf-token':'demo',...extra},body:body===undefined?undefined:JSON.stringify(body)});
    return{status:res.status,body:await res.json()};
  }
  const initial=await request('/data');assert.equal(initial.body.citizens.length,8);
  const invalid=await request('/entities/territories','POST',{name:'Inválido',code:'XX',regionId:'no'});assert.equal(invalid.status,400);
  assert.equal((await request('/entities/regions/r1','DELETE',{})).status,400);
  assert.equal((await request('/entities/regions','POST',{name:'Duplicado',code:'rc-01'})).status,400);
  assert.equal((await request('/entities/houses','POST',{...initial.body.houses[0],lat:91})).status,400);
  assert.equal((await request('/entities/assignments','POST',{operatorId:'o2',level:'Región',targetId:'t1'})).status,400);
  const created=await request('/entities/regions','POST',{name:'Región de prueba',code:'PHP-01'});assert.equal(created.status,201);
  assert.equal((await request('/entities/regions/'+created.body.id,'DELETE',{})).status,200);
  const concurrent=await Promise.all(Array.from({length:8},(_,i)=>request('/entities/regions','POST',{name:'Región concurrente '+i,code:'CP-'+i})));
  assert.ok(concurrent.every(x=>x.status===201));assert.equal((await request('/data')).body.regions.length,9);
  assert.equal((await request('/entities/regions','POST',{name:'CSRF',code:'CSRF'},{'x-csrf-token':'invalid'})).status,403);
  assert.equal((await request('/entities/regions','POST',{name:'Origin',code:'ORIGIN'},{Origin:'https://other.example'})).status,403);
  await page.getByRole('button',{name:'Nuevo territorio'}).click();
  await page.locator('[name="name"]').fill('Territorio PHP');await page.locator('[name="code"]').fill('PHP-T1');await page.locator('[name="regionId"]').selectOption('r1');
  await page.getByRole('button',{name:'Guardar registro'}).click();await page.getByRole('dialog').waitFor({state:'detached'});
  await page.locator('nav').getByRole('link',{name:'Mapa territorial'}).click();await page.locator('#polygon-territory').selectOption({label:'Territorio PHP'});
  await page.getByRole('button',{name:'Dibujar',exact:true}).click();const canvas=page.locator('#territory-map');
  await canvas.click({position:{x:230,y:200}});await canvas.click({position:{x:340,y:200}});await canvas.click({position:{x:340,y:300}});
  await page.getByRole('button',{name:'Guardar polígono'}).click();await page.getByText('Polígono guardado.',{exact:true}).waitFor();
  assert.equal((await request('/data')).body.territories.find(x=>x.code==='PHP-T1').polygon.length,3);
  await page.reload();await page.getByRole('heading',{name:'Cada punto cuenta.'}).waitFor();
  await page.locator('nav').getByRole('link',{name:'Ciudadanos',exact:true}).click();await page.getByRole('button',{name:'Agregar ciudadano'}).click();
  await page.locator('[name="name"]').fill('Prueba PHP ciudadano');await page.locator('[name="houseId"]').selectOption('h1');
  await page.getByRole('button',{name:'Guardar registro'}).click();await page.getByRole('dialog').waitFor({state:'detached'});
  await page.getByRole('textbox',{name:'Buscar registros'}).fill('Prueba PHP ciudadano');await page.getByRole('button',{name:'Editar registro'}).click();await page.locator('[name="status"]').selectOption('Verificado');
  await page.getByRole('button',{name:'Guardar registro'}).click();await page.getByRole('dialog').waitFor({state:'detached'});await page.getByRole('textbox',{name:'Buscar registros'}).fill('Prueba PHP ciudadano');
  await expect(page.locator('#records-table .status')).toHaveText('Verificado');await page.getByRole('button',{name:'Archivar registro'}).click();await page.getByRole('button',{name:'Archivar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
  assert.ok(!(await request('/data')).body.citizens.some(x=>x.name==='Prueba PHP ciudadano'));
  await page.locator('nav').getByRole('link',{name:'Indicadores'}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar resumen'}).click();assert.equal((await download).suggestedFilename(),'sigeia-resumen-territorial.csv');
  await page.setViewportSize({width:390,height:844});await page.goto(base);await page.getByRole('heading',{name:'Tu territorio, en perspectiva.'}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('PASS Apache/PHP: subcarpeta, dashboard, CRUD, referencias, archivo, concurrencia, CSRF/origen, polígonos, persistencia, CSV y móvil.');
  for(const path of ['private/bootstrap.php','private/domains.php','private/seed.php','private/','app.html','.user.ini'])assert.equal((await fetch(base+path)).status,403,path);
  const roots=await fetch(`http://127.0.0.1:${port}/sigeia-data/`);assert.notEqual(roots.status,200);
  console.log('PASS Apache: directorio privado, plantillas y archivos ocultos bloqueados; almacenamiento fuera de DocumentRoot.');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'index.php?mode=pilot');assert.ok(page.url().endsWith('configurar.php'));
  const setupToken=await page.locator('[name="csrf"]').inputValue();
  const password='Synthetic-PHP-browser-password-42!';
  await page.locator('[name="username"]').fill('adminphp');await page.locator('[name="password"]').fill(password);await page.locator('[name="confirmation"]').fill(password);await page.getByRole('button',{name:'Crear cuenta y abrir el piloto'}).click();
  await page.getByRole('heading',{name:'Todo comienza aquí.'}).waitFor();
  assert.equal((await request('/data','GET',undefined,{},'pilot')).status,401);
  await page.locator('[name="username"]').fill('adminphp');await page.locator('[name="password"]').fill(password);await page.getByRole('button',{name:'Entrar a la plataforma'}).click();await page.getByRole('heading',{name:'Tu territorio, en perspectiva.'}).waitFor();await expect(page.locator('.metric-value').first()).toHaveText('0');
  await page.reload();await page.getByRole('heading',{name:'Tu territorio, en perspectiva.'}).waitFor();
  const pilotSession=await page.evaluate(()=>fetch('./api.php?mode=pilot&route=%2Fauth%2Fme').then(r=>r.json()));
  const createPilot=await context.request.post(base+'api.php?mode=pilot&route=%2Fentities%2Fregions',{headers:{'X-CSRF-Token':pilotSession.csrf},data:{name:'Región piloto PHP',code:'PILOT-01'}});assert.equal(createPilot.status(),201);
  const denied=await context.request.post(base+'api.php?mode=pilot&route=%2Fentities%2Fregions',{headers:{'X-CSRF-Token':'wrong'},data:{name:'CSRF',code:'BAD'}});assert.equal(denied.status(),403);
  await page.locator('#account').click();await page.getByRole('heading',{name:'Todo comienza aquí.'}).waitFor();
  await page.goto(base+'configurar.php');await page.getByRole('heading',{name:'Tu piloto está configurado.'}).waitFor();
  const again=await context.request.post(base+'configurar.php',{form:{csrf:setupToken,username:'another',password,confirmation:password}});assert.ok([403,409].includes(again.status()));
  const privateDirs=execFileSync(php,['-n','-r',`foreach(glob($argv[1].'/sigeia-data/*') as $p) if(is_file($p.'/users.json')) echo $p;`,temp],{encoding:'utf8'}).trim();
  assert.ok(privateDirs);assert.ok(!readFileSync(join(privateDirs,'users.json'),'utf8').includes(password));
  const extraUsers=JSON.parse(readFileSync(join(privateDirs,'users.json'),'utf8'));
  const hash=extraUsers[0].passwordHash;
  extraUsers.push({username:'readerphp',role:'consulta',passwordHash:hash},{username:'capturephp',role:'capturista',passwordHash:hash});writeFileSync(join(privateDirs,'users.json'),JSON.stringify(extraUsers));
  const apiContext=await browser.newContext();
  for(const [username,entity,expected]of[['readerphp','regions',403],['capturephp','regions',403],['capturephp','citizens',400]]){
    const login=await apiContext.request.post(base+'api.php?mode=pilot&route=%2Fauth%2Flogin',{data:{username,password}});assert.equal(login.status(),200);const me=await login.json();
    const operation=await apiContext.request.post(base+'api.php?mode=pilot&route='+encodeURIComponent('/entities/'+entity),{headers:{'X-CSRF-Token':me.csrf},data:{}});assert.equal(operation.status(),expected);
  }
  await apiContext.close();
  for(let i=0;i<10;i++)assert.equal((await request('/auth/login','POST',{username:'missing',password:'invalid'},{},'pilot')).status,401);
  assert.equal((await request('/auth/login','POST',{username:'missing',password:'invalid'},{},'pilot')).status,429);
  console.log('PASS Apache/PHP: primera cuenta, bloqueo de reconfiguración, piloto vacío y separado, login, cookies/sesión, logout, perfiles, límite de intentos y hash de contraseñas.');
  await page.goto(`http://127.0.0.1:${port}/anidado/otra-instalacion/`);await page.getByRole('heading',{name:'Tu territorio, en perspectiva.'}).waitFor();await expect(page.locator('.metric-value').first()).toHaveText('3');
  assert.deepEqual(errors,[]);console.log('PASS Apache/PHP: otra instalación anidada independiente, rutas relativas y cero errores JS.');
  // A separate arbitrary domain confirms the PHP core has no dependency on SIGEIA entities.
  const check=`define('SIGEIA_APP',true);require $argv[1];$d=['books'=>[]];$defs=['books'=>['fields'=>[['key'=>'title','label'=>'Título','type'=>'text','required'=>true]]]];$r=save_record($d,$defs,'books',['title'=>'Independiente'],null,fn()=>null);if($d['books'][0]['title']!=='Independiente')exit(1);remove_record($d,$defs,'books',$r['id'],fn()=>null);if(empty($d['books'][0]['deletedAt']))exit(2);echo 'OK';`;
  assert.equal(execFileSync(php,['-n','-r',check,join(htdocs,'sigeia','private/framework.php')],{encoding:'utf8'}),'OK');
  console.log('PASS framework PHP: dominio ajeno, alta y archivo con callbacks inyectados.');
  const errorLog=existsSync(join(temp,'error.log'))?readFileSync(join(temp,'error.log'),'utf8'):'';
  assert.ok(!/PHP (Fatal|Warning|Deprecated|Parse)/.test(errorLog),errorLog);
}finally{
  await browser?.close();
  if(child&&child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}
  rmSync(temp,{recursive:true,force:true});
}
