
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, MinusCircle, UserCheck, Calendar, Clock, Trophy } from 'lucide-react';
import { toast } from 'sonner';

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

  // Load students from localStorage on component mount
  useEffect(() => {
    const savedStudents = JSON.parse(localStorage.getItem('students') || '[]');
    setStudents(savedStudents);
  }, []);

  // Save students to localStorage
  const saveStudentsToStorage = (studentsList: string[]) => {
    localStorage.setItem('students', JSON.stringify(studentsList));
  };

  // Points matrix for mass times
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

    // Calculate points
    const isAMMass = massTime.includes("AM");
    const isPMMass = massTime.includes("PM");
    const amPoints = isAMMass ? 2 : 0;
    const pmPoints = isPMMass ? 1 : 0;
    const meetingPoints = meetingAttended === "Yes" ? 5 : 0;
    const finalPoints = amPoints + pmPoints + meetingPoints;

    // Update student points
    setStudentPoints(prev => ({
      ...prev,
      [selectedStudent]: (prev[selectedStudent] || 0) + finalPoints
    }));

    // Add to records
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
    
    // Remove from points and records
    const updatedPoints = { ...studentPoints };
    delete updatedPoints[removeStudentName.trim()];
    setStudentPoints(updatedPoints);
    
    const updatedRecords = studentRecords.filter(record => record.studentName !== removeStudentName.trim());
    setStudentRecords(updatedRecords);
    
    setRemoveStudentName('');
    toast.success(`${removeStudentName} removed successfully`);
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Detailed attendance data
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

      // Summary data
      const summaryData = Object.entries(studentPoints).map(([student, points]) => [student, points]);
      const summarySheet = XLSX.utils.aoa_to_sheet([
        ["Student Name", "Total Points"],
        ...summaryData
      ]);
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary Report");

      XLSX.writeFile(wb, "attendance_report.xlsx");
      toast.success("Report exported successfully!");
    } catch (error) {
      toast.error("Failed to export report");
    }
  };

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
          {/* Left Column - Forms */}
          <div className="space-y-6">
            {/* Attendance Form */}
            <Card className="form-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Record Attendance
                </CardTitle>
                <CardDescription>
                  Mark student attendance and calculate points automatically
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAttendanceSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student">Select Student</Label>
                    <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map(student => (
                          <SelectItem key={student} value={student}>
                            {student}
                          </SelectItem>
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
                            <SelectItem key={day} value={day}>
                              {day}
                            </SelectItem>
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
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                {time}
                              </div>
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
                  <Input
                    placeholder="Student name"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addStudent()}
                  />
                  <Button onClick={addStudent} variant="outline">
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Student name to remove"
                    value={removeStudentName}
                    onChange={(e) => setRemoveStudentName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && removeStudent()}
                  />
                  <Button onClick={removeStudent} variant="outline">
                    <MinusCircle className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  Total students: {students.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Reports */}
          <div className="space-y-6">
            {/* Summary Report */}
            <Card className="report-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Points Summary
                </CardTitle>
                <CardDescription>Total points earned by each student</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(studentPoints).length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No attendance records yet
                    </p>
                  ) : (
                    Object.entries(studentPoints)
                      .sort(([,a], [,b]) => b - a)
                      .map(([student, points]) => (
                        <div key={student} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <span className="font-medium">{student}</span>
                          <Badge className={`points-badge ${getPointsBadgeVariant(points)}`}>
                            {points} points
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Detailed Records */}
            <Card className="report-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Recent Attendance
                </CardTitle>
                <CardDescription>Individual attendance records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {studentRecords.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No records yet
                    </p>
                  ) : (
                    studentRecords.slice(-10).reverse().map((record, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg animate-fade-in">
                        <div>
                          <div className="font-medium">{record.studentName}</div>
                          <div className="text-sm text-muted-foreground">
                            {record.dayOfWeek} • {record.massTime}
                            {record.meetingAttended === 'Yes' && ' • Meeting'}
                          </div>
                        </div>
                        <Badge className={`points-badge ${getPointsBadgeVariant(record.points)}`}>
                          +{record.points}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Export Button */}
            {studentRecords.length > 0 && (
              <Button onClick={exportToExcel} className="w-full gradient-success">
                Export to Excel
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceForm;
