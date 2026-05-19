/*
  Warnings:

  - You are about to drop the column `description` on the `Business` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[whatsappBusinessPhone]` on the table `Business` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Business" DROP COLUMN "description",
ADD COLUMN     "whatsappAccessToken" TEXT,
ADD COLUMN     "whatsappBusinessPhone" TEXT,
ADD COLUMN     "whatsappIsActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappPhoneNumberId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "whatsappMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Business_whatsappBusinessPhone_key" ON "Business"("whatsappBusinessPhone");
