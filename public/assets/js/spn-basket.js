(()=>{var M=`/* The basket drawer. Same language as the rest of the site: near-black
   panel, hairline rules, mono for anything that is a specification.

   It mounts on the static sub-sites too, and those carry their own
   smaller token sets \u2014 /websites/ has no --purple-light or --font-mono at
   all, and a different --panel. So every colour here goes through a local
   --bk-* alias with a fallback: the page's token wins where it exists,
   and the drawer still looks like itself where it does not. */
.spn-basket, .basket-button{
  --bk-bg: var(--bg, #030207);
  --bk-panel: var(--panel, #0b0811);
  --bk-text: var(--text, #f5f2fb);
  --bk-muted: var(--muted, rgba(245,242,251,.58));
  --bk-quiet: var(--quiet, rgba(245,242,251,.48));
  --bk-line: var(--line, rgba(255,255,255,.14));
  --bk-accent: var(--purple-light, #c6a7ff);
  --bk-mono: var(--font-mono, "IBM Plex Mono", "Courier New", monospace);
  --bk-ease: var(--ease-signal, cubic-bezier(.22,.75,.25,1));
  --bk-ease-depth: var(--ease-depth, cubic-bezier(.16,.84,.2,1));
  --bk-space: var(--space-md, 1.5rem);
  --bk-space-sm: var(--space-sm, 1rem);
}
.spn-basket{ position: fixed; inset: 0; z-index: 90; }
.spn-basket[hidden]{ display: none; }
.spn-basket__scrim{
  position: absolute; inset: 0;
  background: rgba(3,2,7,.72); backdrop-filter: blur(6px);
  animation: spnBasketFade .3s var(--bk-ease) both;
}
.spn-basket__panel{
  position: absolute; top: 0; right: 0; bottom: 0;
  width: min(440px, 100%);
  display: flex; flex-direction: column;
  background: var(--bk-panel); border-left: 1px solid var(--bk-line);
  animation: spnBasketIn .42s var(--bk-ease-depth) both;
  overflow: hidden;
}
@keyframes spnBasketFade{ from{ opacity: 0; } }
@keyframes spnBasketIn{ from{ transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce){
  .spn-basket__scrim, .spn-basket__panel{ animation: none; }
}

.spn-basket__head{
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--bk-space); border-bottom: 1px solid var(--bk-line);
}
.spn-basket__label{
  margin: 0; font-family: var(--bk-mono); font-size: 10px;
  letter-spacing: .2em; text-transform: uppercase; color: var(--bk-accent);
}
.spn-basket__close{
  width: 32px; height: 32px; display: grid; place-items: center;
  background: transparent; border: 1px solid var(--bk-line); color: var(--bk-text); font-size: 18px;
}
.spn-basket__close:hover{ border-color: var(--bk-accent); }

.spn-basket__list{ flex: 1; overflow-y: auto; overscroll-behavior: contain; }
.spn-basket__empty{
  flex: 1; display: grid; place-items: center; margin: 0;
  color: var(--bk-quiet); font-size: 14px;
}
.spn-basket__empty[hidden]{ display: none; }

.spn-basket__line{
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "name price" "meta price" "qty actions";
  gap: 4px var(--bk-space-sm); align-items: center;
  padding: var(--bk-space); border-bottom: 1px solid var(--bk-line);
}
.spn-basket__name{ grid-area: name; margin: 0; font-size: 14px; letter-spacing: -.01em; }
.spn-basket__meta{ grid-area: meta; margin: 0; font-size: 11px; color: var(--bk-quiet); }
.spn-basket__price{
  grid-area: price; margin: 0; font-size: 16px; white-space: nowrap;
  font-variant-numeric: tabular-nums; align-self: start;
}
.spn-basket__qty{ grid-area: qty; display: flex; align-items: center; gap: 2px; margin-top: 8px; }
.spn-basket__qty button{
  width: 28px; height: 28px; background: transparent; border: 1px solid var(--bk-line);
  color: var(--bk-text); font-size: 14px; line-height: 1;
}
.spn-basket__qty button:hover{ border-color: var(--bk-accent); }
.spn-basket__qty span{
  min-width: 34px; text-align: center; font-family: var(--bk-mono);
  font-size: 12px; font-variant-numeric: tabular-nums;
}
.spn-basket__actions{
  grid-area: actions; display: flex; gap: var(--bk-space-sm);
  justify-self: end; margin-top: 8px;
}
.spn-basket__express, .spn-basket__remove{
  background: transparent; border: 0; padding: 0;
  font-family: var(--bk-mono); font-size: 9px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--bk-muted);
}
.spn-basket__express[aria-pressed="true"]{ color: var(--bk-accent); }
.spn-basket__express:hover, .spn-basket__remove:hover{ color: var(--bk-text); }

.spn-basket__foot{ padding: var(--bk-space); border-top: 1px solid var(--bk-line); }
.spn-basket__foot[hidden]{ display: none; }
.spn-basket__sums{ margin: 0 0 var(--bk-space-sm); }
.spn-basket__sums div{
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 4px 0; font-size: 13px; color: var(--bk-muted);
}
.spn-basket__sums div[hidden]{ display: none; }
.spn-basket__sums dt, .spn-basket__sums dd{ margin: 0; }
.spn-basket__sums dd{ font-variant-numeric: tabular-nums; }
.spn-basket__sums .is-total{
  margin-top: 6px; padding-top: 10px; border-top: 1px solid var(--bk-line);
  font-size: 17px; color: var(--bk-text);
}
.spn-basket__note{ margin: 0 0 var(--bk-space-sm); font-size: 11px; color: var(--bk-quiet); }
.spn-basket__checkout{
  display: block; text-align: center; padding: 15px;
  background: var(--bk-text); color: #050308; font-size: 13px; letter-spacing: .04em;
  transition: background .25s;
}
.spn-basket__checkout:hover{ background: #fff; }

/* the header count */
.basket-button{
  position: relative; display: inline-flex; align-items: center; gap: 8px;
  background: transparent; border: 1px solid var(--bk-line); padding: 10px 16px;
  font-size: 12px; letter-spacing: .04em; color: inherit;
  transition: border-color .25s, background .25s;
}
.basket-button:hover{ border-color: var(--bk-accent); background: rgba(198,167,255,.06); }
.basket-button__count{
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
  display: grid; place-items: center;
  background: var(--bk-accent); color: #14091f;
  font-family: var(--bk-mono); font-size: 10px; font-variant-numeric: tabular-nums;
}
.basket-button__count[hidden]{ display: none; }

html.basket-open{ overflow: hidden; }

@media (max-width: 460px){
  .spn-basket__panel{ width: 100%; }
  .spn-basket__line{ padding: var(--bk-space-sm) var(--bk-space); }
}
`;var te=e=>Math.round(e*100),f=e=>Math.round(e*100)/100;function S(e,s){if(!e||typeof e.price!="number")return null;let t=Math.max(1,Math.min(99,Math.floor(Number(s.qty)||1))),n=f(e.price*t),a=s.express===!0?f(n*.4):0;return{qty:t,base:n,express:a,total:f(n+a)}}function B(e,s){let t=[],n=[];for(let i of Array.isArray(s)?s:[]){let c=e?.[i?.sku];if(!c||c.quoteOnly){n.push(i?.sku??null);continue}let d=S(c,i);if(!d){n.push(i.sku);continue}t.push({sku:i.sku,label:c.label,unit:c.price,express:i.express===!0,recurring:c.recurring||null,...d})}let a=f(t.reduce((i,c)=>i+c.base,0)),o=f(t.reduce((i,c)=>i+c.express,0)),p=f(a+o);return{currency:"eur",lines:t,rejected:n,base:a,express:o,total:p,totalCents:te(p),count:t.reduce((i,c)=>i+c.qty,0)}}var C="spn_basket_v1",y="spn:basket";var F=()=>window.SPN_CONFIG?.checkout?.items||{},u=e=>F()[e]||null;function se(){let e=null;try{e=localStorage.getItem(C)}catch{return[]}if(!e)return[];let s;try{s=JSON.parse(e)}catch{return[]}return Array.isArray(s)?s.filter(t=>t&&typeof t.sku=="string"&&u(t.sku)&&!u(t.sku).quoteOnly).map(t=>({sku:t.sku,qty:h(t.qty),express:t.express===!0})).filter((t,n,a)=>a.findIndex(o=>l(o)===l(t))===n).slice(0,40):[]}function g(e){try{localStorage.setItem(C,JSON.stringify(e))}catch{}L=e,re()}var h=e=>{let s=Math.floor(Number(e));return Number.isFinite(s)&&s>0?Math.min(s,99):1},l=e=>`${e.sku}::${e.express?"x":"n"}`,L=null,b=()=>L??=se(),ne=()=>{L=null};function ae(e){let s=u(e.sku);return s?S(s,e):null}function m(e=b()){let{base:s,express:t,total:n,count:a}=B(F(),e);return{base:s,express:t,total:n,count:a}}var E=()=>b().map(e=>({...e,price:ae(e),item:u(e.sku)})),P=()=>m().count;function U(e,{qty:s=1,express:t=!1}={}){let n=u(e);if(!n||n.quoteOnly)return!1;let a=[...b()],o={sku:e,qty:h(s),express:t===!0},p=a.findIndex(i=>l(i)===l(o));return p>=0?a[p]={...a[p],qty:h(a[p].qty+o.qty)}:a.push(o),g(a),!0}function Y(e,s,t){let n=l({sku:e,express:s}),a=Math.floor(Number(t));if(Number.isFinite(a)&&a<=0)return N(e,s);g(b().map(o=>l(o)===n?{...o,qty:h(t)}:o))}function $(e,s,t){let n=l({sku:e,express:s}),a=b().find(c=>l(c)===n);if(!a)return;let o=b().filter(c=>l(c)!==n),p={...a,express:t===!0},i=o.findIndex(c=>l(c)===l(p));i>=0?o[i]={...o[i],qty:h(o[i].qty+p.qty)}:o.push(p),g(o)}var N=(e,s)=>g(b().filter(t=>l(t)!==l({sku:e,express:s})));function re(){window.dispatchEvent(new CustomEvent(y,{detail:{count:P(),totals:m()}}))}var D=e=>(window.addEventListener(y,e),window.addEventListener("storage",s=>{s.key===C&&(ne(),e(new CustomEvent(y,{detail:{count:P(),totals:m()}})))}),()=>window.removeEventListener(y,e));var ie=()=>(window.SPN_CONFIG?.checkout?.apiBase||"").replace(/\/$/,""),ce=()=>!!ie(),x=e=>new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR"}).format(e),v=(e,s)=>{if(typeof window.gtag=="function")try{window.gtag("event",e,s)}catch{}},T=e=>e.map(s=>({item_id:s.sku,item_name:s.item?.label||s.sku,price:s.price?.total??0,quantity:s.qty,item_variant:s.express?"express":"standard"})),r,w,X=[],G,H,Q,j,J;function pe(){r=document.createElement("aside"),r.className="spn-basket",r.id="spnBasket",r.hidden=!0,r.setAttribute("role","dialog"),r.setAttribute("aria-modal","true"),r.setAttribute("aria-label","Your basket"),r.innerHTML=`
    <div class="spn-basket__scrim" data-basket-close></div>
    <div class="spn-basket__panel" data-lenis-prevent>
      <header class="spn-basket__head">
        <p class="spn-basket__label">Your basket</p>
        <button type="button" class="spn-basket__close" data-basket-close aria-label="Close basket">&times;</button>
      </header>
      <div class="spn-basket__list" data-basket-list></div>
      <p class="spn-basket__empty" data-basket-empty>Nothing here yet.</p>
      <footer class="spn-basket__foot">
        <dl class="spn-basket__sums">
          <div data-basket-base-row><dt>Subtotal</dt><dd data-basket-base></dd></div>
          <div data-basket-express-row hidden><dt>Express (+40%)</dt><dd data-basket-express></dd></div>
          <div class="is-total"><dt>Total</dt><dd data-basket-total></dd></div>
        </dl>
        <p class="spn-basket__note">Delivery 3&ndash;5 days, or 24&ndash;48h on express. VAT shown at checkout.</p>
        <a class="spn-basket__checkout" href="/checkout/" data-basket-checkout>Checkout</a>
      </footer>
    </div>`,document.body.appendChild(r),w=r.querySelector("[data-basket-list]"),J=r.querySelector("[data-basket-empty]"),G=r.querySelector("[data-basket-total]"),H=r.querySelector("[data-basket-base]"),Q=r.querySelector("[data-basket-express]"),j=r.querySelector("[data-basket-checkout]"),r.addEventListener("click",e=>{e.target.closest("[data-basket-close]")&&z()}),j.addEventListener("click",()=>{let e=m();v("begin_checkout",{currency:"EUR",value:e.total,items:T(E())})})}function R(){let e=E(),s=m();if(X.forEach(t=>{t.textContent=String(s.count),t.hidden=s.count===0}),!!w){w.innerHTML="",J.hidden=e.length>0,r.querySelector(".spn-basket__foot").hidden=e.length===0;for(let t of e){let n=document.createElement("div");n.className="spn-basket__line";let a=document.createElement("p");a.className="spn-basket__name",a.textContent=t.item.label;let o=document.createElement("p");o.className="spn-basket__meta",o.textContent=t.express?`Express \xB7 ${x(t.item.price)} + 40% each`:`${x(t.item.price)} each`;let p=document.createElement("div");p.className="spn-basket__qty";for(let[q,Z]of[[-1,"Decrease quantity"],[1,"Increase quantity"]]){let k=document.createElement("button");if(k.type="button",k.textContent=q<0?"\u2212":"+",k.setAttribute("aria-label",`${Z} of ${t.item.label}`),k.addEventListener("click",()=>Y(t.sku,t.express,t.qty+q)),q<0)p.appendChild(k);else{let O=document.createElement("span");O.textContent=String(t.qty),p.appendChild(O),p.appendChild(k)}}let i=document.createElement("p");i.className="spn-basket__price",i.textContent=x(t.price.total);let c=document.createElement("div");c.className="spn-basket__actions";let d=document.createElement("button");d.type="button",d.className="spn-basket__express",d.setAttribute("aria-pressed",String(t.express)),d.textContent=t.express?"Express on":"Add express",d.addEventListener("click",()=>{$(t.sku,t.express,!t.express),t.express||v("spn_express_selected",{item_id:t.sku})});let _=document.createElement("button");_.type="button",_.className="spn-basket__remove",_.textContent="Remove",_.addEventListener("click",()=>{v("remove_from_cart",{currency:"EUR",value:t.price.total,items:T([t])}),N(t.sku,t.express)}),c.append(d,_),n.append(a,o,p,i,c),w.appendChild(n)}H.textContent=x(s.base),Q.textContent=x(s.express),r.querySelector("[data-basket-express-row]").hidden=s.express===0,G.textContent=x(s.total)}}var I=null;function A(){if(!r)return;I=document.activeElement,r.hidden=!1,document.documentElement.classList.add("basket-open"),window.SPN_SCROLL?.stop?.(),r.querySelector(".spn-basket__close")?.focus();let e=m();v("view_cart",{currency:"EUR",value:e.total,items:T(E())})}function z(){r&&(r.hidden=!0,document.documentElement.classList.remove("basket-open"),window.SPN_SCROLL?.start?.(),I instanceof HTMLElement&&I.focus())}function K(){return ce()?(pe(),document.querySelectorAll("[data-basket-control]").forEach(e=>{e.hidden=!1}),X=Array.from(document.querySelectorAll("[data-basket-count]")),document.querySelectorAll("[data-basket-open]").forEach(e=>e.addEventListener("click",s=>{s.preventDefault(),A()})),document.addEventListener("click",e=>{let s=e.target.closest?.("[data-buy]");if(!s)return;let t=s.dataset.buy;if(!t||!u(t))return;e.preventDefault(),e.stopImmediatePropagation(),U(t,{qty:1});let n=u(t);v("add_to_cart",{currency:"EUR",value:n.price,items:[{item_id:t,item_name:n.label,price:n.price,quantity:1}]}),A()},!0),document.addEventListener("keydown",e=>{e.key==="Escape"&&!r.hidden&&z()}),D(R),R(),{open:A,close:z,render:R}):null}var V="spn-basket-style";function le(){if(document.getElementById(V))return;let e=document.createElement("style");e.id=V,e.textContent=M,document.head.appendChild(e)}function W(){le(),K()}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",W,{once:!0}):W();})();
