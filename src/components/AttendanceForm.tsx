import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, MinusCircle, UserCheck, Calendar, Clock, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// pdf.js & worker for Vite
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface StudentRecord {
  studentName: string;
  dayOfWeek: string;
  massTime: string;
  points: number;
  meetingAttended: string;
}

const AttendanceForm = () => {
  const [students, setStudents] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [massTime, setMassTime] = useState<string>('');
  const [dayOfWeek, setDayOfWeek] = useState<string>('');
  const [meetingAttended, setMeetingAttended] = useState<string>('');
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [removeStudentName, setRemoveStudentName] = useState<string>('');
  const [studentRecords, setStudentRecords] = useState<StudentRecord[]>([]);
  const [studentPoints, setStudentPoints] = useState<Record<string, number>>({});

  useEffect(() => {
    const savedStudents = JSON.parse(localStorage.getItem('students') || '[]');
    setStudents(savedStudents);
  }, []);

  const saveStudentsToStorage = (studentsList: string[]) => {
    localStorage.setItem('students', JSON.stringify(studentsList));
  };

  const pointsMatrix = {
    Monday: { "6:30 AM": 2, "7:00 PM": 1 },
    Tuesday: { "6:30 AM": 2, "7:00 PM": 1 },
    Wednesday: { "6:30 AM": 2, "7:00 PM": 1 },
    Thursday: { "6:30 AM": 2, "7:00 PM": 1 },
    Friday: { "6:30 AM": 2, "7:00 PM": 1 },
    Saturday: { "6:30 AM": 2, "7:00 PM": 1 },
    Sunday: {
      "7:30 AM": 2,
      "8:30 AM": 2,
      "9:30 AM": 2,
      "6:00 PM": 1,
    },
  } as const;

  const handleAttendanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudent || !massTime || !dayOfWeek || !meetingAttended) {
      toast.error("Please fill in all fields");
      return;
    }

    const isAMMass = massTime.includes("AM");
    const isPMMass = massTime.includes("PM");
    const amPoints = isAMMass ? 2 : 0;
    const pmPoints = isPMMass ? 1 : 0;
    const meetingPoints = meetingAttended === "Yes" ? 5 : 0;
    const finalPoints = amPoints + pmPoints + meetingPoints;

    setStudentPoints(prev => ({
      ...prev,
      [selectedStudent]: (prev[selectedStudent] || 0) + finalPoints
    }));

    const newRecord: StudentRecord = {
      studentName: selectedStudent,
      dayOfWeek,
      massTime,
      points: finalPoints,
      meetingAttended
    };

    setStudentRecords(prev => [...prev, newRecord]);
    toast.success(`Attendance recorded for ${selectedStudent} (${finalPoints} points)`);
  };

  const addStudent = () => {
    if (!newStudentName.trim()) {
      toast.error("Please enter a student name");
      return;
    }
    if (students.includes(newStudentName.trim())) {
      toast.error("Student already exists");
      return;
    }
    const updatedStudents = [...students, newStudentName.trim()].sort();
    setStudents(updatedStudents);
    saveStudentsToStorage(updatedStudents);
    setNewStudentName('');
    toast.success(`${newStudentName} added successfully`);
  };

  const removeStudent = () => {
    if (!removeStudentName.trim()) {
      toast.error("Please enter a student name to remove");
      return;
    }
    const updatedStudents = students.filter(student => student !== removeStudentName.trim());
    if (updatedStudents.length === students.length) {
      toast.error("Student not found");
      return;
    }
    setStudents(updatedStudents);
    saveStudentsToStorage(updatedStudents);
    const updatedPoints = { ...studentPoints };
    delete updatedPoints[removeStudentName.trim()];
    setStudentPoints(updatedPoints);
    const updatedRecords = studentRecords.filter(record => record.studentName !== removeStudentName.trim());
    setStudentRecords(updatedRecords);
    setRemoveStudentName('');
    toast.success(`${removeStudentName} removed successfully`);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const detailedData = studentRecords.map(record => [
      record.studentName,
      record.dayOfWeek,
      record.massTime,
      record.meetingAttended,
      record.points
    ]);
    const detailedSheet = XLSX.utils.aoa_to_sheet([
      ["Student Name", "Day of Week", "Mass Time", "Meeting Attended", "Points"],
      ...detailedData
    ]);
    XLSX.utils.book_append_sheet(wb, detailedSheet, "Detailed Attendance");
    const summaryData = Object.entries(studentPoints).map(([student, points]) => [student, points]);
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Student Name", "Total Points"],
      ...summaryData
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary Report");
    XLSX.writeFile(wb, "attendance_report.xlsx");
    toast.success("Report exported successfully!");
  };

  // -------------------------
  // NEW: Robust PDF -> Excel parser
  // -------------------------
  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      type TextItem = { str: string; x: number; y: number; page: number };
      const allItems: TextItem[] = [];

      // Extract text items with coordinates from every page
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        for (const item of textContent.items as any[]) {
          const str = (item.str || '').toString();
          if (!str.trim() && str !== '-') continue; // skip pure whitespace but keep '-' if it is present
          // transform: [a, b, c, d, e, f] => e = x, f = y
          const transform = item.transform || item.tx || [];
          const x = (transform[4] ?? 0) as number;
          const y = (transform[5] ?? 0) as number;
          allItems.push({ str: str.trim(), x, y, page: p });
        }
      }

      if (allItems.length === 0) {
        toast.error("No text found in PDF");
        return;
      }

      // Build global X clusters (columns) across all pages
      const X_CLUSTER_THRESHOLD = 18; // pixels — tweak if needed
      const xs: number[] = Array.from(new Set(allItems.map(i => Math.round(i.x))));
      xs.sort((a,b)=>a-b);
      const xClusters: number[] = [];
      for (const x of xs) {
        const foundIndex = xClusters.findIndex(cx => Math.abs(cx - x) <= X_CLUSTER_THRESHOLD);
        if (foundIndex === -1) xClusters.push(x);
        else xClusters[foundIndex] = Math.round((xClusters[foundIndex] + x) / 2);
      }
      xClusters.sort((a,b)=>a-b);

      // Helper to find nearest column index
      const nearestXIndex = (xVal: number) => {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < xClusters.length; i++) {
          const d = Math.abs(xClusters[i] - xVal);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        return bestIdx;
      };

      // Group items by page, then cluster by y (rows)
      const Y_CLUSTER_THRESHOLD = 4; // pixels — tweak if needed
      const rowsMatrix: string[][] = [];

      const itemsByPage = new Map<number, TextItem[]>();
      for (const it of allItems) {
        if (!itemsByPage.has(it.page)) itemsByPage.set(it.page, []);
        itemsByPage.get(it.page)!.push(it);
      }

      const sortedPages = Array.from(itemsByPage.keys()).sort((a,b)=>a-b);
      for (const pageNum of sortedPages) {
        const pageItems = itemsByPage.get(pageNum)!;
        // Get unique Y's rounded and cluster them
        const ys = Array.from(new Set(pageItems.map(it => Math.round(it.y))));
        ys.sort((a,b)=>b-a); // sort top->bottom (pdf y can vary; we preserve visual order)
        const yClusters: number[] = [];
        for (const y of ys) {
          const foundIndex = yClusters.findIndex(cy => Math.abs(cy - y) <= Y_CLUSTER_THRESHOLD);
          if (foundIndex === -1) yClusters.push(y);
          else yClusters[foundIndex] = Math.round((yClusters[foundIndex] + y) / 2);
        }
        // Sort row clusters by descending y (top to bottom)
        yClusters.sort((a,b)=>b-a);

        // For each y cluster build a row with columns = xClusters.length
        for (const yc of yClusters) {
          const itemsInRow = pageItems.filter(it => Math.abs(Math.round(it.y) - yc) <= Y_CLUSTER_THRESHOLD);
          // initialize empty row
          const row = new Array(xClusters.length).fill('');
          // place each item into nearest column; preserve order by x inside a column
          itemsInRow.sort((a,b)=>a.x - b.x).forEach(it => {
            const colIdx = nearestXIndex(it.x);
            // append (with space) to that column cell
            row[colIdx] = row[colIdx] ? `${row[colIdx]} ${it.str}` : it.str;
          });
          // push row to matrix (we keep rows in page order)
          rowsMatrix.push(row);
        }
      }

      if (rowsMatrix.length === 0) {
        toast.error("No table rows detected in PDF");
        return;
      }

      // Normalize rows to same width (max columns) just in case
      const maxCols = Math.max(...rowsMatrix.map(r => r.length));
      const normalized = rowsMatrix.map(r => {
        const copy = [...r];
        while (copy.length < maxCols) copy.push('');
        return copy.map(cell => cell.trim());
      });

      // Optionally: remove empty leading/trailing rows if they are fully blank
      // but user requested exact copy — so we keep them.
      // Build Excel
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(normalized);
      XLSX.utils.book_append_sheet(wb, ws, "Attendance_from_PDF");

      // auto download
      XLSX.writeFile(wb, "attendance_from_pdf.xlsx");
      toast.success(`Parsed ${normalized.length} rows and downloaded Excel.`);
    } catch (err) {
      console.error("PDF parse error:", err);
      toast.error("Failed to read or parse PDF");
    }
  };

  // -------------------------
  // end parser
  // -------------------------

  const getPointsBadgeVariant = (points: number) => {
    if (points >= 5) return "points-high";
    if (points >= 3) return "points-medium";
    return "points-low";
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 py-8">
          <div className="flex justify-center mb-4">
            <Trophy className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold gradient-primary bg-clip-text text-transparent">
            Student Attendance Tracker
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Track student attendance at masses and meetings with an automated points system
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Attendance Form */}
            <Card className="form-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Record Attendance
                </CardTitle>
                <CardDescription>Mark student attendance and calculate points automatically</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAttendanceSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Student</Label>
                    <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map(student => (
                          <SelectItem key={student} value={student}>{student}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Day of Week</Label>
                      <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(pointsMatrix).map(day => (
                            <SelectItem key={day} value={day}>{day}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mass Time</Label>
                      <Select value={massTime} onValueChange={setMassTime}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          {dayOfWeek && Object.keys(pointsMatrix[dayOfWeek as keyof typeof pointsMatrix]).map(time => (
                            <SelectItem key={time} value={time}>
                              <Clock className="h-4 w-4 mr-2" />{time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Meeting Attended</Label>
                    <Select value={meetingAttended} onValueChange={setMeetingAttended}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes (+5 points)</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full gradient-primary">
                    <UserCheck className="h-4 w-4 mr-2" />
                    Record Attendance
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Student Management */}
            <Card className="form-section">
              <CardHeader>
                <CardTitle>Manage Students</CardTitle>
                <CardDescription>Add or remove students from the system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Student name" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} />
                  <Button onClick={addStudent} variant="outline"><PlusCircle className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Student name to remove" value={removeStudentName} onChange={(e) => setRemoveStudentName(e.target.value)} />
                  <Button onClick={removeStudent} variant="outline"><MinusCircle className="h-4 w-4" /></Button>
                </div>
                <div className="text-sm text-muted-foreground">Total students: {students.length}</div>
              </CardContent>
            </Card>

            {/* PDF Upload */}
            <Card className="form-section">
              <CardHeader>
                <CardTitle>Upload Attendance PDF</CardTitle>
                <CardDescription>Convert attendance PDF to Excel (auto-download)</CardDescription>
              </CardHeader>
              <CardContent>
                <Input type="file" accept="application/pdf" onChange={handlePDFUpload} />
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Summary */}
            <Card className="report-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Points Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(studentPoints).length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No attendance records yet</p>
                ) : (
                  Object.entries(studentPoints).sort(([,a],[,b]) => b - a).map(([student, points]) => (
                    <div key={student} className="flex justify-between p-3 bg-muted/30 rounded-lg">
                      <span>{student}</span>
                      <Badge className={`points-badge ${getPointsBadgeVariant(points)}`}>{points} points</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Detailed */}
            <Card className="report-section">
              <CardHeader>
                <CardTitle><Calendar className="h-5 w-5" /> Recent Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                {studentRecords.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No records yet</p>
                ) : (
                  studentRecords.slice(-10).reverse().map((record, i) => (
                    <div key={i} className="flex justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div>{record.studentName}</div>
                        <div className="text-sm text-muted-foreground">
                          {record.dayOfWeek} • {record.massTime} {record.meetingAttended === 'Yes' && '• Meeting'}
                        </div>
                      </div>
                      <Badge className={`points-badge ${getPointsBadgeVariant(record.points)}`}>+{record.points}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Export */}
            {studentRecords.length > 0 && (
              <Button onClick={exportToExcel} className="w-full gradient-success">Export to Excel</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceForm;
