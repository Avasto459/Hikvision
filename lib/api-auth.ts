import { getBearerToken, verifyToken } from "@/lib/auth";
import { isPrimaryAdminEmail } from "@/lib/jwt-secret";
import { findFallbackAdminByEmail, findMemoryUserByEmail, getUserById, StoreError, type UserRole } from "@/lib/db";

export async function requireUser(request: Request) {
  const cookieHeader=request.headers.get("cookie")||"";
  const cookieToken=/(?:^|;\s*)hasi-session=([^;]+)/.exec(cookieHeader)?.[1]||null;
  const bearer=getBearerToken(request.headers.get("authorization"));
  const token=bearer||(cookieToken?decodeURIComponent(cookieToken):null);
  if(!token)throw new StoreError("Необходим вход в аккаунт.",401);
  try{
    const user=verifyToken(token);
    let currentUser=await getUserById(user.id);
    if(!currentUser&&user.id.startsWith("fallback-")&&user.role==="ADMIN") currentUser=await findFallbackAdminByEmail(user.email);
    if(!currentUser&&user.role==="ADMIN"&&isPrimaryAdminEmail(user.email))return {id:user.id,email:user.email.toLowerCase(),role:"ADMIN" as UserRole};
    if(!currentUser&&user.email)currentUser=await findMemoryUserByEmail(user.email);
    if(!currentUser)throw new StoreError("Сессия недействительна.",401);
    if(isPrimaryAdminEmail(currentUser.email))currentUser.role="ADMIN";
    if(currentUser.isBlocked)throw new StoreError("Учётная запись заблокирована. Свяжитесь с магазином.",403);
    return {id:currentUser.id,email:currentUser.email,role:currentUser.role as UserRole};
  }catch(e){if(e instanceof StoreError)throw e;throw new StoreError("Сессия недействительна.",401)}
}
export async function requireAdmin(request:Request){const user=await requireUser(request);if(user.role!=="ADMIN")throw new StoreError("Недостаточно прав.",403);return user}
