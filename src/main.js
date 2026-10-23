import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createIcons, LayoutDashboard, Map, Users, Building2, Compass, Layers, ChevronDown, ChevronRight, ArrowUpRight, Plus, Search, Bell, Settings2, CircleHelp, ArrowRight, X, Pencil, Trash2, Check, Download, LogOut, ShieldCheck, Filter, LocateFixed, Undo2, CheckCircle2, Menu, FileText } from 'lucide';
import './style.css';
const iconSet = { LayoutDashboard, Map, Users, Building2, Compass, Layers, ChevronDown, ChevronRight, ArrowUpRight, Plus, Search, Bell, Settings2, CircleHelp, ArrowRight, X, Pencil, Trash2, Check, Download, LogOut, ShieldCheck, Filter, LocateFixed, Undo2, CheckCircle2, Menu, FileText };
const icon = name => `<i data-lucide="${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}"></i>`;
const icons = () => createIcons({ icons: iconSet, attrs: { 'stroke-width': 1.7 } });
const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
let session, meta = {}, data = {}, page = 'overview', territoryFilter = '', search = '', entity = 'territories', map, mapGroup, draftLayer, drawing = false, vertices = [], refreshTimer;
let tableEntity = '';
const levelEntities = { 'Región': 'regions', 'Territorio': 'territories', 'Localidad': 'localities', 'Sector': 'sectors' };
const entityPages = { territories: 'territorial', regions: 'territorial', localities: 'territorial', sectors: 'territorial', operators: 'operations', roles: 'operations', assignments: 'operations', houses: 'houses', citizens: 'citizens' };
function writable(key) { return session.role === 'admin' || (session.role === 'coordinador' && key !== 'roles') || (session.role === 'capturista' && ['houses', 'citizens'].includes(key)); }
function toast(message, error = false) {
  const el = document.createElement('div'); el.className = 'toast' + (error ? ' error' : ''); el.textContent = message; el.setAttribute('role', 'status'); document.body.append(el); setTimeout(() => el.remove(), 4500);
}
async function api(path, options = {}) {
  const phpEndpoint = document.querySelector('meta[name="sigeia-api"]')?.content;
  const response = await fetch(phpEndpoint ? phpEndpoint + encodeURIComponent(path) : '/api' + path, { ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session?.csrf || '', ...options.headers } });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && session) { session = null; clearInterval(refreshTimer); loginView(); }
    throw new Error(result.error || 'No se pudo completar la solicitud.');
  }
  return result;
}
function territoryForHouse(house) {
  const sector = data.sectors.find(x => x.id === house.sectorId);
  return data.localities.find(x => x.id === sector?.localityId)?.territoryId;
}
function housesFor(id) { return id ? data.houses.filter(x => territoryForHouse(x) === id) : data.houses; }
function metrics(id = territoryFilter) {
  const houses = housesFor(id);
  const citizens = data.citizens.filter(x => houses.some(h => h.id === x.houseId));
  const visited = houses.filter(x => x.status === 'Visitada').length;
  return { houses, citizens, visited, coverage: houses.length ? Math.round(visited / houses.length * 100) : 0 };
}
function titleBlock(kicker, title, description, actions = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function selectTerritory() {
  return `<label class="select-wrap">${icon('Compass')}<select aria-label="Filtrar por territorio" id="territory-filter"><option value="">Todos los territorios</option>${data.territories.map(t => `<option value="${esc(t.id)}" ${territoryFilter === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>${icon('ChevronDown')}</label>`;
}
function shell() {
  document.querySelector('#app').innerHTML = `<aside class="sidebar"><a class="brand" href="#overview"><span class="brand-symbol">${icon('Layers')}</span><span>SIGEIA<span class="brand-caption">TERRITORIAL INTELLIGENCE</span></span></a><div class="workspace-label">ESPACIO DE TRABAJO</div><div class="workspace"><span class="workspace-avatar">S</span><span>Plataforma territorial<small>${session.mode === 'demo' ? 'Entorno de demostración' : 'Piloto · acceso privado'}</small></span><span class="live-dot"></span></div><div class="nav-label">PLATAFORMA</div><nav>${[
    ['overview', 'LayoutDashboard', 'Vista general'], ['territorial', 'Compass', 'Estructura territorial'], ['map', 'Map', 'Mapa territorial'], ['operations', 'Users', 'Equipo operativo'], ['houses', 'Building2', 'Casas'], ['citizens', 'Users', 'Ciudadanos'], ['analytics', 'Layers', 'Indicadores']
  ].map(([id, i, label]) => `<a href="#${id}" data-page="${id}">${icon(i)}<span>${label}</span>${id === 'map' ? '<span class="nav-tag">GEO</span>' : ''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="framework-card"><span class="framework-icon">${icon('Layers')}</span><strong>Un territorio. Una visión.</strong><p>Conecta la información.<br>Entiende tu territorio.</p><a href="#domains">Explorar los dominios ${icon('ArrowUpRight')}</a></div><a class="settings-link" href="#domains">${icon('Settings2')} Fichas de dominio</a><button class="user-profile" id="account"><span class="avatar">${esc(session.username.slice(0, 2).toUpperCase())}</span><span>${esc(session.username)}<small>${esc(session.role === 'admin' ? 'Administración' : session.role)}</small></span>${icon('LogOut')}</button></div></aside><div class="main-shell"><header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" aria-label="Abrir menú">${icon('Menu')}</button><span>Plataforma</span>${icon('ChevronRight')}<strong id="breadcrumb-page">Vista general</strong></div><div class="topbar-actions"><span class="environment-pill"><span></span>${session.mode === 'demo' ? 'Datos de demostración' : 'Piloto privado'}</span><button class="icon-button" id="help" aria-label="Ayuda">${icon('CircleHelp')}</button><span class="topbar-divider"></span><span class="avatar small">${esc(session.username.slice(0,2).toUpperCase())}</span></div></header><main id="main"></main><footer>SIGEIA <span>Administración territorial con perspectiva.</span><span class="footer-right">${session.mode === 'demo' ? 'Datos ficticios · ' : ''}v0.1 · Piloto</span></footer></div><div id="modal-root"></div>`;
  document.querySelector('#account').onclick = async () => {
    if (session.mode === 'demo') return toast('Modo demostración. No hay una cuenta personal conectada.');
    try { await api('/auth/logout', { method: 'POST', body: '{}' }); session = null; clearInterval(refreshTimer); loginView(); } catch (error) { toast(error.message, true); }
  };
  document.querySelector('#help').onclick = showHelp;
  document.querySelector('.mobile-menu').onclick = () => document.body.classList.toggle('menu-open');
  renderPage();
}
function renderPage() {
  map?.stop(); map?.remove(); map = null; drawing = false; vertices = []; search = '';
  const route = location.hash.slice(1) || 'overview';
  page = ['overview', 'territorial', 'map', 'operations', 'houses', 'citizens', 'analytics', 'domains'].includes(route) ? route : 'overview';
  document.body.classList.remove('menu-open');
  document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const label = { overview: 'Vista general', territorial: 'Estructura territorial', map: 'Mapa territorial', operations: 'Equipo operativo', houses: 'Casas', citizens: 'Ciudadanos', analytics: 'Indicadores', domains: 'Fichas de dominio' }[page];
  document.querySelector('#breadcrumb-page').textContent = label;
  const main = document.querySelector('#main');
  if (page === 'overview') main.innerHTML = overview();
  else if (page === 'map') main.innerHTML = mapPage();
  else if (page === 'analytics') main.innerHTML = analytics();
  else if (page === 'domains') main.innerHTML = domainsPage();
  else {
    const choices = page === 'territorial' ? ['regions', 'territories', 'localities', 'sectors'] : page === 'operations' ? ['operators', 'roles', 'assignments'] : [page];
    entity = choices.includes(entity) ? entity : choices[page === 'territorial' ? 1 : 0];
    main.innerHTML = entityPage(choices);
  }
  icons(); bindPage();
  if (['overview', 'map'].includes(page)) mountMap();
}
function overview() {
  const m = metrics();
  const territories = territoryFilter ? data.territories.filter(t => t.id === territoryFilter) : data.territories;
  return titleBlock('CENTRO DE CONTROL', 'Tu territorio, en perspectiva<span class="title-dot">.</span>', 'Una visión conectada de tu estructura territorial y tu operación.', `<button class="button secondary" id="export">${icon('Download')} Exportar resumen</button><button class="button primary" id="quick-add" ${!writable('territories') ? 'disabled' : ''}>${icon('Plus')} Nuevo territorio</button>`) +
    `<div class="overview-toolbar">${selectTerritory()}<span class="updated"><span class="live-dot"></span>Actualizado <time id="updated-time">${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</time> · cada 30 s</span></div><div class="metrics-grid">
    ${metricCard('Territorios', territories.length, 'Unidades territoriales activas', 'Compass', 'teal')}
    ${metricCard('Operadores', data.operators.length, 'Personas en el equipo operativo', 'Users', 'purple')}
    ${metricCard('Ciudadanos', m.citizens.length, 'Registros en el territorio seleccionado', 'Users', 'blue')}
    ${metricCard('Cobertura de visitas', m.coverage + '%', `${m.visited} de ${m.houses.length} casas visitadas`, 'LocateFixed', 'orange')}
    </div><div class="dashboard-grid"><section class="panel map-panel"><div class="panel-heading"><div><h2>Panorama territorial <span class="badge">EN VIVO</span></h2><p>Explora los territorios y su cobertura de visitas.</p></div><a href="#map" class="text-link">Abrir mapa ${icon('ArrowUpRight')}</a></div><div class="map-wrap"><div id="territory-map"></div><div class="map-legend"><span><b class="legend-dot teal"></b>Territorio</span><span><b class="legend-dot orange"></b>Casa pendiente</span><span><b class="legend-dot green"></b>Casa visitada</span></div></div></section><section class="panel coverage-panel"><div class="panel-heading"><div><h2>Avance de cobertura</h2><p>Visitas a casas registradas</p></div>${icon('LocateFixed')}</div><div class="coverage-ring" style="--progress:${m.coverage}%"><div><strong>${m.coverage}<small>%</small></strong><span>Cobertura total</span></div></div><div class="coverage-key"><span><b class="legend-dot green"></b>Visitadas<strong>${m.visited}</strong></span><span><b class="legend-dot light"></b>Pendientes<strong>${m.houses.length-m.visited}</strong></span></div><div class="coverage-note">${icon('CircleHelp')} La cobertura se calcula sobre las casas registradas; no estima la población total.</div></section></div><div class="bottom-grid"><section class="panel"><div class="panel-heading"><div><h2>Territorios en seguimiento</h2><p>El detalle detrás de cada zona.</p></div><a href="#territorial" class="text-link">Ver todos ${icon('ArrowRight')}</a></div><div class="table-wrap"><table><thead><tr><th>Territorio</th><th>Casas</th><th>Cobertura</th><th></th></tr></thead><tbody>${territories.slice(0,5).map(t => { const tm=metrics(t.id); return `<tr><td><span class="table-symbol">${icon('Compass')}</span><strong>${esc(t.name)}</strong><small class="table-code">${esc(t.code)}</small></td><td>${tm.houses.length}</td><td><div class="inline-progress"><span><b style="width:${tm.coverage}%"></b></span><strong>${tm.coverage}%</strong></div></td><td><button class="icon-button inspect-territory" data-id="${esc(t.id)}" aria-label="Ver territorio">${icon('ArrowUpRight')}</button></td></tr>`; }).join('') || '<tr><td colspan="4" class="empty">Crea tu primer territorio para comenzar.</td></tr>'}</tbody></table></div></section><section class="panel activity-panel"><div class="panel-heading"><div><h2>Últimos registros</h2><p>Movimientos en la plataforma</p></div><span class="small-dot"></span></div>${recentRecords()}</section></div>`;
}
function metricCard(label, value, subtitle, i, color) {
  return `<section class="metric-card"><div class="metric-top"><span>${label}</span><span class="metric-icon ${color}">${icon(i)}</span></div><strong class="metric-value">${value}</strong><p>${subtitle}</p></section>`;
}
function recentRecords() {
  const records = Object.entries(data).flatMap(([key, items]) => items.map(x => ({ ...x, entity: key }))).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,4);
  return `<div class="activity-list">${records.map((x,i) => `<div class="activity"><div class="activity-dot ${i===0?'first':''}">${icon('Check')}</div><div><strong>${esc(x.name || meta[x.entity].singular)}</strong><p>${esc(meta[x.entity].label)} · ${esc(new Date(x.updatedAt).toLocaleDateString('es-MX', {day:'numeric',month:'short'}))}</p></div></div>`).join('') || '<p class="empty">Aún no hay registros.</p>'}</div><div class="activity-footer">${icon('ShieldCheck')} Historial de modificaciones locales</div>`;
}
function mapPage() {
  return titleBlock('INTELIGENCIA GEOESPACIAL','Cada punto cuenta<span class="title-dot">.</span>','Dibuja polígonos, ubica casas y conecta tu estructura territorial.', selectTerritory()) + `<section class="panel full-map-panel"><div class="map-tools"><div class="draw-tools"><select id="polygon-territory" aria-label="Territorio para dibujar"><option value="">Selecciona un territorio</option>${data.territories.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><button class="button secondary" id="draw-polygon" ${!writable('territories')?'disabled':''}>${icon('Pencil')} Dibujar</button><button class="button secondary" id="undo-point" disabled>${icon('Undo2')} Deshacer punto</button><button class="button primary" id="save-polygon" disabled>${icon('Check')} Guardar polígono</button><button class="button secondary" id="cancel-polygon" disabled>Cancelar</button></div><span id="draw-hint">Selecciona un territorio para editar su polígono.</span></div><div class="map-wrap large"><div id="territory-map"></div><div class="map-legend"><span><b class="legend-dot teal"></b>Territorio</span><span><b class="legend-dot orange"></b>Pendiente</span><span><b class="legend-dot green"></b>Visitada</span></div></div><div class="map-caption">Coordenadas WGS84 · Los polígonos son referencias operativas y no representan límites oficiales. <button class="text-link" id="toggle-basemap">${session.mode==='demo'?'Ocultar':'Cargar'} mapa base OSM</button></div></section>`;
}
function entityPage(choices) {
  return titleBlock(meta[entity].domain.toUpperCase(), {territorial:'La base de tu territorio',operations:'Personas que conectan',houses:'Casa por casa',citizens:'Registros de ciudadanos'}[page] + '<span class="title-dot">.</span>', {territorial:'Organiza regiones, territorios, localidades y sectores.',operations:'Define roles operativos y asigna responsables por nivel.',houses:'Registra ubicaciones y da seguimiento a las visitas.',citizens:'Relaciona cada registro con una casa y verifica su información.'}[page], writable(entity) ? `<button class="button primary" id="add-record">${icon('Plus')} ${meta[entity].singular === 'Casa' ? 'Nueva' : 'Agregar'} ${esc(meta[entity].singular.toLowerCase())}</button>` : '<span class="badge">SOLO LECTURA</span>') + `<section class="panel entity-panel">${choices.length>1?`<div class="tabs">${choices.map(k=>`<button data-entity="${k}" class="${entity===k?'active':''}">${esc(meta[k].label)}<span>${data[k].length}</span></button>`).join('')}</div>`:''}<div class="list-toolbar"><div><h2>${esc(meta[entity].label)} <span class="count">${data[entity].length}</span></h2><p>Registros activos en la plataforma</p></div><label class="search-input">${icon('Search')}<input id="record-search" placeholder="Buscar en ${esc(meta[entity].label.toLowerCase())}…" aria-label="Buscar registros"></label></div><div class="table-wrap" id="records-table"></div></section>${page==='operations'?'<p class="muted footnote">Los roles operativos clasifican al equipo. Los perfiles de acceso (administración, coordinación, captura y consulta) se asignan a las cuentas del sistema por separado.</p>':''}`;
}
function displayField(field, record) {
  if (field.type === 'polygon') return record.polygon?.length ? `${record.polygon.length} vértices` : 'Sin polígono';
  if (field.type === 'reference') return data[field.entity].find(x => x.id === record[field.key])?.name || '—';
  if (field.key === 'targetId') return data[levelEntities[record.level]]?.find(x=>x.id===record.targetId)?.name || '—';
  return record[field.key] ?? '—';
}
function renderTable() {
  const target=document.querySelector('#records-table'); if(!target)return;
  tableEntity = entity;
  const fields=meta[entity].fields;
  const rows=data[entity].filter(record=>fields.some(f=>String(displayField(f,record)).toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))));
  target.innerHTML=`<table><thead><tr>${fields.map(f=>`<th>${esc(f.label)}</th>`).join('')}${writable(entity)?'<th>Acciones</th>':''}</tr></thead><tbody>${rows.map(record=>`<tr>${fields.map((f,i)=>`<td>${f.key==='status'?`<span class="status ${['Visitada','Verificado'].includes(record.status)?'positive':'pending'}">${esc(displayField(f,record))}</span>`:i===0?`<strong>${esc(displayField(f,record))}</strong>`:esc(displayField(f,record))}</td>`).join('')}${writable(entity)?`<td class="row-actions"><button class="icon-button edit-record" data-id="${esc(record.id)}" aria-label="Editar registro">${icon('Pencil')}</button><button class="icon-button delete-record" data-id="${esc(record.id)}" aria-label="Archivar registro">${icon('Trash2')}</button></td>`:''}</tr>`).join('')||`<tr><td colspan="${fields.length+1}" class="empty"><div>${icon('Search')}</div><strong>${search?'No hay coincidencias':'Todo empieza con un registro'}</strong><p>${search?'Intenta con otro término de búsqueda.':'Agrega el primer registro para activar este módulo.'}</p></td></tr>`}</tbody></table>`;
  target.querySelectorAll('.edit-record').forEach(b=>b.onclick=()=>openForm(entity,b.dataset.id));
  target.querySelectorAll('.delete-record').forEach(b=>b.onclick=()=>confirmDelete(entity,b.dataset.id)); icons();
}
function analytics() {
  const m=metrics();
  const verified=m.citizens.filter(x=>x.status==='Verificado').length;
  return titleBlock('DOMINIO ANALÍTICO','Información para actuar<span class="title-dot">.</span>','Indicadores calculados a partir de los registros activos.',`<button class="button secondary" id="export">${icon('Download')} Exportar resumen</button>`) + `<div class="overview-toolbar">${selectTerritory()}<span class="updated">Se actualiza cada 30 segundos</span></div><div class="metrics-grid">${metricCard('Casas registradas',m.houses.length,'Base del cálculo de cobertura','Building2','teal')}${metricCard('Casas visitadas',m.visited,'Visitas registradas por el equipo','CheckCircle2','purple')}${metricCard('Ciudadanos verificados',verified,`De ${m.citizens.length} registros totales`,'ShieldCheck','blue')}${metricCard('Cobertura de visitas',m.coverage+'%','Casas visitadas / casas registradas','LocateFixed','orange')}</div><section class="panel"><div class="panel-heading"><div><h2>Cobertura por territorio</h2><p>Comparación de visitas sobre la base registrada</p></div></div><div class="bar-chart">${data.territories.filter(t=>!territoryFilter||t.id===territoryFilter).map(t=>{const v=metrics(t.id);return `<div class="bar-row"><strong>${esc(t.name)}</strong><div><span style="width:${v.coverage}%"></span></div><b>${v.coverage}%</b><small>${v.visited} / ${v.houses.length} casas</small></div>`;}).join('')||'<p class="empty">Registra territorios y casas para visualizar los indicadores.</p>'}</div></section><div class="info-banner">${icon('CircleHelp')}No se infieren afinidades políticas ni características sensibles. La integración de IA está pendiente y no participa en estos indicadores.</div>`;
}
function domainsPage() {
  return titleBlock('META FRAMEWORK','El dominio define la estructura<span class="title-dot">.</span>','Fichas propuestas para revisión. Estas definiciones alimentan formularios y validaciones reutilizables.') + `<div class="info-banner">${icon('FileText')}Estado: propuesta de piloto. No se ha registrado una aprobación de las fichas. La persistencia actual usa archivos JSON; no se han creado tablas SQL.</div><div class="domain-grid">${Object.entries(meta).map(([key,def])=>`<section class="panel domain-card"><span class="eyebrow">${esc(def.domain)}</span><h2>${esc(def.label)}</h2><p>Identificador: <code>${key}</code></p><ul>${def.fields.map(f=>`<li><span>${esc(f.label)}${f.required?' <b>*</b>':''}</span><small>${esc(f.type==='reference'?meta[f.entity].label:f.type==='polygon'?'Coordenadas WGS84':f.type==='select'?'Catálogo':f.type==='number'?'Número':'Texto')}</small></li>`).join('')}</ul><div class="domain-footer">Borrado lógico · Validación en servidor</div></section>`).join('')}</div>`;
}
function bindPage() {
  document.querySelector('#territory-filter')?.addEventListener('change', e=>{territoryFilter=e.target.value;renderPage();});
  document.querySelector('#quick-add')?.addEventListener('click',()=>openForm('territories'));
  document.querySelector('#add-record')?.addEventListener('click',()=>openForm(entity));
  document.querySelector('#export')?.addEventListener('click',exportSummary);
  document.querySelectorAll('[data-entity]').forEach(b=>b.onclick=()=>{entity=b.dataset.entity;renderPage();});
  document.querySelectorAll('.inspect-territory').forEach(b=>b.onclick=()=>{territoryFilter=b.dataset.id;location.hash='map';});
  document.querySelector('#record-search')?.addEventListener('input',e=>{search=e.target.value;renderTable();});
  renderTable();
}
function mountMap() {
  const element=document.querySelector('#territory-map'); if(!element)return;
  map=L.map(element,{zoomControl:false,attributionControl:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([19.433,-99.145],14);
  L.control.zoom({position:'bottomright'}).addTo(map);
  let tiles;
  function toggleTiles() {
    if(tiles){map.removeLayer(tiles);tiles=null;}else{tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'});tiles.addTo(map);tiles.on('tileerror',()=>{element.classList.add('tiles-unavailable');});}
    const b=document.querySelector('#toggle-basemap');if(b)b.textContent=tiles?'Ocultar mapa base OSM':'Cargar mapa base OSM';
  }
  if(session.mode==='demo')toggleTiles();
  document.querySelector('#toggle-basemap')?.addEventListener('click',()=>{
    if(!tiles&&session.mode!=='demo')return modal('Cargar mapa externo','<p>El proveedor OpenStreetMap recibirá tu dirección IP y las zonas de mapa consultadas. No se envían nombres ni registros de ciudadanos.</p><p>Usa esta opción solo si está permitida en las reglas de privacidad de tu piloto.</p>',[{label:'Cancelar',action:closeModal},{label:'Cargar mapa base',primary:true,action:()=>{closeModal();toggleTiles();}}]);
    toggleTiles();
  });
  mapGroup=L.featureGroup().addTo(map);
  const colors=['#246b59','#5d7dba','#bd9055'];
  data.territories.filter(t=>!territoryFilter||t.id===territoryFilter).forEach((t,i)=>{
    if(!t.polygon?.length)return;
    const coverage=metrics(t.id).coverage;
    L.polygon(t.polygon,{color:colors[i%3],weight:2,fillOpacity:0.15,dashArray:'6 4'}).bindTooltip(`<b>${esc(t.name)}</b><br>${coverage}% de cobertura`,{direction:'center'}).bindPopup(`<strong>${esc(t.name)}</strong><br>${esc(t.code)}<br>${coverage}% de casas visitadas`).addTo(mapGroup);
  });
  housesFor(territoryFilter).forEach(h=>L.circleMarker([h.lat,h.lng],{radius:6,color:'#fff',weight:2,bubblingMouseEvents:true,fillColor:h.status==='Visitada'?'#3a8165':'#dc9b55',fillOpacity:1}).bindPopup(`<strong>${esc(h.name)}</strong><br>${esc(h.address)}<br>${esc(h.status)}`).addTo(mapGroup));
  if(mapGroup.getLayers().length)map.fitBounds(mapGroup.getBounds(),{padding:[35,35],maxZoom:15});
  if(page==='map'){
    draftLayer=L.featureGroup().addTo(map);
    document.querySelector('#draw-polygon').onclick=()=>{
      const selected=document.querySelector('#polygon-territory').value;
      if(!selected)return toast('Selecciona el territorio cuyo polígono quieres dibujar.',true);
      drawing=true;vertices=[];draftLayer.clearLayers();
      mapGroup.eachLayer(layer=>{layer.closePopup();layer.closeTooltip();});map.doubleClickZoom.disable();
      document.querySelector('#polygon-territory').disabled=true;
      document.querySelector('#cancel-polygon').disabled=false;
      document.querySelector('#draw-hint').textContent='Haz clic en el mapa para añadir vértices. Se necesitan al menos tres.';
      element.classList.add('drawing');
    };
    element.addEventListener('click',event=>{if(!drawing)return;event.preventDefault();event.stopPropagation();const point=map.mouseEventToLatLng(event);vertices.push([Number(point.lat.toFixed(7)),Number(point.lng.toFixed(7))]);redraw();},true);
    function redraw(){
      draftLayer.clearLayers();
      if(vertices.length>1)L.polygon(vertices,{color:'#123e32',fillColor:'#d2ec93',fillOpacity:0.4,interactive:false}).addTo(draftLayer);
      vertices.forEach(p=>L.circleMarker(p,{radius:5,color:'#123e32',fillColor:'#d2ec93',fillOpacity:1,interactive:false}).addTo(draftLayer));
      document.querySelector('#save-polygon').disabled=vertices.length<3;
      document.querySelector('#undo-point').disabled=vertices.length===0;
      document.querySelector('#draw-hint').textContent=`${vertices.length} vértices · ${vertices.length<3?'Añade al menos tres puntos.':'Listo para guardar el polígono.'}`;
    }
    document.querySelector('#undo-point').onclick=()=>{vertices.pop();redraw();};
    document.querySelector('#cancel-polygon').onclick=()=>renderPage();
    document.querySelector('#save-polygon').onclick=async()=>{
      const button=document.querySelector('#save-polygon');button.disabled=true;
      const t=data.territories.find(t=>t.id===document.querySelector('#polygon-territory').value);
      try{await api(`/entities/territories/${t.id}`,{method:'PUT',body:JSON.stringify({...t,polygon:vertices})});await reload();renderPage();toast('Polígono guardado.');}catch(error){toast(error.message,true);button.disabled=false;}
    };
  }
  const mountedMap=map;setTimeout(()=>{if(map===mountedMap)mountedMap.invalidateSize({animate:false});},50);
}
let modalLastFocus;
function closeModal(){document.querySelector('#modal-root').innerHTML='';document.body.classList.remove('modal-open');modalLastFocus?.focus();}
function modal(title, content, actions = []) {
  modalLastFocus=document.activeElement;
  document.body.classList.add('modal-open');
  document.querySelector('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header><div><span class="eyebrow">SIGEIA PLATFORM</span><h2 id="modal-title">${esc(title)}</h2></div><button class="icon-button" id="modal-close" aria-label="Cerrar">${icon('X')}</button></header><div class="modal-body">${content}</div>${actions.length?`<footer class="modal-actions">${actions.map((a,i)=>`<button class="button ${a.primary?'primary':'secondary'} ${a.danger?'danger':''}" data-modal-action="${i}">${esc(a.label)}</button>`).join('')}</footer>`:''}</section></div>`;
  document.querySelector('#modal-close').onclick=closeModal;
  document.querySelector('.modal-backdrop').onclick=e=>{if(e.target.classList.contains('modal-backdrop'))closeModal();};
  document.querySelectorAll('[data-modal-action]').forEach(b=>b.onclick=actions[Number(b.dataset.modalAction)].action);
  const dialog=document.querySelector('.modal');
  dialog.addEventListener('keydown',e=>{
    if(e.key==='Escape')closeModal();
    if(e.key==='Tab'){
      const focusable=[...dialog.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled);
      const first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  });
  icons();dialog.querySelector('input,select,button')?.focus();
}
function openForm(key,id) {
  const def=meta[key];const record=data[key].find(x=>x.id===id)||{};
  if(!writable(key))return;
  const fields=def.fields.filter(f=>f.type!=='polygon');
  const optionsFor=(f)=>f.key==='targetId'?data[levelEntities[record.level||'Región']]:data[f.entity];
  modal(`${id?'Editar':'Agregar'} ${def.singular.toLowerCase()}`,`<form id="record-form"><p class="form-intro">${key==='citizens'?'Registra únicamente la información autorizada para el piloto. No incluyas datos sensibles.':'Los campos con * son obligatorios.'}</p><div class="form-grid">${fields.map(f=>`<label class="form-field ${['name','address','description'].includes(f.key)?'full':''}">${esc(f.label)}${f.required?' *':''}${f.type==='select'?`<select name="${f.key}" required>${f.options.map(v=>`<option value="${esc(v)}" ${record[f.key]===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:f.type==='reference'||f.key==='targetId'?`<select name="${f.key}" ${f.required?'required':''}><option value="">Selecciona una opción</option>${(optionsFor(f)||[]).map(x=>`<option value="${esc(x.id)}" ${record[f.key]===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`:`<input name="${f.key}" type="${f.type==='number'?'number':'text'}" value="${esc(record[f.key]??'')}" ${f.required?'required':''} ${f.type==='number'?`min="${f.min}" max="${f.max}" step="any"`:'maxlength="500"'}>`}</label>`).join('')}</div>${key==='territories'?'<p class="form-intro">Puedes dibujar el polígono después desde el mapa territorial.</p>':''}<p id="form-error" class="form-error" role="alert"></p><div class="form-actions"><button class="button secondary" type="button" id="form-cancel">Cancelar</button><button class="button primary" type="submit">${icon('Check')} Guardar registro</button></div></form>`);
  const form=document.querySelector('#record-form');
  document.querySelector('#form-cancel').onclick=closeModal;
  if(key==='assignments')form.elements.level.onchange=()=>{
    form.elements.targetId.innerHTML='<option value="">Selecciona una opción</option>'+data[levelEntities[form.elements.level.value]].map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  };
  form.onsubmit=async e=>{
    e.preventDefault();
    const values=Object.fromEntries(new FormData(form));
    if(key==='territories')values.polygon=record.polygon||[];
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try{await api(`/entities/${key}${id?'/'+id:''}`,{method:id?'PUT':'POST',body:JSON.stringify(values)});await reload();closeModal();renderPage();toast('Registro guardado correctamente.');}
    catch(error){const target=document.querySelector('#form-error');if(target)target.textContent=error.message;submit.disabled=false;}
  };
}
function confirmDelete(key,id) {
  const record=data[key].find(x=>x.id===id);
  modal('Archivar registro',`<p>¿Quieres archivar <strong>${esc(record.name||meta[key].singular)}</strong>?</p><p>Dejará de aparecer en los registros activos. El servidor conservará el registro mediante borrado lógico. Si tiene dependencias activas, la operación será rechazada.</p><p id="delete-error" class="form-error" role="alert"></p>`,[{label:'Cancelar',action:closeModal},{label:'Archivar',primary:true,danger:true,action:async()=>{
    try{await api(`/entities/${key}/${id}`,{method:'DELETE',body:'{}'});await reload();closeModal();renderPage();toast('Registro archivado.');}catch(error){const target=document.querySelector('#delete-error');if(target)target.textContent=error.message;}
  }}]);
}
function exportSummary() {
  const rows=[['Territorio','Clave','Casas registradas','Casas visitadas','Cobertura (%)','Ciudadanos registrados'],...data.territories.filter(t=>!territoryFilter||t.id===territoryFilter).map(t=>{const m=metrics(t.id);return[t.name,t.code,m.houses.length,m.visited,m.coverage,m.citizens.length];})];
  const safe=value=>{const s=String(value);return '"'+(/^[\s]*[=+@\-]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';};
  const content='\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='sigeia-resumen-territorial.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Resumen exportado sin nombres ni direcciones de ciudadanos.');
}
function showHelp() {
  modal('Comienza con tu territorio',`<div class="help-steps"><p><b>01 · Estructura territorial</b><br>Crea una región, un territorio, una localidad y un sector, en ese orden.</p><p><b>02 · Equipo operativo</b><br>Registra roles y operadores. Asigna cada operador a una unidad territorial.</p><p><b>03 · Casas y ciudadanos</b><br>Registra casas con coordenadas WGS84 y vincula los ciudadanos a su casa.</p><p><b>04 · Mapa e indicadores</b><br>Dibuja los límites operativos y revisa la cobertura de visitas.</p></div><div class="info-banner">Esta es una versión de piloto. No incluye IA, acceso por territorio ni recuperación de contraseñas. Las cuentas se administran desde el servidor.</div>`,[{label:'Entendido',primary:true,action:closeModal}]);
}
function loginView() {
  map?.stop();map?.remove();map=null;
  document.querySelector('#app').innerHTML=`<div class="login-layout"><section class="login-story"><div class="brand"><span class="brand-symbol">${icon('Layers')}</span><span>SIGEIA<span class="brand-caption">TERRITORIAL INTELLIGENCE</span></span></div><div class="login-copy"><div class="eyebrow">CONECTA. COMPRENDE. ACTÚA.</div><h1>Tu territorio.<br>Una visión<br><em>compartida.</em></h1><p>Una plataforma para conectar a las personas, la operación y el territorio.</p><div class="login-line"></div><span>PLATAFORMA TERRITORIAL · PILOTO PRIVADO</span></div><div class="login-grid-art"><span></span><span></span><span></span></div></section><section class="login-form-wrap"><div class="login-form-card"><span class="login-mark">${icon('Compass')}</span><div class="eyebrow">BIENVENIDO A SIGEIA</div><h2>Todo comienza aquí.</h2><p>Ingresa con tu cuenta para acceder a la plataforma.</p><form id="login-form"><label class="form-field">Usuario<input name="username" autocomplete="username" required maxlength="80" placeholder="Tu nombre de usuario"></label><label class="form-field">Contraseña<input name="password" type="password" autocomplete="current-password" required maxlength="256" placeholder="Tu contraseña"></label><p id="login-error" class="form-error" role="alert"></p><button class="button primary" type="submit">Entrar a la plataforma ${icon('ArrowRight')}</button></form><div class="login-privacy">${icon('ShieldCheck')}Acceso exclusivo para personas autorizadas.<br>Solicita tu cuenta a la administración del piloto.</div></div><div class="login-version">SIGEIA PLATFORM <span>v0.1</span></div></section></div>`;icons();
  document.querySelector('#login-form').onsubmit=async e=>{
    e.preventDefault();const form=e.target;const button=form.querySelector('button');button.disabled=true;
    try{session=await api('/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});await initialize();}
    catch(error){const target=document.querySelector('#login-error');if(target)target.textContent=error.message;button.disabled=false;}
  };
}
async function reload() { data=await api('/data'); }
async function initialize() {
  [meta,data]=await Promise.all([api('/meta'),api('/data')]);shell();
  clearInterval(refreshTimer);
  refreshTimer=setInterval(async()=>{
    if(document.hidden||document.querySelector('.modal')||drawing)return;
    try{await reload();if(['overview','analytics'].includes(page))renderPage();}catch(error){if(session)toast('No se pudieron actualizar los datos. Revisa tu conexión.',true);}
  },30_000);
}
window.addEventListener('hashchange',()=>{if(session)renderPage();});
async function boot(){try{session=await api('/auth/me');await initialize();}catch(error){if(error.message==='Failed to fetch'){document.querySelector('#app').innerHTML='<p class="empty">No se pudo conectar al servidor. Actualiza la página cuando vuelva a estar disponible.</p>';}else loginView();}}
boot();
