(() => {
  const fmt = (v, digits=0) => v == null || v === '' ? '—' : Number(v).toLocaleString('zh-TW',{maximumFractionDigits:digits,minimumFractionDigits:digits});
  const pct = v => v == null ? '缺資料' : `${Number(v)>0?'+':''}${Number(v).toFixed(2)}%`;
  const $ = (id) => document.getElementById(id);
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const svgNS='http://www.w3.org/2000/svg';
  function el(name,attrs={},text){const n=document.createElementNS(svgNS,name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;return n;}
  function emptySvg(svg, message){svg.replaceChildren();svg.setAttribute('viewBox','0 0 900 270');svg.append(el('text',{x:450,y:130,'text-anchor':'middle',class:'chart-empty'},message));}
  function drawBars(svg, rows, onPick){
    svg.replaceChildren();svg.setAttribute('viewBox','0 0 900 310');
    const left=58,right=18,top=26,bottom=55,w=900-left-right,h=310-top-bottom;
    [0,.25,.5,.75,1].forEach(f=>{const y=top+h*f;svg.append(el('line',{x1:left,y1:y,x2:left+w,y2:y,class:'gridline'}));});
    const valid=rows.filter(r=>r.net_weight_tons!==null && r.net_weight_tons!==undefined && Number.isFinite(Number(r.net_weight_tons)));
    const slot=w/12, bw=slot*.56;
    for(let m=1;m<=12;m++) svg.append(el('text',{x:left+(m-.5)*slot,y:top+h+25,'text-anchor':'middle',class:'axis-label'},String(m)));
    if(!valid.length){svg.append(el('text',{x:450,y:130,'text-anchor':'middle',class:'chart-empty'},'尚無可核實的月度海運出口噸數；不以 0 代替缺值'));svg.append(el('text',{x:450,y:302,'text-anchor':'middle',class:'axis-label'},'月份（1–12）｜柱上標示 YoY'));return;}
    const max=Math.max(...valid.map(r=>Number(r.net_weight_tons)))*1.12;
    for(let m=1;m<=12;m++){
      const row=rows.find(r=>Number(r.month)===m);
      const x=left+(m-1)*slot+(slot-bw)/2;
      if(!row || row.net_weight_tons==null) continue;
      const value=Number(row.net_weight_tons), bh=value/max*h, y=top+h-bh;
      const bar=el('rect',{x,y,width:bw,height:bh,rx:4,class:'bar-mark',tabindex:0,role:'button','aria-label':`${m} 月 ${fmt(value)} 公噸，YoY ${pct(row.yoy_pct)}`});
      bar.addEventListener('click',()=>onPick(row));bar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(row);}});svg.append(bar);
      svg.append(el('text',{x:left+(m-.5)*slot,y:Math.max(14,y-8),'text-anchor':'middle',class:'bar-yoy'},pct(row.yoy_pct)));
    }
    svg.append(el('text',{x:450,y:302,'text-anchor':'middle',class:'axis-label'},'月份（1–12）｜柱上標示 YoY'));
  }
  function drawLines(svg, rows, years, onPick){
    svg.replaceChildren();svg.setAttribute('viewBox','0 0 900 330');
    const left=58,right=24,top=25,bottom=52,w=900-left-right,h=330-top-bottom;
    for(let m=1;m<=12;m++){const x=left+(m-1)*w/11;svg.append(el('line',{x1:x,y1:top,x2:x,y2:top+h,class:'gridline'}));svg.append(el('text',{x,y:top+h+24,'text-anchor':'middle',class:'axis-label'},String(m)));}
    [0,.25,.5,.75,1].forEach(f=>{const y=top+h*f;svg.append(el('line',{x1:left,y1:y,x2:left+w,y2:y,class:'gridline'}));});
    const valid=rows.filter(r=>r.net_weight_tons!=null && Number.isFinite(Number(r.net_weight_tons)));
    if(!valid.length){svg.append(el('text',{x:450,y:148,'text-anchor':'middle',class:'chart-empty'},'尚無可驗證的五年度月度資料；缺值不補零、不連線'));return;}
    const max=Math.max(...valid.map(r=>Number(r.net_weight_tons)))*1.12;
    years.forEach((year,idx)=>{
      const pts=rows.filter(r=>Number(r.year)===year && r.net_weight_tons!=null).sort((a,b)=>a.month-b.month);
      let path='';let previous=null;
      pts.forEach(r=>{const x=left+(r.month-1)*w/11,y=top+h-(Number(r.net_weight_tons)/max*h);if(!previous || r.month!==previous.month+1)path+=` M ${x} ${y}`;else path+=` L ${x} ${y}`;previous=r;});
      if(path)svg.append(el('path',{d:path,class:`line-series line-${idx}`}));
      pts.forEach(r=>{const x=left+(r.month-1)*w/11,y=top+h-(Number(r.net_weight_tons)/max*h);const c=el('circle',{cx:x,cy:y,r:5,class:`line-point point-${idx}`,tabindex:0,role:'button','aria-label':`${year} 年 ${r.month} 月 ${fmt(r.net_weight_tons)} 公噸`});c.addEventListener('click',()=>onPick(r));c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(r);}});svg.append(c);});
    });
  }
  function init(){
    const root=$('commodity-dashboard');if(!root)return;
    fetch('../data/processed/step6_chart_data.json').then(r=>r.json()).then(data=>{
      const product=$('grain-product'), route=$('grain-route');
      if(product && route){
      const detail=$('brazil-detail'), monthlySvg=$('brazil-monthly-chart'), fiveSvg=$('brazil-fiveyear-chart');
      const updateBrazil=()=>{
        const p=product.value, rt=route.value;
        const rows=data.brazil_monthly.filter(r=>r.commodity===p&&r.route===rt);
        const knownYears=data.brazil_five_year.filter(r=>r.commodity===p&&r.route===rt).map(r=>Number(r.year));const latestYear=knownYears.length?Math.max(...knownYears):null;const years=latestYear===null?[]:Array.from({length:5},(_,i)=>latestYear-4+i);
        drawBars(monthlySvg,rows,r=>showDetail(r));drawLines(fiveSvg,data.brazil_five_year.filter(r=>r.commodity===p&&r.route===rt),years,r=>showDetail(r));
        $('brazil-chart-status').textContent=data.brazil_status.reason;
        $('brazil-year-label').textContent=years.length?`年度：${years.join('、')}`:'最新資料年度尚未確認，五年度序列尚未建立';
        $('brazil-source-link').href=data.brazil_status.source_url;
        $('brazil-source-name').textContent=data.brazil_status.source;
        $('brazil-detail-table').innerHTML='<tr><td colspan="6" class="empty-cell">尚無可查閱的月度明細。取得原始數列後，將保留每月精確噸數與 MoM／YoY。</td></tr>';
      };
      function showDetail(r){detail.innerHTML=`<strong>${escapeHtml(r.year)}-${String(r.month).padStart(2,'0')}</strong>｜出口量：${fmt(r.net_weight_tons)} 公噸｜MoM：${pct(r.mom_pct)}｜YoY：${pct(r.yoy_pct)}`;}
      product.addEventListener('change',updateBrazil);route.addEventListener('change',updateBrazil);updateBrazil();
      const weekly=data.grain_us_weekly;
      const renderWeekly=()=>{
        const selected=$('fgis-product').value;const r=weekly.find(x=>x.commodity===selected);if(!r)return;
        $('fgis-value').textContent=`${fmt(r.value_mt)} 公噸`;$('fgis-period').textContent=`週結束 ${r.period}｜發布 ${r.publication_date}`;
        $('fgis-wow').textContent=pct(r.wow_pct);$('fgis-yoy').textContent=pct(r.yoy_pct);
        $('fgis-previous').textContent=`前週 ${r.previous_period}：${fmt(r.previous_mt)} 公噸`;
        $('fgis-prior-year').textContent=`去年可比週 ${r.prior_year_period}：${fmt(r.prior_year_mt)} 公噸`;
        $('fgis-notes').textContent=r.notes;$('fgis-source').href=r.source_url;
        $('fgis-table-body').innerHTML=weekly.map(x=>`<tr><td>${x.label}</td><td>${x.period}</td><td>${fmt(x.value_mt)}</td><td>${pct(x.wow_pct)}</td><td>${pct(x.yoy_pct)}</td><td>${x.publication_date}</td></tr>`).join('');
      };
      $('fgis-product').addEventListener('change',()=>{if(product)product.value=$('fgis-product').value;renderWeekly();if(product)updateBrazil();});
      if(product)product.addEventListener('change',()=>{$('fgis-product').value=product.value;renderWeekly();});
      renderWeekly();
      }
      const iron=data.iron_ore;
      if($('iron-au-table')){
      $('iron-au-table').innerHTML=iron.australia_quantity_changes.map(r=>`<tr><td>${r.commodity}</td><td>${r.period}</td><td>${pct(r.mom_pct)}</td><td>${pct(r.yoy_pct)}</td><td>${r.publication_date}</td><td><a href="${r.source_url}" target="_blank" rel="noopener">${r.source}</a></td></tr>`).join('');
      $('iron-pig-table').innerHTML=iron.pig_iron.map(r=>`<tr><td>${r.period}</td><td>${fmt(r.output_10k_tons)}</td><td>${pct(r.mom_pct)}</td><td>${pct(r.yoy_pct)}</td><td>${r.publication_date}</td><td><a href="${r.source_url}" target="_blank" rel="noopener">中國國家統計局</a></td></tr>`).join('');
      $('iron-brazil-status').textContent=data.brazil_status.reason;$('iron-china-status').textContent='尚未取得可核實的中國海關 HS 2601 月度原始資料；因此不繪製進口噸數序列。';
      const scope=$('iron-brazil-scope');
      if(scope){
        const updateIronBrazil=()=>{
          const rt=scope.value, rows=iron.brazil_exports.filter(r=>r.route===rt), knownYears=rows.map(r=>Number(r.year)), latestYear=knownYears.length?Math.max(...knownYears):null, years=latestYear===null?[]:Array.from({length:5},(_,i)=>latestYear-4+i);
          drawBars($('iron-brazil-monthly-chart'),rows,r=>{$('iron-brazil-detail').textContent=`${r.year}-${String(r.month).padStart(2,'0')}｜出口量 ${fmt(r.net_weight_tons)} 公噸｜MoM ${pct(r.mom_pct)}｜YoY ${pct(r.yoy_pct)}`;});
          drawLines($('iron-brazil-fiveyear-chart'),iron.brazil_exports.filter(r=>r.route===rt),years,r=>{$('iron-brazil-detail').textContent=`${r.year}-${String(r.month).padStart(2,'0')}｜出口量 ${fmt(r.net_weight_tons)} 公噸｜MoM ${pct(r.mom_pct)}｜YoY ${pct(r.yoy_pct)}`;});
          $('iron-brazil-state').textContent=rt==='global'?'全球出口：尚無資料':'運往中國出口：尚無資料';$('iron-brazil-years').textContent=years.length?`年度：${years.join('、')}`:'最新資料年度尚未確認，五年度序列尚未建立';
          $('iron-brazil-rows').innerHTML='<tr><td colspan="6" class="empty-cell">尚無可查閱月度資料；來源核實後保留精確值。</td></tr>';
        };
        scope.addEventListener('change',updateIronBrazil);updateIronBrazil();
      }
      }
    }).catch(()=>{const s=$('brazil-chart-status');if(s)s.textContent='圖表資料檔讀取失敗；請透過本機 HTTP 伺服器開啟網站。';});
  }
  document.addEventListener('DOMContentLoaded',init);
})();
