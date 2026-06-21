import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase-admin";

export const avatarBucket = "avatars";
export const maxAvatarSize = 2 * 1024 * 1024;

const allowedAvatarTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

type AvatarFile = Pick<File, "arrayBuffer" | "size" | "type">;

type RuntimeAvatarFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  size: number;
  type: string;
};

export class AvatarUploadError extends Error {
  constructor(public readonly code: "config" | "type" | "size" | "upload") {
    super(code);
  }
}

export function isAvatarFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object"
    && value !== null
    && value instanceof Blob
    && typeof (value as RuntimeAvatarFile).arrayBuffer === "function"
    && value.size > 0;
}

export async function uploadUserAvatar(userId: string, file: AvatarFile, previousPath?: string | null) {
  if (!hasSupabaseAdminConfig()) throw new AvatarUploadError("config");
  if (file.size > maxAvatarSize) throw new AvatarUploadError("size");

  const extension = allowedAvatarTypes.get(file.type);
  if (!extension) throw new AvatarUploadError("type");

  const supabase = createSupabaseAdminClient();
  const path = `users/${userId}/avatar-${Date.now()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(avatarBucket).upload(path, bytes, {
    contentType: file.type,
    upsert: false
  });

  if (error) throw new AvatarUploadError("upload");

  if (previousPath?.startsWith(`users/${userId}/`)) {
    await supabase.storage.from(avatarBucket).remove([previousPath]);
  }

  const { data } = supabase.storage.from(avatarBucket).getPublicUrl(path);
  return {
    avatarPath: path,
    photoUrl: data.publicUrl
  };
}
