-- Add email verification columns to User
ALTER TABLE "User"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationTokenHash" TEXT,
ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3);

CREATE INDEX "User_emailVerifiedAt_idx" ON "User"("emailVerifiedAt");
