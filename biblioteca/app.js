import {normalize,features,subtypeOf,hasFeature,readableTitle,briefDescription,searchScore} from "./taxonomy.js";
import {icon} from "./icons.js";
import {thumbnail,clearThumbnailObservers,createPdfViewer} from "./pdf-view.js";
import {queueDownload,openDownloads} from "./downloads.js";
const $=id=>document.getElementById(id),config=window.LIBRARY_CONFIG;
let catalog=[],mode="all",session=null,offset=0,toastTimer,currentDetailId=null;
let pdfViewer=null;
for(const node of document.querySelectorAll("[data-icon]"))node.append(icon(node.dataset.icon));
$("downloadsButton").addEventListener("click",openDownloads);
$("catalog").replaceChildren(...Array.from({length:4},()=>el("div",undefined,"skeleton-row")));
let storedFavorites=[];try{const value=JSON.parse(localStorage.getItem("dc_favorites")||"[]");if(Array.isArray(value))storedFavorites=value;}catch{}
const favorites=new Set(storedFavorites);
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function button(text,handler,className=""){const node=el("button",text,className);node.type="button";node.addEventListener("click",handler);return node;}
function toast(text){const node=$("toast");(document.querySelector("dialog[open]")||document.body).append(node);node.textContent=text;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,6500);}
async function api(path,method="GET",body){
 const headers={apikey:config.key,"Content-Type":"application/json"};if(session?.access_token)headers.Authorization="Bearer "+session.access_token;
 const response=await fetch(config.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{data=null;}
 if(!response.ok)throw new Error(data?.message||data?.msg||"No se pudo completar la solicitud ("+response.status+").");return data;
}
function filesOf(detail){return(detail.document_files||[]).filter(file=>/\.(pdf|dwg|dxf)$/i.test(file.file_name)&&(!file.source_file_id||file.preview_ready));}
function fileUrl(file){return config.url+"/storage/v1/object/public/detalles-constructivos/"+file.storage_path.split("/").map(encodeURIComponent).join("/");}
const extension=file=>file.file_name.split(".").pop().toUpperCase();
const size=file=>Number(file.size_bytes)>0?(Number(file.size_bytes)<1048576?Math.max(1,Math.round(Number(file.size_bytes)/1024))+" KB":(Number(file.size_bytes)/1048576).toFixed(1)+" MB"):"";
function detailUrl(detail){const url=new URL(location.href);url.search="";url.hash="";url.searchParams.set("plano",detail.id);return url.href;}
async function copyLink(detail){try{await navigator.clipboard.writeText(detailUrl(detail));toast("Enlace copiado. Ábrelo en tu PC o envíalo por mensaje.");}catch{const field=el("input");field.value=detailUrl(detail);field.readOnly=true;field.setAttribute("aria-label","Enlace de este plano");$("detailContent").append(field);field.select();toast("Selecciona y copia este enlace.");}}
function options(node,values){const selected=node.value;node.replaceChildren(...values.map(value=>{const option=el("option",value);option.value=value;return option;}));if(values.includes(selected))node.value=selected;}
function setFilterOptions(){
 options($("category"),["Todos",...[...new Set(catalog.map(d=>d.category?.name||"Otros"))].sort((a,b)=>a.localeCompare(b,"es"))]);
 const list=catalog.filter(d=>$("category").value==="Todos"||d.category?.name===$("category").value);
 options($("subtype"),["Todos",...[...new Set(list.map(subtypeOf))].filter(v=>v!=="Sin especificar").sort((a,b)=>a.localeCompare(b,"es"))]);
 $("typeField").hidden=$("category").value==="Todos"||$("subtype").options.length<2;
 const typed=list.filter(d=>$("subtype").value==="Todos"||subtypeOf(d)===$("subtype").value);
 options($("feature"),["Todas",...features.filter(f=>typed.some(d=>hasFeature(d,f)))]);
}
function renderCategories(){
 options($("mobileCategory"),[...$("category").options].map(o=>o.value));$("mobileCategory").value=$("category").value;$("mobileCategory").options[0].textContent="Todos los planos";
 $("categoryChips").replaceChildren();
 for(const option of $("category").options){const value=option.value,count=catalog.filter(d=>(mode!=="saved"||favorites.has(d.id))&&(value==="Todos"||d.category?.name===value)).length;
  if(value!=="Todos"&&!count)continue;
  const chip=button("",()=>{$("category").value=value;$("subtype").value="Todos";$("feature").value="Todas";setFilterOptions();render();},"category-chip");
  chip.append(icon(value==="Todos"?"grid":value),el("span",value==="Todos"?"Todos los planos":value,"category-label"),el("span",String(count),"category-count"));chip.setAttribute("aria-pressed",String(value===$("category").value));$("categoryChips").append(chip);
 }
}
function currentRows(){return catalog.map(detail=>({detail,score:searchScore(detail,$("search").value)})).filter(({detail,score})=>
 (mode!=="saved"||favorites.has(detail.id))&&score>=0&&
 ($("category").value==="Todos"||detail.category?.name===$("category").value)&&
 ($("subtype").value==="Todos"||subtypeOf(detail)===$("subtype").value)&&
 ($("feature").value==="Todas"||hasFeature(detail,$("feature").value))&&
 ($("format").value==="Todos"||filesOf(detail).some(f=>extension(f)===$("format").value))&&
 ($("availability").value==="Todas"||($("availability").value==="Lista")===filesOf(detail).some(f=>extension(f)==="PDF")))
 .sort((a,b)=>b.score-a.score).map(row=>row.detail);
}
function resetFilters(){for(const [id,value]of Object.entries({search:"",category:"Todos",subtype:"Todos",feature:"Todas",format:"Todos",availability:"Todas"}))$(id).value=value;setFilterOptions();render();}
function favoriteButton(detail){const active=favorites.has(detail.id),node=button("",()=>{
 favorites.has(detail.id)?favorites.delete(detail.id):favorites.add(detail.id);try{localStorage.setItem("dc_favorites",JSON.stringify([...favorites]));}catch{toast("El navegador no permite guardar favoritos de forma permanente.");}render();node.setAttribute("aria-pressed",String(favorites.has(detail.id)));node.setAttribute("aria-label",(favorites.has(detail.id)?"Quitar de favoritos: ":"Añadir a favoritos: ")+readableTitle(detail.title));
 },"favorite-button");node.append(icon("bookmark"));node.setAttribute("aria-pressed",String(active));node.title=active?"Quitar de favoritos":"Añadir a favoritos";node.setAttribute("aria-label",(active?"Quitar de favoritos: ":"Añadir a favoritos: ")+readableTitle(detail.title));return node;}
function downloadButton(file,label,className="primary"){const node=button(label,()=>download(file,node),className);node.setAttribute("aria-label",label+": "+file.file_name);return node;}
function render(){
 const rows=currentRows();$("resultCount").textContent=rows.length+(rows.length===1?" plano":" planos");$("catalog").replaceChildren();clearThumbnailObservers();renderCategories();renderSuggestions();
 $("readyOnly").setAttribute("aria-pressed",String($("availability").value==="Lista"));
 const active=[$("subtype").value!=="Todos",$("feature").value!=="Todas",$("format").value!=="Todos",$("availability").value!=="Todas"].filter(Boolean).length;
 $("moreFilters").replaceChildren(icon("filter"),document.createTextNode(($("extraFilters").hidden?"Más filtros":"Menos filtros")+(active?" · "+active:"")));
 $("clearFilters").hidden=!active&&$("category").value==="Todos"&&!$("search").value;
 if(!rows.length){const empty=el("div",undefined,"empty");empty.append(el("h3",mode==="saved"&&!favorites.size?"Todavía no tienes favoritos":"No encontramos ese plano"),el("p",mode==="saved"&&!favorites.size?"Marca un plano con la estrella para encontrarlo aquí.":"Prueba con una palabra como zapata o viga, o quita los filtros."),button("Ver todos los planos",()=>{switchMode("all");resetFilters();},"primary"));$("catalog").append(empty);}
 for(const detail of rows){
  const files=filesOf(detail),original=files.find(f=>/^(DWG|DXF)$/.test(extension(f))),pdf=files.find(f=>extension(f)==="PDF");
  const row=el("article",undefined,"plan-row");
  const preview=button("",()=>openDetail(detail),"thumbnail");preview.setAttribute("aria-label","Abrir "+readableTitle(detail.title));const placeholder=el("span",undefined,"thumbnail-placeholder");placeholder.append(icon("file"),el("span",pdf?"Cargando vista…":"Sin vista PDF","thumbnail-text"));preview.append(placeholder);row.append(preview);
  const info=el("div",undefined,"plan-info");info.append(el("span",detail.category?.name||"Otros","card-label"));const heading=el("h3");heading.append(button(readableTitle(detail.title),()=>openDetail(detail),"title-button"));info.append(heading);
  const meta=el("p",undefined,"file-meta");if(original)meta.append(el("span",extension(original)+(size(original)?" · "+size(original):"")));meta.append(el("span",pdf?"PDF disponible":"Vista PDF pendiente"));info.append(meta);const type=subtypeOf(detail);if(type!=="Sin especificar"){const line=el("p",undefined,"plan-type");line.append(icon("file"),el("span",type));info.append(line);}row.append(info);
  const actions=el("div",undefined,"row-actions");actions.append(favoriteButton(detail));actions.append(button(pdf?"Ver PDF":"Ver ficha",()=>openDetail(detail),"view-button"));if(original||pdf){const file=original||pdf;actions.append(downloadButton(file,"Descargar "+extension(file),"secondary"));}row.append(actions);$("catalog").append(row);if(pdf)thumbnail(preview,pdf,fileUrl(pdf));
 }
 $("catalog").setAttribute("aria-busy","false");

}
async function loadCatalog(append=false){
 $("connection").textContent="Actualizando biblioteca…";$("connection").dataset.state="loading";$("refresh").disabled=true;
 try{const rows=await api("/rest/v1/details?select="+encodeURIComponent("*,category:categories(name),document_files(*)")+"&status=eq.published&order=published_at.desc,id.asc&limit=500&offset="+(append?offset:0));catalog=append?[...catalog,...rows]:rows;offset=catalog.length;$("loadMore").hidden=rows.length<500;setFilterOptions();render();$("connection").textContent=catalog.length+" planos disponibles";$("connection").dataset.state="online";await resolveDetailLink();}
 catch(error){$("connection").textContent="No se pudo actualizar. Comprueba la conexión y pulsa Actualizar.";$("connection").dataset.state="error";if(!catalog.length){$("catalog").replaceChildren(el("p","No se pudo cargar la biblioteca. Vuelve a intentarlo.","empty"));$("catalog").setAttribute("aria-busy","false");}}finally{$("refresh").disabled=false;}
}
function download(file){if(Number(file.size_bytes)>100*1024*1024){const url=new URL(fileUrl(file));url.searchParams.set("download",file.file_name);window.open(url.href,"_blank","noopener");toast("La descarga directa se abrirá en el navegador.");return;}queueDownload(file,fileUrl(file),toast);}
function showPdf(file){pdfViewer?.dispose();$("detailContent").querySelector(".pdf-viewer")?.remove();pdfViewer=createPdfViewer(file,fileUrl(file));const anchor=$("detailContent").querySelector(".download-panel");anchor.after(pdfViewer.node);}
function openDetail(detail,updateUrl=true){
 pdfViewer?.dispose();pdfViewer=null;currentDetailId=detail.id;if(updateUrl&&new URL(location.href).searchParams.get("plano")!==detail.id)history.pushState({dcDetail:true},"",detailUrl(detail));
 $("detailTitle").textContent=readableTitle(detail.title);$("detailDialog").querySelector(".dialog-favorite")?.remove();const star=favoriteButton(detail);star.classList.add("dialog-favorite");$("detailFavorite").replaceChildren(star);const content=$("detailContent");content.replaceChildren();
 const files=filesOf(detail),original=files.find(f=>/^(DWG|DXF)$/.test(extension(f))),pdf=files.find(f=>extension(f)==="PDF");
 content.append(el("p",(detail.category?.name||"Otros")+" · Revisión "+(detail.content_version||1),"detail-meta"));
 const primary=el("div",undefined,"download-panel");
 const mainActions=el("div",undefined,"actions");if(original||pdf){const file=original||pdf;mainActions.append(downloadButton(file,"Descargar "+extension(file),"secondary"));}mainActions.append(button("Copiar enlace",()=>copyLink(detail)));primary.append(mainActions);content.append(primary);
 const description=el("p",briefDescription(detail),"description");if(detail.engineer_name)content.append(el("p","Responsable indicado: "+detail.engineer_name,"small"));
 const filesHeading=el("h3","Archivos del plano");filesHeading.style.marginTop="20px";content.append(filesHeading);
 for(const file of files){const row=el("div",undefined,"file-row"),name=el("div",undefined,"file-name");name.append(el("strong",file.source_file_id?"Vista de consulta":extension(file)==="PDF"?file.file_name:"Original CAD"),el("div",[extension(file),size(file)].filter(Boolean).join(" · "),"small"));row.append(name);
  if(extension(file)==="PDF"&&files.filter(f=>extension(f)==="PDF").length>1)row.append(button("Ver lámina",()=>showPdf(file)));
  row.append(downloadButton(file,"Descargar "+extension(file),""));
  if(session?.isStaff&&/^(DWG|DXF)$/.test(extension(file))&&!files.some(f=>f.source_file_id===file.id))row.append(button("Preparar vista",async()=>{try{const result=await api("/functions/v1/prepare-preview","POST",{file_id:file.id});toast(result.message);}catch(error){toast(error.message);}}));content.append(row);
 }
 content.append(description);
 if(!files.length)content.append(el("p","Este detalle todavía no tiene archivos disponibles."));
 if(original&&!pdf)content.append(el("p","El original ya se puede descargar. La vista para el celular sigue pendiente de preparación.","small"));
 const actions=el("div",undefined,"actions detail-secondary");actions.append(button("Historial de cambios",async()=>{try{const revisions=await api("/rest/v1/detail_revisions?select=version,created_at,change_summary,author_label&detail_id=eq."+detail.id+"&order=version.desc&limit=30");const section=el("section");section.append(el("h3","Historial"));for(const row of revisions)section.append(el("div","v"+row.version+" · "+new Date(row.created_at).toLocaleString("es")+" · "+row.change_summary,"revision"));if(!revisions.length)section.append(el("p","Todavía no hay cambios registrados."));content.querySelector(".history")?.remove();section.className="history";content.append(section);}catch(error){toast(error.message);}}));
 const phone=detail.engineer_phone||config.engineerPhone;if(phone)actions.append(button("Consultar al ingeniero",()=>window.open("https://wa.me/"+phone.replace(/\D/g,"")+"?text="+encodeURIComponent("Hola, quisiera consultar sobre "+readableTitle(detail.title)+" · "+detail.reference_code+".\n"+detailUrl(detail)),"_blank","noopener")));actions.append(button("Reportar problema",()=>window.open("https://wa.me/59173447992?text="+encodeURIComponent("Hola, quiero reportar un problema con "+readableTitle(detail.title)+".\n"+detailUrl(detail)),"_blank","noopener")));content.append(actions);
 if(!$("detailDialog").open)$("detailDialog").showModal();$("detailDialog").scrollTop=0;if(pdf)showPdf(pdf);
}
async function resolveDetailLink(){const id=new URL(location.href).searchParams.get("plano");if(!id){if($("detailDialog").open)$("detailDialog").close();return;}
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){toast("El enlace del plano no es válido. Puedes buscarlo en la biblioteca.");return;}
 let detail=catalog.find(d=>d.id===id);if(!detail){try{const rows=await api("/rest/v1/details?select="+encodeURIComponent("*,category:categories(name),document_files(*)")+"&status=eq.published&id=eq."+encodeURIComponent(id));detail=rows[0];}catch{toast("No se pudo abrir el plano del enlace. Comprueba la conexión.");return;}}
 if(new URL(location.href).searchParams.get("plano")!==id)return;
 if(detail)openDetail(detail,false);else toast("Este plano ya no está disponible. Puedes buscar otro en la biblioteca.");
}
function switchMode(next){mode=next;$("pageTitle").textContent=next==="saved"?"Tus planos favoritos":"Planos constructivos";$("explore").classList.toggle("active",next==="all");$("saved").classList.toggle("active",next==="saved");$("explore").setAttribute("aria-current",next==="all"?"page":"false");$("saved").setAttribute("aria-current",next==="saved"?"page":"false");render();}
function renderSuggestions(){const query=$("search").value;const target=$("suggestions");target.replaceChildren();if(query.trim().length<2){target.hidden=true;return;}
 const labels=[...new Set([...catalog.map(d=>d.category?.name),...catalog.map(subtypeOf),...catalog.map(d=>readableTitle(d.title))])].filter(v=>v&&v!=="Sin especificar");const text=normalize(query);function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next[j+1]=Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1));row=next;}return row[b.length];}const matches=labels.filter(label=>normalize(label)!==text&&(normalize(label).includes(text)||(text.length>=4&&normalize(label).split(" ").some(word=>distance(word.replace(/s$/,""),text.replace(/s$/,""))<=1)))).sort((a,b)=>Number(!normalize(a).includes(text))-Number(!normalize(b).includes(text))||a.length-b.length).slice(0,4);for(const label of matches)target.append(button(label,()=>{resetFilters();$("search").value=label;render();}));target.hidden=!matches.length;}
