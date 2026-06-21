-- Add Telegram identity fields to User
ALTER TABLE "User" ADD COLUMN "telegramId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramPhotoUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "preferredLang" TEXT;

CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
