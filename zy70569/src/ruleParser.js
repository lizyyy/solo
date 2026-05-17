export function parseCacheRules(r) {
  const p = {query:{include:[],exclude:[],all:0},cookies:{include:[],exclude:[],all:0},headers:{include:[],exclude:[],all:0},host:1,scheme:1,path:1};
  if(r.query){if(r.query==="all")p.query.all=1;else if(r.query==="none")p.query.include=[];else if(Array.isArray(r.query.include))p.query.include=r.query.include;else if(Array.isArray(r.query.exclude))p.query.exclude=r.query.exclude;}
  if(r.cookies){if(r.cookies==="all")p.cookies.all=1;else if(r.cookies==="none")p.cookies.include=[];else if(Array.isArray(r.cookies.include))p.cookies.include=r.cookies.include;else if(Array.isArray(r.cookies.exclude))p.cookies.exclude=r.cookies.exclude;}
  if(r.headers){if(r.headers==="all")p.headers.all=1;else if(r.headers==="none")p.headers.include=[];else if(Array.isArray(r.headers.include))p.headers.include=r.headers.include.map(h=>h.toLowerCase());else if(Array.isArray(r.headers.exclude))p.headers.exclude=r.headers.exclude.map(h=>h.toLowerCase());}
  return p;
}