$("mobileCategory").addEventListener("change",()=>{$("category").value=$("mobileCategory").value;$("subtype").value="Todos";$("feature").value="Todas";setFilterOptions();render();});
$("saved").textContent="Favoritos";
$("loginForm").addEventListener("submit",async event=>{event.preventDefault();event.submitter.disabled=true;try{session=await api("/auth/v1/token?grant_type=password","POST",{email:$("email").value.trim(),password:$("password").value});const roles=await api("/rest/v1/profiles?select=role&user_id=eq."+session.user.id);session.isStaff=roles.some(r=>["admin","editor"].includes(r.role));if(!session.isStaff)throw new Error("Esta entrada es solo para el equipo autorizado.");$("password").value="";$("accountDialog").close();$("account").textContent="Cerrar sesión";if(currentDetailId){const detail=catalog.find(d=>d.id===currentDetailId);if(detail)openDetail(detail,false);}toast("Sesión iniciada.");}catch(error){session=null;$("loginStatus").textContent=error.message;}finally{event.submitter.disabled=false;}});
$("account").addEventListener("click",()=>{if(session){session=null;$("account").textContent="Equipo";if(currentDetailId){const detail=catalog.find(d=>d.id===currentDetailId);if(detail)openDetail(detail,false);}toast("Sesión cerrada.");}else $("accountDialog").showModal();});
$("explore").addEventListener("click",()=>switchMode("all"));$("saved").addEventListener("click",()=>switchMode("saved"));$("refresh").addEventListener("click",()=>loadCatalog());$("loadMore").addEventListener("click",()=>loadCatalog(true));
for(const id of ["search","category","subtype","feature","format","availability"])$(id).addEventListener(id==="search"?"input":"change",()=>{if(id==="category"){$("subtype").value="Todos";$("feature").value="Todas";}if(id==="category"||id==="subtype")setFilterOptions();render();});
$("readyOnly").addEventListener("click",()=>{$("availability").value=$("availability").value==="Lista"?"Todas":"Lista";render();});
$("moreFilters").addEventListener("click",()=>{$("extraFilters").hidden=!$("extraFilters").hidden;$("moreFilters").setAttribute("aria-expanded",String(!$("extraFilters").hidden));render();});
$("clearFilters").addEventListener("click",resetFilters);
document.querySelectorAll("[data-close]").forEach(node=>node.addEventListener("click",()=>node.closest("dialog").close()));
$("detailDialog").addEventListener("close",()=>{if(new URL(location.href).searchParams.get("plano")===currentDetailId){const url=new URL(location.href);url.searchParams.delete("plano");history.replaceState(null,"",url);}currentDetailId=null;pdfViewer?.dispose();pdfViewer=null;$("detailContent").replaceChildren();if($("toast").parentElement!==document.body){document.body.append($("toast"));$("toast").hidden=true;}});
window.addEventListener("popstate",()=>resolveDetailLink());
loadCatalog();
