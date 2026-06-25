/*
  Warnings:

  - You are about to drop the column `tags` on the `KnowledgeBase` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `KnowledgeBase` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "KnowledgeBase" DROP COLUMN "tags",
DROP COLUMN "updatedAt";
