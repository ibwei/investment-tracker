const { performance } = require('node:perf_hooks');
const { buildDashboardSnapshot, normalizeInvestmentRecord } = require('./load-ts.cjs')()('lib/snapshot.ts');
const at = new Date('2026-09-08T04:00:00Z');
const median = values => values.sort((a,b) => a-b)[Math.floor(values.length/2)];
for (const size of [10,100,1000]) {
 const records=Array.from({length:size},(_,i)=>({id:i+1,project:'Synthetic project',assetName:'USDT',type:'Interest',amount:1000,currency:'USD',startTime:'2026-08-01T00:00:00Z',endTime:'2026-10-01T00:00:00Z',aprExpected:8,status:i%3?'ONGOING':'ENDED',isDeleted:false,createdAt:'2026-08-01T00:00:00Z',updatedAt:'2026-09-08T00:00:00Z'}));
 const full=[],delta=[];
 buildDashboardSnapshot(records,at,'Asia/Shanghai');
 for(let i=0;i<5;i++) {
  let start=performance.now(); buildDashboardSnapshot(records,at,'Asia/Shanghai');full.push(performance.now()-start);
  start=performance.now();normalizeInvestmentRecord(records[0],at,'Asia/Shanghai');delta.push(performance.now()-start);
 }
 console.log(JSON.stringify({records:size,fullCalculationMedianMs:+median(full).toFixed(2),deltaCalculationMedianMs:+median(delta).toFixed(2)}));
}
