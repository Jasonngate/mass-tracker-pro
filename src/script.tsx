// script.ts
import * as XLSX from "xlsx";

// Types
interface StudentRecord {
  studentName: string;
  dayOfWeek: string;
  massTime: string;
  points: number;
}

// To store points for each student
const studentPoints: Record<string, number> = {};
// To store attendance records for generating detailed reports
let studentRecords: StudentRecord[] = [];

// DOM references
const attendanceForm = document.getElementById("attendanceForm") as HTMLFormElement;
const studentNameSelect = document.getElementById("studentName") as HTMLSelectElement;
const massTimeSelect = document.getElementById("massTime") as HTMLSelectElement;
const dayOfWeekSelect = document.getElementById("dayOfWeek") as HTMLSelectElement;
const meetingAttendedSelect = document.getElementById("meetingAttended") as HTMLSelectElement;
const previewReportDiv = document.getElementById("previewReport") as HTMLDivElement;
const finalReportDiv = document.getElementById("finalReport") as HTMLDivElement;
const newStudentInput = document.getElementById("newStudent") as HTMLInputElement;
const removeStudentInput = document.getElementById("removeStudent") as HTMLInputElement;
const addStudentBtn = document.getElementById("addStudentBtn") as HTMLButtonElement;
const removeStudentBtn = document.getElementById("removeStudentBtn") as HTMLButtonElement;
const exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;

// Load students from localStorage on page load
document.addEventListener("DOMContentLoaded", () => {
  loadStudentsFromLocalStorage();
});

// Handle attendance form submission
attendanceForm.addEventListener("submit", (e: Event) => {
  e.preventDefault();

  const studentName = studentNameSelect.value;
  const massTime = massTimeSelect.value;
  const dayOfWeek = dayOfWeekSelect.value;
  const meetingAttended = meetingAttendedSelect.value;

  if (!studentName || !massTime || !dayOfWeek || !meetingAttended) {
    alert("Please select a student, mass time, day of the week, and meeting attended option.");
    return;
  }

  // Points assignment logic for mass time
  const pointsMatrix: Record<string, Record<string, number>> = {
    Monday: { "6:30 AM": 2, "7:00 PM": 1 },
    Tuesday: { "6:30 AM": 2, "7:00 PM": 1 },
    Wednesday: { "6:30 AM": 2, "7:00 PM": 1 },
    Thursday: { "6:30 AM": 2, "7:00 PM": 1 },
    Friday: { "6:30 AM": 2, "7:00 PM": 1 },
    Saturday: { "6:30 AM": 2, "7:00 PM": 1 },
    Sunday: { "7:30 AM": 2, "8:30 AM": 2, "9:30 AM": 2, "6:00 PM": 1 },
  };

  const isAMMass = massTime.includes("AM");
  const isPMMass = massTime.includes("PM");
  const amPoints = isAMMass ? 2 : 0;
  const pmPoints = isPMMass ? 1 : 0;
  const meetingPoints = meetingAttended === "Yes" ? 5 : 0;
  const finalPoints = amPoints + pmPoints + meetingPoints;

  if (!studentPoints[studentName]) {
    studentPoints[studentName] = 0;
  }
  studentPoints[studentName] += finalPoints;

  studentRecords.push({ studentName, dayOfWeek, massTime, points: finalPoints });

  updatePreviewReport();
  updateFinalReport();
  resetFormFields(studentName);
});

function resetFormFields(excludeStudentName: string) {
  studentNameSelect.value = excludeStudentName;
}

function updatePreviewReport() {
  previewReportDiv.innerHTML = "";
  studentRecords.forEach((record) => {
    const p = document.createElement("p");
    p.textContent = `${record.studentName} - ${record.dayOfWeek} - ${record.massTime} - ${record.points} point(s)`;
    previewReportDiv.appendChild(p);
  });
}

function updateFinalReport() {
  finalReportDiv.innerHTML = "";
  for (const [student, points] of Object.entries(studentPoints)) {
    const p = document.createElement("p");
    p.textContent = `${student}: ${points} point(s)`;
    finalReportDiv.appendChild(p);
  }
}

addStudentBtn.addEventListener("click", () => {
  const newStudentName = newStudentInput.value.trim();
  if (newStudentName === "") {
    alert("Please enter a student name.");
    return;
  }

  const existingStudents = Array.from(studentNameSelect.options).map((o) => o.value);
  if (existingStudents.includes(newStudentName)) {
    alert(`${newStudentName} is already in the list.`);
    newStudentInput.value = "";
    return;
  }

  const newOption = document.createElement("option");
  newOption.value = newStudentName;
  newOption.textContent = newStudentName;
  studentNameSelect.appendChild(newOption);

  const sortedOptions = Array.from(studentNameSelect.options).slice(1).sort((a, b) =>
    a.text.localeCompare(b.text)
  );
  studentNameSelect.innerHTML = '<option value="" disabled selected>Select Student</option>';
  sortedOptions.forEach((o) => studentNameSelect.appendChild(o));

  alert(`${newStudentName} has been added to the list.`);
  newStudentInput.value = "";
  saveStudentsToLocalStorage();
});

removeStudentBtn.addEventListener("click", () => {
  const removeStudentName = removeStudentInput.value.trim();
  if (removeStudentName === "") {
    alert("Please enter a student name to remove.");
    return;
  }

  let removed = false;
  for (let i = 0; i < studentNameSelect.options.length; i++) {
    if (studentNameSelect.options[i].value === removeStudentName) {
      studentNameSelect.remove(i);
      removed = true;
      delete studentPoints[removeStudentName];
      studentRecords = studentRecords.filter((r) => r.studentName !== removeStudentName);
      alert(`${removeStudentName} has been removed.`);
      break;
    }
  }

  if (!removed) {
    alert(`Student "${removeStudentName}" not found.`);
  }

  updatePreviewReport();
  updateFinalReport();
  removeStudentInput.value = "";
  saveStudentsToLocalStorage();
});

function saveStudentsToLocalStorage() {
  const students = Array.from(studentNameSelect.options)
    .slice(1)
    .map((o) => o.value);
  localStorage.setItem("students", JSON.stringify(students));
}

function loadStudentsFromLocalStorage() {
  const saved = JSON.parse(localStorage.getItem("students") || "[]") as string[];
  studentNameSelect.innerHTML = '<option value="" disabled selected>Select Student</option>';
  saved.forEach((student) => {
    const opt = document.createElement("option");
    opt.value = student;
    opt.textContent = student;
    studentNameSelect.appendChild(opt);
  });
}

exportBtn.addEventListener("click", () => {
  const wb = XLSX.utils.book_new();
  const detailedData = studentRecords.map((r) => [r.studentName, r.dayOfWeek, r.massTime, r.points]);
  const detailedSheet = XLSX.utils.aoa_to_sheet([["Student Name", "Day of Week", "Mass Time", "Points"], ...detailedData]);
  XLSX.utils.book_append_sheet(wb, detailedSheet, "Detailed Attendance");

  const summaryData = Object.entries(studentPoints).map(([name, points]) => [name, points]);
  const summarySheet = XLSX.utils.aoa_to_sheet([["Student Name", "Total Points"], ...summaryData]);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary Report");

  XLSX.writeFile(wb, "attendance_report.xlsx");
});
