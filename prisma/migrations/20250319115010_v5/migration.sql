/*
  Warnings:

  - Changed the type of `dateofbirth` on the `Student` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Student" DROP COLUMN "dateofbirth",
ADD COLUMN     "dateofbirth" TIMESTAMP(3) NOT NULL;
