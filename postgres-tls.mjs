// Shared PostgreSQL TLS settings for THE EVENING WIRE recovery branch.
// TLS encryption alone is insufficient: authenticate the server certificate.
export function postgresTLS(connectionString){
 const parsed=new URL(connectionString);
 const host=parsed.hostname.toLowerCase();
 const local=['localhost','127.0.0.1','::1','[::1]'].includes(host);
 const mode=(parsed.searchParams.get('sslmode')||'').toLowerCase();
 if(['disable','allow','prefer','no-verify'].includes(mode)){
  throw new Error('Database SSL configuration is insecure; configure a verified TLS connection');
 }
 if(local&&process.env.NODE_ENV!=='production')return false;
 const configuredCA=process.env.PG_CA_CERT||process.env.POSTGRES_CA_CERT||'';
 const ca=configuredCA.replace(/\\n/g,'\n');
 return ca?{rejectUnauthorized:true,ca}:{rejectUnauthorized:true};
}
