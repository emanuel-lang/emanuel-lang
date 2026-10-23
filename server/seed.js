const stamp = { createdAt: '2026-10-23T12:00:00Z', updatedAt: '2026-10-23T12:00:00Z' };
export const seed = {
  regions: [{ id: 'r1', name: 'Región Centro', code: 'RC-01' }],
  territories: [
    { id: 't1', name: 'Territorio Alameda', code: 'TA-01', regionId: 'r1', polygon: [[19.442,-99.155],[19.442,-99.139],[19.432,-99.139],[19.432,-99.155]] },
    { id: 't2', name: 'Territorio Reforma', code: 'TR-02', regionId: 'r1', polygon: [[19.431,-99.168],[19.431,-99.152],[19.421,-99.152],[19.421,-99.168]] },
    { id: 't3', name: 'Territorio Centro', code: 'TC-03', regionId: 'r1', polygon: [[19.435,-99.137],[19.435,-99.123],[19.425,-99.123],[19.425,-99.137]] }
  ],
  localities: [{id:'l1',name:'Alameda Norte',territoryId:'t1'},{id:'l2',name:'Reforma Poniente',territoryId:'t2'},{id:'l3',name:'Centro Histórico',territoryId:'t3'}],
  sectors: [{id:'s1',name:'Sector A-01',localityId:'l1'},{id:'s2',name:'Sector R-01',localityId:'l2'},{id:'s3',name:'Sector C-01',localityId:'l3'}],
  roles: [{id:'role1',name:'Coordinación',description:'Coordinación territorial (clasificación operativa, no concede acceso al sistema).'},{id:'role2',name:'Operación de campo',description:'Registro y seguimiento territorial (clasificación operativa).'}],
  operators: [{id:'o1',name:'Operador demo 01',roleId:'role1'},{id:'o2',name:'Operador demo 02',roleId:'role2'},{id:'o3',name:'Operador demo 03',roleId:'role2'}],
  assignments: [{id:'a1',operatorId:'o1',level:'Región',targetId:'r1'},{id:'a2',operatorId:'o2',level:'Territorio',targetId:'t1'},{id:'a3',operatorId:'o3',level:'Sector',targetId:'s2'}],
  houses: Array.from({length:12},(_,i)=>({id:`h${i+1}`,name:`Casa demo ${String(i+1).padStart(2,'0')}`,address:`Dirección ficticia ${i+1}`,sectorId:`s${i%3+1}`,status:i<8?'Visitada':'Pendiente',lat:[19.437,19.426,19.430][i%3]+Math.floor(i/3)*0.0008,lng:[-99.149,-99.161,-99.132][i%3]+Math.floor(i/3)*0.001})),
  citizens: Array.from({length:8},(_,i)=>({id:`c${i+1}`,name:`Ciudadano ficticio ${String(i+1).padStart(2,'0')}`,houseId:`h${i+1}`,status:i<5?'Verificado':'Por verificar'}))
};
for (const records of Object.values(seed)) for (const row of records) Object.assign(row, stamp);
