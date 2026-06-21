"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/statuses";

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum([UserRole.PLAYER, UserRole.ORGANIZER, UserRole.ADMIN])
});

const clubSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(2),
  hourlyCourtPrice: z.string().regex(/^\d+(\.\d{1,2})?$/)
});

const clubUpdateSchema = clubSchema.extend({
  clubId: z.string().min(1)
});

export async function updateUserRoleAction(formData: FormData) {
  await requireAdmin();
  const result = roleSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect("/admin/users?error=role");
  const input = result.data;

  await prisma.user.update({
    where: { id: input.userId },
    data: { role: input.role }
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?saved=role");
}

const activationSchema = z.object({
  userId: z.string().min(1),
  active: z.enum(["true", "false"])
});

export async function setUserActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const result = activationSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect("/admin/users?error=activation");
  const { userId, active } = result.data;
  const deactivate = active === "false";

  if (deactivate && userId === admin.id) redirect("/admin/users?error=self-deactivate");

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
      if (!user) throw new Error("not-found");

      if (deactivate && user.role === UserRole.ADMIN) {
        const activeAdmins = await tx.user.count({
          where: { role: UserRole.ADMIN, deactivatedAt: null, id: { not: userId } }
        });
        if (activeAdmins === 0) throw new Error("last-admin");
      }

      await tx.user.update({
        where: { id: userId },
        data: { deactivatedAt: deactivate ? new Date() : null }
      });
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "activation";
    redirect(`/admin/users?error=${code === "last-admin" || code === "not-found" ? code : "activation"}`);
  }

  revalidatePath("/admin/users");
  redirect(`/admin/users?saved=${deactivate ? "deactivated" : "reactivated"}`);
}

export async function createClubAction(formData: FormData) {
  await requireAdmin();
  const result = clubSchema.safeParse(normalizeForm(Object.fromEntries(formData)));
  if (!result.success) redirect("/admin/clubs?error=club");
  const input = result.data;

  await prisma.club.create({
    data: input
  });

  revalidatePath("/admin/clubs");
  revalidatePath("/organizer/games/new");
  redirect("/admin/clubs?saved=created");
}

export async function updateClubAction(formData: FormData) {
  await requireAdmin();
  const result = clubUpdateSchema.safeParse(normalizeForm(Object.fromEntries(formData)));
  if (!result.success) redirect("/admin/clubs?error=club");
  const input = result.data;
  const { clubId, ...data } = input;

  await prisma.club.update({
    where: { id: clubId },
    data
  });

  revalidatePath("/admin/clubs");
  revalidatePath("/organizer/games/new");
  redirect("/admin/clubs?saved=updated");
}

export async function deleteClubAction(formData: FormData) {
  await requireAdmin();
  const clubId = z.string().min(1).parse(formData.get("clubId"));

  await prisma.club.update({
    where: { id: clubId },
    data: { deletedAt: new Date() }
  });

  revalidatePath("/admin/clubs");
  revalidatePath("/organizer/games/new");
  redirect("/admin/clubs?saved=deleted");
}

function normalizeForm(input: Record<string, FormDataEntryValue>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (typeof value !== "string") return [key, value];
      return [key, value.trim()];
    })
  );
}
