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

/** Strip SSL URL options that would override the separately verified TLS config.
 * node-postgres warns that sslmode/sslrootcert/sslkey/sslcert in a connection
 * string replace the explicit ssl object. Keep other connection parameters. */
export function postgresConnectionString(connectionString){
 // Validate before removing any SSL parameter.
 postgresTLS(connectionString);
 const parsed=new URL(connectionString);
 for(const option of ['sslmode','sslcert','sslkey','sslrootcert','ssl','uselibpqcompat']){
  parsed.searchParams.delete(option);
 }
 return parsed.toString();
}
