import type { StaticImageData } from "next/image";
import ownerImage from "@/assets/images/owner.png";
import adminImage from "@/assets/images/admin.png";
import horseImage from "@/assets/images/horse.png";
import userImage from "@/assets/images/user.png";
import type { Role } from "./roles";

/** Default profile images when `customers.avatar_url` is not set. */
const ROLE_DEFAULT_AVATARS: Partial<Record<Role, StaticImageData>> = {
  owner: ownerImage,
  admin: adminImage,
  moderator: horseImage,
  member: userImage,
};

/** 未ログイン時のチャット等で使う管理者デフォルト画像 URL（public 配信）。 */
export function getAdminDefaultAvatarUrl(): string {
  return "/avatars/admin.png";
}

/**
 * Returns the uploaded avatar URL when present; otherwise the role default image.
 */
export function resolveAvatarUrl(
  role: Role,
  avatarUrl: string | null | undefined,
): string | null {
  if (avatarUrl?.trim()) return avatarUrl;
  return ROLE_DEFAULT_AVATARS[role]?.src ?? null;
}
