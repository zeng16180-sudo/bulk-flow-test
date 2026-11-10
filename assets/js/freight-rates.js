(() => {
  const DATA_URL = '../data/processed/freight_index_daily_2022_2026.json';
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n).toLocaleString('en-US');
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const yearStyles = [
    {color:'#7b8794',dash:'8 4'}, {color:'#9b7bba',dash:'3 4'},
    {color:'#278a83',dash:'10 4 2 4'}, {color:'#d18b32',dash:'5 3'},
    {color:'#1769aa',dash:''}
  ];
  let data = null, visible = new Set(), selectedIndex = 'BDI';
  function el(name, attrs={}, text='') { const n=document.createElementNS('http://www.w3.org/2000/svg',name); Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v)); if(text)n.textContent=text; return n; }
  function draw() {
    const item=data.indexes[selectedIndex], years=data.daily_history_years, svg=$('freight-seasonality-chart');
    svg.replaceChildren();
    const W=1120,H=430,L=76,R=28,T=24,B=58, plotW=W-L-R, plotH=H-T-B;
    for(let i=0;i<=4;i++){ const y=T+plotH*i/4; svg.append(el('line',{x1:L,y1:y,x2:W-R,y2:y,class:'gridline'})); }
    months.forEach((m,i)=>{const x=L+plotW*i/11;svg.append(el('line',{x1:x,y1:T,x2:x,y2:T+plotH,class:'gridline'}));svg.append(el('text',{x,y:H-22,'text-anchor':'middle',class:'axis-label'},m));});
    svg.append(el('text',{x:L,y:15,class:'axis-label'},`${selectedIndex}｜${item.unit}`));
    let points=0;
    const visibleRows=years.filter(y=>visible.has(y)).flatMap(y=>item.daily.filter(d=>Number(d.date.slice(0,4))===y && Number.isFinite(d.value)));
    const allValues=visibleRows.map(r=>r.value), globalMin=allValues.length?Math.min(...allValues):0, globalMax=allValues.length?Math.max(...allValues):1, globalSpan=globalMax-globalMin||1;
    // Common scale across all visible years: index levels remain comparable.
    for(let i=0;i<=4;i++){const val=globalMax-(globalSpan*i/4);const y=T+plotH*i/4;svg.append(el('text',{x:L-12,y:y+4,'text-anchor':'end',class:'axis-label'},allValues.length?Math.round(val).toLocaleString('en-US'):'—'));}
    years.forEach((year,idx)=>{
      if(!visible.has(year)) return;
      const rows=item.daily.filter(d=>Number(d.date.slice(0,4))===year && Number.isFinite(d.value)).sort((a,b)=>a.date.localeCompare(b.date));
      if(!rows.length)return;
      points+=rows.length;
      const pts=rows.map(r=>{const dt=new Date(r.date+'T00:00:00Z');const mo=dt.getUTCMonth(),day=dt.getUTCDate();const x=L+plotW*(mo+(day-1)/31)/12;const y=T+plotH*(1-(r.value-globalMin)/globalSpan);return {x,y,r};});
      const style=yearStyles[idx]||{color:'#667788',dash:'2 3'};
      let segment=[];
      const flush=()=>{if(!segment.length)return;const path=segment.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');svg.append(el('path',{d:path,fill:'none',stroke:style.color,'stroke-width':year===Math.max(...years)?3.5:2,'stroke-dasharray':style.dash,'stroke-linejoin':'round'}));segment=[];};
      pts.forEach((p,i)=>{if(i){const gap=(Date.parse(p.r.date+'T00:00:00Z')-Date.parse(pts[i-1].r.date+'T00:00:00Z'))/86400000;if(gap>7)flush();}segment.push(p);});flush();
      pts.forEach(p=>{const c=el('circle',{cx:p.x,cy:p.y,r:4,fill:'#fff',stroke:style.color,'stroke-width':2,tabindex:0,role:'button','aria-label':`${p.r.date} ${fmt(p.r.value)} 點`});c.append(el('title',{},`${p.r.date}｜${fmt(p.r.value)} 點`));c.addEventListener('click',()=>showDetail(p.r));c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showDetail(p.r);}});svg.append(c);});
    });
    if(points===0){svg.append(el('text',{x:W/2,y:H/2-6,'text-anchor':'middle',class:'chart-empty'},'尚無可核實的日度歷史資料'));svg.append(el('text',{x:W/2,y:H/2+22,'text-anchor':'middle',class:'axis-label'},'取得授權資料後，依原始點數繪製年度曲線'));}
    $('freight-chart-status').textContent=points?`目前繪出 ${points.toLocaleString()} 筆日度觀測。每年採原始指數點數；缺值處斷線。`:`目前 ${years[0]}–${years.at(-1)} 年度均無可核實日度觀測值；不以週、月資料或零值補線。`;
  }
  function showDetail(r){
    const yoy = r.yoy_pct==null?'—（缺資料）':`${r.yoy_pct.toFixed(2)}%`;
    const base = r.yoy_base_date?`；YoY 基期 ${r.yoy_base_date}（偏移 ${r.yoy_offset_days} 日）`:'；YoY 基期日期：—';
    $('freight-point-detail').textContent=`${r.date}｜${fmt(r.value)} 指數點｜YoY ${yoy}${base}`;
  }
  function renderSummary(){
    const body=$('freight-index-summary');body.replaceChildren();
    Object.entries(data.indexes).forEach(([code,item])=>{const tr=document.createElement('tr');const vals=[code,item.latest?`${fmt(item.latest.value)} ${item.unit}`:'—',item.latest?.date||'—',item.yoy?.pct!=null?`${item.yoy.pct.toFixed(2)}%`:'—',item.status==='latest_third_party_snapshot_only'?'僅最新第三方快照':'尚無日度歷史'];vals.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});body.append(tr);});
  }
  function renderToggles(){
    const wrap=$('freight-year-toggles');wrap.replaceChildren();
    data.daily_history_years.forEach((year,i)=>{const label=document.createElement('label');label.className='year-toggle';const input=document.createElement('input');input.type='checkbox';input.checked=visible.has(year);input.addEventListener('change',()=>{input.checked?visible.add(year):visible.delete(year);draw();});const sw=document.createElement('span');sw.className='year-swatch';sw.style.borderTop=`3px ${yearStyles[i]?.dash?'dashed':'solid'} ${yearStyles[i]?.color||'#667788'}`;const txt=document.createElement('span');txt.textContent=String(year);label.append(input,sw,txt);wrap.append(label);});
  }
  function renderIndex(){
    const item=data.indexes[selectedIndex], latest=item.latest;
    $('freight-latest-value').textContent=latest?`${fmt(latest.value)} ${item.unit}`:'—';
    $('freight-latest-date').textContent=latest?.date||'—';
    $('freight-latest-yoy').textContent=item.yoy?.pct!=null?`${item.yoy.pct.toFixed(2)}%`:'—';
    $('freight-latest-source').textContent=latest?`原編製／管理機構：${item.administrator}。實際取得來源：${item.retrieval_source}；${latest.source_note} YoY 未計算，因無去年同期可核實基期。`:`原編製／管理機構：${item.administrator}。實際取得來源：${item.retrieval_source}。${item.history_note}`;
    $('freight-point-detail').textContent='點選日度曲線上的資料點，可查看該日指數點數及 YoY；目前尚無可選取的歷史資料點。';
    draw();
  }
  fetch(DATA_URL).then(r=>{if(!r.ok)throw Error('data unavailable');return r.json();}).then(d=>{data=d;visible=new Set(d.daily_history_years);renderToggles();renderSummary();$('freight-index-select').addEventListener('change',e=>{selectedIndex=e.target.value;renderIndex();});renderIndex();}).catch(()=>{$('freight-chart-status').textContent='資料檔無法讀取；請確認本機伺服器正常。';});
})();
