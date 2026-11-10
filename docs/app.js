const $ = id => document.getElementById(id);
const money = n => Number.isFinite(Number(n)) ? `${Number(n).toLocaleString('fr-FR', {maximumFractionDigits: 2})} €` : '—';
const pct = n => Number.isFinite(n) ? `${(100*n).toFixed(1).replace('.', ',')} %` : '—';
const colors = {you:'#5eead4',random_trader:'#93c5fd',random_buyer:'#fbbf24',random_seller:'#f9a8d4'};
const labels = {you:'Votre trader',random_trader:'Trader aléatoire',random_buyer:'Acheteur aléatoire',random_seller:'Vendeur aléatoire'};
const fetchJson = async url => {const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${response.status} pour ${url}`);return response.json()};
const text = (id,value) => {$(id).textContent=value};
function drawChart(snapshots){
  const canvas=$('chart'), ratio=window.devicePixelRatio||1, width=canvas.clientWidth, height=320;
  canvas.width=width*ratio;canvas.height=height*ratio;
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.clearRect(0,0,width,height);
  const series={you:snapshots.map(s=>Number(s.total_value))};
  for(const key of ['random_trader','random_buyer','random_seller'])series[key]=snapshots.map(s=>Number(s.baselines?.[key]));
  const all=Object.values(series).flat().filter(Number.isFinite);
  if(!all.length)return;
  let min=Math.min(...all),max=Math.max(...all);const pad=Math.max((max-min)*.12,1);min-=pad;max+=pad;
  const left=67,right=15,top=15,bottom=30,iw=width-left-right,ih=height-top-bottom;
  ctx.font='12px system-ui';ctx.fillStyle='#9fb0c7';ctx.strokeStyle='#30435e';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=top+ih*i/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();ctx.fillText(Math.round(max-(max-min)*i/4).toLocaleString('fr-FR'),4,y+4)}
  ctx.fillText(`Tour ${snapshots[0].tick}`,left,height-5);ctx.fillText(`Tour ${snapshots.at(-1).tick}`,Math.max(left,width-90),height-5);
  for(const [key,values] of Object.entries(series)){
    ctx.strokeStyle=colors[key];ctx.lineWidth=key==='you'?3:2;ctx.beginPath();let started=false;
    values.forEach((value,i)=>{if(!Number.isFinite(value))return;const x=left+(snapshots.length===1?iw/2:i*iw/(snapshots.length-1));const y=top+(max-value)*ih/(max-min);if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)});ctx.stroke();
  }
}
function drawProducts(market,snapshot){
  const history=market.history,box=$('products');box.replaceChildren();
  for(const p of market.products){
    const prices=history.map(row=>Number(row[p]));const fast=prices.length>=5?prices.slice(-5).reduce((a,b)=>a+b,0)/5:NaN;
    const slow=prices.length>=20?prices.slice(-20).reduce((a,b)=>a+b,0)/20:NaN;
    const signal=Number(snapshot?.decisions?.[p]?.signal||0),className=signal>0?'buy':signal<0?'sell':'hold';
    const el=document.createElement('div');el.className='product';
    const left=document.createElement('div');const title=document.createElement('b');title.textContent=`Produit ${p} · ${money(prices.at(-1))}`;
    const detail=document.createElement('small');detail.textContent=`Moy. 5 : ${money(fast)} · Moy. 20 : ${money(slow)}`;
    left.append(title,detail);const right=document.createElement('div');right.className=`signal ${className}`;
    right.textContent=`${signal>0?'Acheter':signal<0?'Vendre':'Conserver'} ${Math.round(Math.abs(signal)*100)} unités`;
    el.append(left,right);box.append(el);
  }
}
function drawLog(snapshots){const body=$('log');body.replaceChildren();
  for(const s of snapshots.slice(-8).reverse())for(const [p,d] of Object.entries(s.decisions||{})){
    const tr=document.createElement('tr');const signal=Number(d.signal||0);
    for(const value of [s.tick,new Date(s.timestamp).toLocaleString('fr-FR'),p,`${signal>0?'Acheter':signal<0?'Vendre':'Conserver'} ${Math.round(Math.abs(signal)*100)} unités`,d.reason||'—']){
      const td=document.createElement('td');td.textContent=value;tr.append(td);
    }body.append(tr);
  }
  if(!body.children.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='Le journal commencera après la première exécution de l’algorithme.';tr.append(td);body.append(tr)}
}
async function load(){
  try{
    const config=await fetchJson('config.json');
    const [market,leaderboard,snapshots]=await Promise.all([
      fetchJson(config.market_url||'https://raw.githubusercontent.com/exofri/ensim-trade-center/refs/heads/main/docs/data/market.json'),
      fetchJson(config.leaderboard_url||'https://raw.githubusercontent.com/exofri/ensim-trade-center/refs/heads/main/docs/data/leaderboard.json'),fetchJson('performance.json')]);
    if(!config.trader_id){text('status','Inscription à terminer : renseigner trader_id dans config.json après avoir donné l’URL de decision.json à l’organisateur.');drawProducts(market,null);drawLog([]);return}
    const base=config.organizer_base_url.replace(/\/$/,'');
    const holdings=await fetchJson(`${base}/traders/${encodeURIComponent(config.trader_id)}/holdings.json`);
    const prices=market.history.at(-1),value=Number(holdings.money)+market.products.reduce((sum,p)=>sum+Number(holdings.products[p]||0)*Number(prices[p]),0);
    const refs=leaderboard.leaderboard.filter(x=>['random_trader','random_buyer','random_seller'].includes(x.id));
    const best=refs.reduce((a,b)=>Number(a.total_value)>Number(b.total_value)?a:b);
    text('value',money(value));text('cash',`Trésorerie ${money(holdings.money)}`);
    text('gap',money(value-Number(best.total_value)));text('leader',`Face à ${labels[best.id]}`);
    text('tick',String(prices.t));text('updated',new Date(prices.timestamp).toLocaleString('fr-FR'));
    const vals=snapshots.map(s=>Number(s.total_value)).filter(Number.isFinite);let peak=-Infinity,maxDD=0,currentDD=0;
    for(const v of vals){peak=Math.max(peak,v);currentDD=peak>0?(peak-v)/peak:0;maxDD=Math.max(maxDD,currentDD)}
    text('drawdown',pct(maxDD));text('current-drawdown',pct(currentDD));text('samples',String(vals.length));
    drawProducts(market,snapshots.at(-1));drawLog(snapshots);drawChart(snapshots);
    const legend=$('legend');legend.replaceChildren();for(const [key,color] of Object.entries(colors)){const item=document.createElement('span'),dot=document.createElement('i');dot.style.background=color;item.append(dot,labels[key]);legend.append(item)}
    text('chart-note',snapshots.length<2?'La courbe apparaîtra après deux tours enregistrés. Les valeurs actuelles figurent ci-dessus.':'Historique enregistré depuis la première exécution de l’algorithme.');
    text('status',`Données du marché : tour ${prices.t}. Valeur actuelle recalculée avec les derniers prix ; journal mis à jour par GitHub Actions.`);
    window.addEventListener('resize',()=>drawChart(snapshots));
  }catch(error){text('status',`Impossible de charger les données : ${error.message}`)}
}
load();
