export const normalize = text => String(text ?? "").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase();
const terms=text=>normalize(text).split(/[^a-z0-9]+/).filter(term=>term&&!new Set(["de","del","la","las","el","los","un","una","para","en","y","plano","planos","estructural"]).has(term));
const root=term=>term.length>5&&term.endsWith("es")&&!term.endsWith("les")?term.slice(0,-2):term.length>3&&term.endsWith("s")?term.slice(0,-1):term;
const matches=(candidate,word)=>/^\d+$/.test(word)?candidate===word:root(candidate).startsWith(root(word));
export function searchScore(detail,query){
 const category=detail.category?.name||"",aliases=["Zapatas","Losa radier","Pilotes"].includes(category)?"cimentacion fundacion":category==="Núcleo de ascensor"?"ascensor elevador":"";
 const title=terms([readableTitle(detail.title),category,subtypeOf(detail)].join(" "));
 const all=terms([detail.title,detail.reference_code,category,detail.description,...(detail.tags||[]),...(detail.document_files||[]).map(f=>f.file_name),aliases].join(" "));
 const words=terms(query);if(words.some(word=>!all.some(candidate=>matches(candidate,word))))return -1;
 return words.reduce((score,word)=>score+(title.some(candidate=>root(candidate)===root(word))?4:1),0);
}
export const features=["Unión con columna","Encuentro viga-columna","Anclaje","Refuerzo","Confinamiento","Estribos","Junta","Sección","Planta","Corte","Hormigón armado","Acero"];
export function subtypeOf(detail) {
  const explicit=(detail.tags||[]).find(tag=>/^tipo:/i.test(tag));
  if(explicit)return explicit.split(":").slice(1).join(":").trim();
  const text=normalize(detail.title+" "+(detail.document_files||[]).map(f=>f.file_name).join(" "));
  const category=detail.category?.name;
  if(category==="Zapatas") {
    if(text.includes("aislad"))return "Aisladas";
    if(text.includes("combinad"))return "Combinadas";
    if(text.includes("corrid"))return "Corridas";
  }
  if(category==="Vigas") {
    if(text.includes("arriostre"))return "Arriostre y equilibrio";
    if(text.includes("descolgada"))return "Descolgadas";
    if(text.includes("plana"))return "Planas";
  }
  if(category==="Escaleras") {
    if(text.includes("rampa"))return "Rampa";
    if(text.includes("escalera"))return "Escalera";
  }
  for(const [keyword,value] of [["maciza","Macizas"],["aligerad","Aligeradas"],["rectangular","Rectangulares"],["circular","Circulares"]])if(text.includes(keyword))return value;
  return ["Detalle típico","Sección y armado","Planta y corte","Encuentro","Anclaje"].includes(detail.subtitle)?detail.subtitle:"Sin especificar";
}
export function hasFeature(detail,feature) {return(detail.tags||[]).some(tag=>normalize(tag.includes(":")?tag.split(":").slice(1).join(":").trim():tag)===normalize(feature));}
export function readableTitle(raw) {
  if(!/^PLANO ESTRUCTURAL /i.test(raw||"")&&!/\.(dwg|dxf|pdf)$/i.test(raw||"")&&!(raw===raw?.toLocaleUpperCase("es")&&/^(MURO|N[ÚU]CLE[OÓ]|VIGA|ESCALERA|LOSA|TINGLADO)/i.test(raw)))return raw||"Detalle constructivo";
  const lowerWords=new Set(["de","del","la","las","el","los","y","en"]);
  return raw.replace(/^PLANO\s+ESTRUCTURAL\s+/i,"").replace(/^NUCLEÓ DE ASCENSOR/i,"Núcleo de ascensor").replace(/\.(dwg|dxf|pdf)$/i,"").trim().toLocaleLowerCase("es").split(/\s+/).map((word,index)=>index>0&&lowerWords.has(word)?word:word.charAt(0).toLocaleUpperCase("es")+word.slice(1)).join(" ");
}
export function briefDescription(detail) {
  const text=normalize(detail.description);
  if(text&&!text.includes("pendientes de completar")&&!text.includes("descripcion pendiente"))return detail.description;
  const type=subtypeOf(detail),category=detail.category?.name||"Otros";
  const subject=category==="Zapatas"&&type==="Aisladas"?"Zapata aislada":category==="Zapatas"&&type==="Corridas"?"Zapata corrida":"Plano de "+category.toLocaleLowerCase("es");
  const formats=[...new Set((detail.document_files||[]).filter(f=>/\.(dwg|dxf)$/i.test(f.file_name)).map(f=>f.file_name.split(".").pop().toUpperCase()))];
  return subject+"."+(formats.length?" Original en "+formats.join(" y ")+" para trabajar en CAD.":"");
}
