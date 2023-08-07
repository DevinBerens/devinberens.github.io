import React, { useCallback, useRef, useState } from "react";
import moment from "moment";

const StudentApp = () => {
  const [morningList, setMorningList] = useState(
    localStorage.getItem("morningClass")
      ? JSON.parse(localStorage.getItem("morningClass"))
      : []
  );
  const [afternoonList, setAfternoonList] = useState(
    localStorage.getItem("afternoonClass")
      ? JSON.parse(localStorage.getItem("afternoonClass"))
      : []
  );
  const [studentName, setStudentName] = useState("");
  const [studentDob, setStudentDob] = useState("");
  const [studentGroup, setStudentGroup] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  let selectedStudentName = useRef();
  let selectedStudentGroup = useRef();

  let handleSubmit = useCallback(
    (event) => {
      event.preventDefault();

      let newStudent = {
        name: event.target[0].value,
        dob: event.target[1].value,
        class: event.target[2].value,
      };
      let studentsArr;
      if (event.target[2].value === "PA") {
        studentsArr = morningList.slice();
        studentsArr.push(newStudent);
        studentsArr = studentsArr.sort(function (a, b) {
          return new Date(a.dob) - new Date(b.dob);
        });
        localStorage.removeItem("morningList");
        localStorage.setItem("morningList", JSON.stringify(studentsArr));
        setMorningList(studentsArr);
      } else {
        studentsArr = afternoonList.slice();
        studentsArr.push(newStudent);
        studentsArr = studentsArr.sort(function (a, b) {
          return new Date(a.dob) - new Date(b.dob);
        });
        localStorage.removeItem("afternoonList");
        localStorage.setItem("afternoonList", JSON.stringify(studentsArr));
        setAfternoonList(studentsArr);
      }
    },
    [morningList, afternoonList]
  );

  let reverseSort = useCallback(() => {
    let morningArr = morningList.slice();
    let afternoonArr = afternoonList.slice();
    morningArr = morningArr.reverse();
    afternoonArr = afternoonArr.reverse();
    setMorningList(morningArr);
    setAfternoonList(afternoonArr);
  }, [morningList, afternoonList]);

  let showCancel = () => {
    setShowCancelModal(true);
  };

  let clearStudents = () => {
    localStorage.setItem("morningList", JSON.stringify([]));
    localStorage.setItem("afternoonList", JSON.stringify([]));
    setMorningList([]);
    setAfternoonList([]);
    setShowCancelModal(false);
  };

  let updateStudent = () => {
    let newStudent = {
      name: studentName,
      dob: studentDob,
      class: studentGroup,
    };

    let morningArr = morningList.slice();
    let afternoonArr = afternoonList.slice();

    if (selectedStudentGroup.current === "PA") {
      let studentIndex = morningArr.findIndex(
        (s) => s.name === selectedStudentName.current
      );
      if (selectedStudentGroup.current === studentGroup) {
        morningArr.splice(studentIndex, 1, newStudent);
        morningArr = morningArr.sort(function (a, b) {
          return new Date(a.dob) - new Date(b.dob);
        });
        localStorage.removeItem("morningList");
        localStorage.setItem("morningList", JSON.stringify(morningArr));
        setMorningList(morningArr);
      } else {
        morningArr.splice(studentIndex, 1);
        afternoonArr.push(newStudent);
        afternoonArr = afternoonArr.sort(function (a, b) {
          return new Date(a.dob) - new Date(b.dob);
        });
        localStorage.removeItem("morningList");
        localStorage.setItem("morningList", JSON.stringify(morningArr));
        setMorningList(morningArr);
        localStorage.removeItem("afternoonList");
        localStorage.setItem("afternoonList", JSON.stringify(afternoonArr));
        setAfternoonList(afternoonArr);
      }
    } else {
      let studentIndex = afternoonArr.findIndex(
        (s) => s.name === selectedStudentName.current
      );
      if (selectedStudentGroup.current === studentGroup) {
        afternoonArr.splice(studentIndex, 1, newStudent);
        afternoonArr = afternoonArr.sort(function (a, b) {
          return new Date(a.dob) - new Date(b.dob);
        });
        localStorage.removeItem("afternoonList");
        localStorage.setItem("afternoonList", JSON.stringify(afternoonArr));
        setAfternoonList(afternoonArr);
      } else {
        afternoonArr.splice(studentIndex, 1);
        morningArr.push(newStudent);
        morningArr = morningArr.sort(function (a, b) {
          return new Date(a.dob) - new Date(b.dob);
        });
        localStorage.removeItem("morningList");
        localStorage.setItem("morningList", JSON.stringify(morningArr));
        setMorningList(morningArr);
        localStorage.removeItem("afternoonList");
        localStorage.setItem("afternoonList", JSON.stringify(afternoonArr));
        setAfternoonList(afternoonArr);
      }
    }
    setShowEditModal(false);
  };

  let deleteStudent = (studentToDelete) => {
    if (studentToDelete.class === "PA") {
      let morningArr = morningList.slice();
      let studentIndex = morningArr.findIndex(
        (s) => s.name === studentToDelete.name
      );
      morningArr.splice(studentIndex, 1);
      localStorage.removeItem("morningList");
      localStorage.setItem("morningList", JSON.stringify(morningArr));
      setMorningList(morningArr);
    } else {
      let afternoonArr = afternoonList.slice();
      let studentIndex = afternoonArr.findIndex(
        (s) => s.name === studentToDelete.name
      );
      afternoonArr.splice(studentIndex, 1);
      localStorage.removeItem("afternoonList");
      localStorage.setItem("afternoonList", JSON.stringify(afternoonArr));
      setAfternoonList(afternoonArr);
    }
  };

  return (
    <div
      style={{
        margin: "25px",
        display: "flex",
        flexDirection: "column",
        height: "90vh",
        alignItems: "center",
      }}
    >
      <form
        style={{ display: "flex", alignItems: "center" }}
        onSubmit={handleSubmit}
      >
        <label>
          <span style={{ fontSize: "24px", marginRight: "10px" }}>Name: </span>
          <input
            style={{ fontSize: "20px", marginRight: "20px" }}
            type="text"
          />
        </label>
        <label>
          <span style={{ fontSize: "24px", marginRight: "10px" }}>
            Date of Birth:{" "}
          </span>
          <input
            style={{ fontSize: "20px", marginRight: "20px" }}
            type="date"
          />
        </label>
        <label>
          <span style={{ fontSize: "24px", marginRight: "10px" }}>
            Select Class
          </span>
          <select style={{ fontSize: "20px", marginRight: "20px" }}>
            <option hidden>Select</option>
            <option>PA</option>
            <option>PB</option>
          </select>
        </label>
        <button style={{ fontSize: "20px", cursor: "pointer" }} type="submit">
          Add Student
        </button>
      </form>
      <div
        style={{
          display: "flex",
          marginTop: "20px",
          marginBottom: "20px",
        }}
      >
        <button
          style={{ cursor: "pointer", marginRight: "10px", fontSize: "20px" }}
          onClick={reverseSort}
        >
          Reverse Sort
        </button>
        <button
          style={{ cursor: "pointer", fontSize: "20px" }}
          onClick={showCancel}
        >
          Clear All Students
        </button>
      </div>
      <div style={{ width: "95vw", display: "flex" }}>
        <div
          style={{
            display: "flex",
            flex: "1 1 auto",
            flexDirection: "column",
            marginRight: "10px",
          }}
        >
          {morningList.map((student, index) => (
            <div
              style={{
                display: "flex",
                fontSize: "26px",
                marginBottom: "10px",
                width: "60%",
              }}
              key={index}
            >
              <div style={{ marginRight: "40px", flex: "1 1 auto" }}>
                {student.name}
              </div>
              <div>{moment(student.dob).format("MM/DD/YYYY")}</div>
              <div
                style={{ marginLeft: "10px", marginRight: "10px" }}
                onClick={() => {
                  setStudentName(student.name);
                  setStudentDob(student.dob);
                  setStudentGroup(student.class);
                  selectedStudentName.current = student.name;
                  selectedStudentGroup.current = student.class;
                  setShowEditModal(true);
                }}
              >
                Edit
              </div>
              <div
                onClick={() => {
                  deleteStudent(student);
                }}
              >
                Delete
              </div>
            </div>
          ))}
        </div>
        <div
          style={{ display: "flex", flex: "1 1 auto", flexDirection: "column" }}
        >
          {afternoonList.map((student, index) => (
            <div
              style={{
                display: "flex",
                fontSize: "26px",
                marginBottom: "10px",
                width: "60%",
              }}
              key={index}
            >
              <div style={{ marginRight: "40px", flex: "1 1 auto" }}>
                {student.name}
              </div>
              <div>{moment(student.dob).format("MM/DD/YYYY")}</div>
              <div
                style={{ marginLeft: "10px", marginRight: "10px" }}
                onClick={() => {
                  setStudentName(student.name);
                  setStudentDob(student.dob);
                  setStudentGroup(student.class);
                  selectedStudentName.current = student.name;
                  selectedStudentGroup.current = student.class;
                  setShowEditModal(true);
                }}
              >
                Edit
              </div>
              <div
                onClick={() => {
                  deleteStudent(student);
                }}
              >
                Delete
              </div>
            </div>
          ))}
        </div>
      </div>
      {showCancelModal && (
        <div
          style={{
            width: "550px",
            height: "500px",
            backgroundColor: "white",
            border: "3px solid gray",
            position: "absolute",
            zIndex: 500,
            top: `calc(50% - 250px)`,
            left: `calc(50% - 250px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: "1 1 auto",
            }}
          >
            <h1>You are about to clear all students!</h1>
            <h3>Are you sure you want to do this?</h3>
            <h4>Really sure?</h4>
            <h6>Positive?</h6>
          </div>
          <div style={{ display: "flex", marginBottom: "25px" }}>
            <button
              style={{
                backgroundColor: "#ee0000",
                width: "200px",
                flex: "1 1 auto",
                height: "40px",
                color: "white",
                fontSize: "20px",
                marginRight: "10px",
                cursor: "pointer",
              }}
              onClick={() => {
                setShowCancelModal(false);
              }}
            >
              No
            </button>
            <button
              style={{
                backgroundColor: "#0000ee",
                width: "200px",
                height: "40px",
                flex: "1 1 auto",
                color: "white",
                fontSize: "20px",
                cursor: "pointer",
              }}
              onClick={clearStudents}
            >
              Yes
            </button>
          </div>
        </div>
      )}
      {showEditModal && (
        <div
          style={{
            width: "550px",
            height: "500px",
            backgroundColor: "white",
            border: "3px solid gray",
            position: "absolute",
            zIndex: 500,
            top: `calc(50% - 250px)`,
            left: `calc(50% - 250px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: "1 1 auto",
            }}
          >
            <h2>Edit Student</h2>
            <label>
              <span>Student Name</span>
              <input
                value={studentName}
                type="text"
                onChange={(event) => {
                  setStudentName(event.target.value);
                }}
              />
            </label>
            <label>
              <span>Student DOB</span>
              <input
                value={studentDob}
                type="date"
                onChange={(event) => {
                  setStudentDob(event.target.value);
                }}
              />
            </label>
            <label>
              <span>Student Class</span>
              <select
                value={studentGroup}
                onChange={(event) => {
                  setStudentGroup(event.target.value);
                }}
              >
                <option>PA</option>
                <option>PB</option>
              </select>
            </label>
          </div>
          <div style={{ display: "flex", marginBottom: "25px" }}>
            <button
              style={{
                backgroundColor: "#ee0000",
                width: "200px",
                flex: "1 1 auto",
                height: "40px",
                color: "white",
                fontSize: "20px",
                marginRight: "10px",
                cursor: "pointer",
              }}
              onClick={() => {
                setShowEditModal(false);
              }}
            >
              No
            </button>
            <button
              style={{
                backgroundColor: "#0000ee",
                width: "200px",
                height: "40px",
                flex: "1 1 auto",
                color: "white",
                fontSize: "20px",
                cursor: "pointer",
              }}
              onClick={updateStudent}
            >
              Yes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentApp;
