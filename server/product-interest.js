// This is a consented visit metric, never a count of identifiable people or sales.
export function berlinMonthStart(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'numeric'}).formatToParts(new Date(now));
  const year=Number(parts.find(p=>p.type==='year').value),month=Number(parts.find(p=>p.type==='month').value)-1;
  const utc=Date.UTC(year,month,1);
  const zone=new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',timeZoneName:'longOffset'}).formatToParts(new Date(utc)).find(p=>p.type==='timeZoneName').value;
  const match=/GMT([+-])(\d{2}):(\d{2})/.exec(zone),offset=match?(Number(match[2])*60+Number(match[3]))*60000*(match[1]==='+'?1:-1):0;
  return utc-offset;
}
export async function monthlyProductInterest(store,{mode,now=Date.now(),excludeVisitId=''}={}) {
  if(mode!=='live')return {};
  const rows=await store.all(`SELECT e.design_id,COUNT(DISTINCT e.visit_id) AS views FROM events e
    JOIN visits v ON v.id=e.visit_id
    WHERE v.mode='live' AND e.kind='fixed' AND e.type='view' AND e.created>=? AND e.created<=?
    AND e.visit_id<>? AND NOT EXISTS (SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.visit_id=e.visit_id AND u.role='admin')
    GROUP BY e.design_id`,berlinMonthStart(now),now,excludeVisitId);
  return Object.fromEntries(rows.filter(r=>Number(r.views)>=100).map(r=>[r.design_id,Math.floor(Number(r.views)/100)*100]));
}
