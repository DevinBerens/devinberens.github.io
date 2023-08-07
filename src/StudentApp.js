import React, { useCallback, useState } from "react";
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
  const [showCancelModal, setShowCancelModal] = useState(false);

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
                width: "40%",
              }}
              key={index}
            >
              <div style={{ marginRight: "40px", flex: "1 1 auto" }}>
                {student.name}
              </div>
              <div>{moment(student.dob).format("MM/DD/YYYY")}</div>
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
                width: "40%",
              }}
              key={index}
            >
              <div style={{ marginRight: "40px", flex: "1 1 auto" }}>
                {student.name}
              </div>
              <div>{moment(student.dob).format("MM/DD/YYYY")}</div>
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
    </div>
  );
};

export default StudentApp;
