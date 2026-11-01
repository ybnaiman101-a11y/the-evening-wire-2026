/* ONE SHARED RACE CATALOG FOR THE SENATE/HOUSE/GOVERNOR TABS AND ADMIN DESK.
   The source is curated research, not an official state-certified ballot. */
(function(){
 'use strict';
 window.EWRaceCatalog={version:null,races:[],byKey:{}};
 window.EWRaceCatalogPromise=fetch('/api/race-catalog',{credentials:'same-origin',cache:'no-store'})
 .then(async response=>{
  if(!response.ok)throw Error('Candidate catalog unavailable (HTTP '+response.status+')');
  const data=await response.json();
  const races=Array.isArray(data.races)?data.races:[];
  if(races.length!==506||races.filter(x=>x.office==='senate').length!==35||races.filter(x=>x.office==='governor').length!==36||races.filter(x=>x.office==='house').length!==435)throw Error('Candidate catalog did not pass 2026 race count checks');
  const byKey=Object.fromEntries(races.map(x=>[x.key,x]));
  window.EWRaceCatalog={...data,races,byKey};
  window.dispatchEvent(new Event('ew-race-catalog-ready'));
  return window.EWRaceCatalog;
 }).catch(e=>{console.error('Candidate roster:',e);window.EWRaceCatalog.error=String(e.message||e);window.dispatchEvent(new Event('ew-race-catalog-ready'));return null});
})();