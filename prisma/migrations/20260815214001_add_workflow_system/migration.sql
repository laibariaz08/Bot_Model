/*
  Warnings:

  - You are about to drop the column `currentMenu` on the `workflow_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `currentState` on the `workflow_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `workflow_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `previousState` on the `workflow_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `selectedBrandId` on the `workflow_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `selectedCategoryId` on the `workflow_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `selectedProductId` on the `workflow_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `selectedSubCategoryId` on the `workflow_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `workflowName` on the `workflow_sessions` table. All the data in the column will be lost.
  - Added the required column `workflowId` to the `workflow_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workflowSnapshot` to the `workflow_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workflowVersion` to the `workflow_sessions` table without a default value. This is not possible if the table is not empty.
  - Made the column `context` on table `workflow_sessions` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowTriggerType" AS ENUM ('KEYWORD', 'NEW_CONVERSATION', 'BUTTON_CLICK', 'MANUAL', 'WEBHOOK', 'CONTACT_EVENT');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'WAITING_INPUT', 'COMPLETED', 'FAILED', 'HANDED_OVER');

-- DropIndex
DROP INDEX "workflow_sessions_chatId_key";

-- DropIndex
DROP INDEX "workflow_sessions_currentState_idx";

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "messageType" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "workflow_sessions" DROP COLUMN "currentMenu",
DROP COLUMN "currentState",
DROP COLUMN "isActive",
DROP COLUMN "previousState",
DROP COLUMN "selectedBrandId",
DROP COLUMN "selectedCategoryId",
DROP COLUMN "selectedProductId",
DROP COLUMN "selectedSubCategoryId",
DROP COLUMN "workflowName",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "currentNodeId" TEXT,
ADD COLUMN     "history" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "variables" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "workflowId" TEXT NOT NULL,
ADD COLUMN     "workflowSnapshot" JSONB NOT NULL,
ADD COLUMN     "workflowVersion" INTEGER NOT NULL,
ALTER COLUMN "context" SET NOT NULL,
ALTER COLUMN "context" SET DEFAULT '{}';

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerType" "WorkflowTriggerType" NOT NULL,
    "triggerConfig" JSONB,
    "variables" JSONB,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateCategory" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_logs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_businessId_status_idx" ON "workflows"("businessId", "status");

-- CreateIndex
CREATE INDEX "workflows_isTemplate_templateCategory_idx" ON "workflows"("isTemplate", "templateCategory");

-- CreateIndex
CREATE INDEX "workflow_logs_sessionId_createdAt_idx" ON "workflow_logs"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "workflow_sessions_chatId_status_idx" ON "workflow_sessions"("chatId", "status");

-- CreateIndex
CREATE INDEX "workflow_sessions_workflowId_idx" ON "workflow_sessions"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_sessions_status_lastActivityAt_idx" ON "workflow_sessions"("status", "lastActivityAt");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_sessions" ADD CONSTRAINT "workflow_sessions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_logs" ADD CONSTRAINT "workflow_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workflow_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
