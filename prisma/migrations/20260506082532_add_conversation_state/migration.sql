-- CreateTable
CREATE TABLE "ConversationState" (
    "id" SERIAL NOT NULL,
    "userPhone" TEXT NOT NULL,
    "businessId" INTEGER NOT NULL,
    "step" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);
