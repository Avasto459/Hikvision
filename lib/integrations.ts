import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getSetting, setSetting } from "@/lib/db";
import { getJwtSecret } from "@/lib/jwt-secret";

export type IntegrationGroup="email"|"sms"|"telegram";
export const integrationFields:Record<IntegrationGroup,string[]>={email:["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASSWORD","SMTP_FROM","SMTP_SECURE"],sms:["SMS_PROVIDER","SMS_API_KEY","SMS_API_SECRET","SMS_SENDER"],telegram:["TELEGRAM_BOT_TOKEN","TELEGRAM_CHAT_ID"]};
export type IntegrationKey=typeof integrationFields[IntegrationGroup][number];
const secretKeys=new Set(["SMTP_PASSWORD","SMS_API_SECRET","TELEGRAM_BOT_TOKEN"]);
const cache=new Map<string,string>();
const settingName=(k:string)=>`integration.${k}`;
function key(){return createHash("sha256").update(`hasi-integrations:${getJwtSecret()}`).digest()}
function encrypt(v:string){const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",key(),iv);const d=Buffer.concat([c.update(v,"utf8"),c.final()]);return `enc:${Buffer.concat([iv,c.getAuthTag(),d]).toString("base64")}`}
function decrypt(v:string){try{const r=Buffer.from(v.slice(4),"base64"),d=createDecipheriv("aes-256-gcm",key(),r.subarray(0,12));d.setAuthTag(r.subarray(12,28));return Buffer.concat([d.update(r.subarray(28)),d.final()]).toString("utf8")}catch{return ""}}
const isSecretKey=(k:string)=>secretKeys.has(k);
export function getIntegrationValue(keyName:string):string{return cache.get(keyName)||(process.env[keyName]||"").trim()}
export async function loadIntegrationValue(keyName:string){const env=getIntegrationValue(keyName);if(env)return env;const stored=await getSetting(settingName(keyName));if(!stored)return "";const value=isSecretKey(keyName)?decrypt(stored):stored;cache.set(keyName,value);return value}
export async function saveIntegrationValues(group:IntegrationGroup,values:Record<string,string|undefined>){for(const k of integrationFields[group]){const incoming=values[k];if(incoming===undefined)continue;const v=String(incoming).trim();if(isSecretKey(k)&&!v)continue;if(v.length>500)throw new Error(`Значение ${k} слишком длинное.`);cache.set(k,v);await setSetting(settingName(k),isSecretKey(k)?encrypt(v):v)}}
export async function clearIntegration(group:IntegrationGroup){for(const k of integrationFields[group]){cache.delete(k);await setSetting(settingName(k),"")}}
export function describeIntegration(group:IntegrationGroup){return integrationFields[group].map(k=>{const v=getIntegrationValue(k);return isSecretKey(k)?{key:k,secret:true,isSet:v!=="",value:""}:{key:k,secret:false,isSet:v!=="",value:v}})}
