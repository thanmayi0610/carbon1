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
//7. Update student details
app.patch('/students/:studentId', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const data = await c.req.json(); 
    const existingStudent = await prismaClient.student.findUnique({
      where: { id: studentId },
    });

    if (!existingStudent) {
      return c.json({ error: "Student not found" }, 404);
    }
      const updatedStudent = await prismaClient.student.update({
      where: { id: studentId },
      data, 
    });

    return c.json({ message: "Student updated successfully", student: updatedStudent });
  } catch (error) {
    console.error("Error updating student:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});


//8.Update professor details
app.patch('/professors/:professorId', async (c) => {
  try {
    const professorId = c.req.param('professorId');
    const data = await c.req.json(); 
      const existingProfessor = await prismaClient.professor.findUnique({
      where: { id: professorId },
    });

    if (!existingProfessor) {
      return c.json({ error: "Professor not found" }, 404);
    }
      const updatedProfessor = await prismaClient.professor.update({
      where: { id: professorId },
      data, 
    });

    return c.json({ message: "Professor updated successfully", professor: updatedProfessor });
  } catch (error) {
    console.error("Error updating professor:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});



// DELETE /students/:studentId - Deletes a student by their ID
app.delete('/students/:studentId', async (c) => {
try {
  const studentId = c.req.param('studentId');
  const existingStudent = await prismaClient.student.findUnique({
    where: { id: studentId },
  });

  if (!existingStudent) {
    return c.json({ error: "Student not found" }, 404);
  }
  await prismaClient.student.delete({
    where: { id: studentId },
  });

  return c.json({ message: "Student deleted successfully" });
} catch (error) {
  console.error("Error deleting student:", error);
  return c.json({ error: "Internal Server Error" }, 500);
}
});

// DELETE /professors/:professorId - Deletes a professor by their ID
app.delete('/professors/:professorId', async (c) => {
try {
  const professorId = c.req.param('professorId');
  const existingProfessor = await prismaClient.professor.findUnique({
    where: { id: professorId },
  });

  if (!existingProfessor) {
    return c.json({ error: "Professor not found" }, 404);
  }
  await prismaClient.professor.delete({
    where: { id: professorId },
  });

  return c.json({ message: "Professor deleted successfully" });
} catch (error) {
  console.error("Error deleting professor:", error);
  return c.json({ error: "Internal Server Error" }, 500);
}
});



//11.  Assigns a student under the proctorship of a professor
app.post('/professors/:professorId/proctorships', async (c) => {
try {
  const professorId = c.req.param('professorId');
  const { studentId } = await c.req.json(); 
  const existingProfessor = await prismaClient.professor.findUnique({
    where: { id: professorId },
  });

  if (!existingProfessor) {
    return c.json({ error: "Professor not found" }, 404);
  }
  const existingStudent = await prismaClient.student.findUnique({
    where: { id: studentId },
  });

  if (!existingStudent) {
    return c.json({ error: "Student not found" }, 404);
  }
  await prismaClient.student.update({
    where: { id: studentId },
    data: { proctorId: professorId },
  });

  return c.json({ message: "Student assigned to professor successfully" });
} catch (error) {
  console.error("Error assigning student to professor:", error);
  return c.json({ error: "Internal Server Error" }, 500);
}
});

//12. Get library membership details for a student
app.get('/students/:studentId/library-membership', async (c) => {
try {
  const studentId = c.req.param('studentId');
  const studentWithMembership = await prismaClient.student.findUnique({
    where: { id: studentId },
    include: { libraryMembership: true },
  });

  if (!studentWithMembership) {
    return c.json({ error: 'Student not found' }, 404);
  }
  if (!studentWithMembership.libraryMembership) {
    return c.json({ error: 'Library membership not found for this student' }, 404);
  }

  return c.json(studentWithMembership.libraryMembership);
} catch (error) {
  console.error('Error fetching library membership:', error);
  return c.json({ error: 'Internal server error' }, 500);
}
});



//13. Create a library membership for a student
app.post('/students/:studentId/library-membership', async (c) => {
try {
  const studentId = c.req.param('studentId');
  const { issueDate, expiryDate } = await c.req.json();
  const student = await prismaClient.student.findUnique({
    where: { id: studentId },
    include: { libraryMembership: true },
  });

  if (!student) {
    return c.json({ error: 'Student not found' }, 404);
  }
  if (student.libraryMembership) {
    return c.json({ error: 'Library membership already exists for this student' }, 400);
  }
  const newMembership = await prismaClient.libraryMembership.create({
    data: {
      studentId,
      issueDate: new Date(issueDate),
      expiryDate: new Date(expiryDate),
    },
  });

  return c.json(newMembership, 201);
} catch (error) {
  console.error('Error creating library membership:', error);
  return c.json({ error: 'Internal server error' }, 500);
}
});



//14. Update library membership details for a student
app.patch('/students/:studentId/library-membership', async (c) => {
try {
  const studentId = c.req.param('studentId');
  const { issueDate, expiryDate } = await c.req.json();
  const student = await prismaClient.student.findUnique({
    where: { id: studentId },
    include: { libraryMembership: true },
  });

  if (!student) {
    return c.json({ error: 'Student not found' }, 404);
  }
  if (!student.libraryMembership) {
    return c.json({ error: 'Library membership not found for this student' }, 404);
  }
  const updatedMembership = await prismaClient.libraryMembership.update({
    where: { studentId },
    data: {
      issueDate: issueDate ? new Date(issueDate) : student.libraryMembership.issueDate,
      expiryDate: expiryDate ? new Date(expiryDate) : student.libraryMembership.expiryDate,
    },
  });

  return c.json(updatedMembership, 200);
} catch (error) {
  console.error('Error updating library membership:', error);
  return c.json({ error: 'Internal server error' }, 500);
}
});


//15. Delete library membership for a student
app.delete("/students/:studentId/library-membership", async (c) => {
try {
  const studentId = c.req.param("studentId");
  const student = await prismaClient.student.findUnique({
    where: { id: studentId },
    include: { libraryMembership: true },
  });
if (!student) {
    return c.json({ error: "Student not found" }, 404);
  }

  if (!student.libraryMembership) {
    return c.json({ error: "Library membership not found for this student" }, 404);
  }

  await prismaClient.libraryMembership.delete({
    where: { studentId },
  });

  return c.json({ message: "Library membership deleted successfully" }, 200);
} catch (error) {
  console.error("Error deleting library membership:", error);
  return c.json({ error: "Failed to delete library membership" }, 500);
}
});

serve(app, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
