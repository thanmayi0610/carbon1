import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { prismaClient } from "./prisma";

const app = new Hono();

app.get("/students", async (context) => {
  try {
    const students = await prismaClient.student.findMany({
      select: {
        id: true,
        name: true,
        dateofbirth: true,
        aadharNumber: true,
        proctorId: true,
        libraryMembership: {
          select: {
            id: true, // Fetch the library membership ID
          },
        },
      },
    });

    // Transform the response to include `libraryMembershipId` directly
    const formattedStudents = students.map((Student: { id: string; name: string; dateofbirth: Date; aadharNumber: string; proctorId: string; libraryMembership: { id: string } | null }) => ({
      ...Student,
      libraryMembershipId: Student.libraryMembership ? Student.libraryMembership.id : null,
      libraryMembership: undefined, // Remove the nested object
    }));

    return context.json(formattedStudents, 200);
  } catch (e) {
    return context.json({ error: "Server Issue" }, 500);
  }
});

//1
app.get("/students", async (context) => {
  try {
    const students = await prismaClient.student.findMany();
    return context.json(students, 200);
  } catch (e) {
    return context.json({ error: "Server Issue" }, 500);
  }
});
//2
app.get("/students/enriched", async (context) => {
  try {
    const students = await prismaClient.student.findMany({
      include: { 
        proctor: true,
        libraryMembership: true
      }
    });

    // Manually set `libraryMembershipId` from the relationship
    const enrichedStudents = students.map(Student => ({
      ...Student,
      libraryMembershipId: Student.libraryMembership ? Student.libraryMembership.id : null
    }));

    return context.json(enrichedStudents, 200);
  } catch (e) {
    return context.json({ error: "Server Issue" }, 500);
  }
});

//3
app.get("/professors", async (context) => {
  try {
    const professors = await prismaClient.professor.findMany();
    return context.json(professors, 200);
  } catch (e) {
    return context.json({ error: "Server Issue" }, 500);
  }
});
//4
app.post("/students", async (context) => {
  try {
    const { name, dateofbirth, aadharNumber, proctorId, libraryMembership } = await context.req.json();

    // Check if student already exists based on aadharNumber
    const existingStudent = await prismaClient.student.findUnique({
      where: { aadharNumber },
    });

    if (existingStudent) {
      return context.json({ error: "Student already exists" }, 400);
    }

    // Creating new student (LibraryMembership is optional)
    const newStudent = await prismaClient.student.create({
      data: {
        name,
        dateofbirth: new Date(dateofbirth),
        aadharNumber,
        proctor: {
          connect: { id: proctorId }, // Ensure proctorId is correctly assigned
        },
        libraryMembership: libraryMembership
          ? {
              create: {
                issueDate: new Date(libraryMembership.issueDate),
                expiryDate: new Date(libraryMembership.expiryDate),
              },
            }
          : undefined, // Do not add libraryMembership if not provided
      },
      include: {
        proctor: true,
        libraryMembership: true, // Include related data in response
      },
    });

    return context.json(newStudent, 201);
  } catch (e) {
    console.error(e); // Log error for debugging
    return context.json({ error: "Server Issue" }, 500);
  }
});
//5
app.post("/professors", async (context) => {
  try {
    const { name, seniority, aadharNumber } = await context.req.json();

    // Check if a professor with the same aadharNumber already exists
    const existingProfessor = await prismaClient.professor.findUnique({
      where: { aadharNumber },
    });

    if (existingProfessor) {
      return context.json({ error: "Professor already exists" }, 400);
    }

    // Create new professor
    const newProfessor = await prismaClient.professor.create({
      data: { name, seniority, aadharNumber },
    });

    return context.json(newProfessor, 201);
  } catch (e) {
    return context.json({ error: "Server Issue" }, 500);
  }
});

//6
app.get('/professors/:professorId/proctorships', async (c) => {
  try {
    const professorId = c.req.param('professorId');

    const professor = await prismaClient.professor.findUnique({
      where: { id: professorId },
      include: { students: true }, 
      });

    if (!professor) {
      return c.json({ error: "Professor not found" }, 404);
    }

    return c.json({ 
      professor: {
        id: professor.id,
        name: professor.name,
        seniority: professor.seniority
      },
      students: professor.students
    });
  } catch (error) {
    console.error("Error fetching proctorship details:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

serve(app, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
